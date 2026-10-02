'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  hashKey,
  keepPreviousData,
  queryOptions,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import type { CrimeRecord, SearchPoint } from '@/types/dashboard';
import { MAX_REQUESTS } from '@/config/config';
import { fetchCrimes, geocodePostcode } from '@/lib/police';
import { createLimiter } from '@/lib/concurrency';
import { monthsBetween } from '@/lib/dateRange';
import { dedupeCrimes, normalize } from '@/components/Helper';
import { shouldRetry } from '@/lib/queryClient';
import { CRIMES_STALE_MS, GEOCODE_STALE_MS, SEARCH_STALE_MS } from '@/config/config';

// TanStack Query caches and de-duplicates requests but doesn't cap how many
// run at once, so the shared limiter still keeps it to 4 in flight.
const limiter = createLimiter(4);

export interface SearchProgress {
  done: number;
  total: number;
}

export interface SearchParams {
  postcodes: string[];
  from: string;
  to: string;
}

export interface SearchResult {
  crimes: CrimeRecord[];
  searchPoints: SearchPoint[];
  issues: string[];
}

// What the UI should show. TanStack's own `status` only says whether there is
// data ('pending' | 'error' | 'success') and `fetchStatus` whether a request is
// running; with keepPreviousData a new search is "success + fetching", so the
// hook combines them into the states the dashboard actually renders:
// - idle:       no search yet (or after reset)
// - loading:    first search, nothing to show yet
// - refreshing: a new search is running; the previous results stay on screen
// - error:      the search was rejected (too many requests) or failed outright
// - success:    results are in (possibly empty, or partial with issues)
export type SearchStatus = 'idle' | 'loading' | 'refreshing' | 'error' | 'success';

export interface UseCrimesOptions {
  // Fires once a search has passed the MAX_REQUESTS check and is about to
  // run - e.g. to sync the query string or reset filters.
  onSearchStart?: (postcodes: string[], from: string, to: string) => void;
  // Fires with the postcodes that geocoded successfully (skipped if none did).
  onGeocoded?: (postcodes: string[]) => void;
}

// ---------------------------------------------------------------------------
// Query keys. One entry per postcode, one per point+month, and one per whole
// search, so a repeated search is instant and overlapping searches share the
// postcode/month requests they have in common.
// ---------------------------------------------------------------------------

export const queryKeys = {
  geocode: (postcode: string) => ['geocode', postcode] as const,
  crimes: (lat: number, lng: number, month: string) =>
    ['crimes', lat.toFixed(4), lng.toFixed(4), month] as const,
  search: ({ postcodes, from, to }: SearchParams) => ['crime-search', postcodes, from, to] as const,
};

// The geocode -> crimes-per-month fan-out for one search. Each request goes
// through the query cache (so it's cached and de-duplicated) and through the
// limiter (so at most 4 run at once). `signal` is TanStack's: it aborts when
// this search is superseded, reset, or nothing is watching it any more.
async function runCrimeSearch(
  queryClient: QueryClient,
  { postcodes, from, to }: SearchParams,
  signal: AbortSignal,
  onProgress: () => void
): Promise<SearchResult> {
  const months = monthsBetween(from, to);
  const issues: string[] = [];
  const tick = () => {
    if (!signal.aborted) onProgress();
  };

  const geocoded: SearchPoint[] = [];
  await Promise.all(
    postcodes.map((pc) =>
      limiter(async () => {
        if (signal.aborted) return; // superseded while queued: don't start it
        const key = pc.trim().toUpperCase();
        try {
          const loc = await queryClient.fetchQuery({
            queryKey: queryKeys.geocode(key),
            queryFn: ({ signal: requestSignal }) => geocodePostcode(key, requestSignal),
            staleTime: GEOCODE_STALE_MS,
            retry: shouldRetry,
          });
          geocoded.push({ postcode: loc.label || pc, lat: loc.lat, lng: loc.lng });
        } catch (e) {
          issues.push(`${pc}: ${(e as Error).message}`);
        } finally {
          tick();
        }
      })
    )
  );
  signal.throwIfAborted();

  if (geocoded.length === 0) {
    throw new Error(`Couldn't find any of the entered postcodes. ${issues.join('; ')}`);
  }

  // Build rows from the Promise.all results, not by pushing inside the
  // tasks, so the table order is the same however requests happen to finish.
  const batches = await Promise.all(
    geocoded.flatMap((g) =>
      months.map((month) =>
        limiter(async (): Promise<CrimeRecord[]> => {
          if (signal.aborted) return [];
          try {
            const raw = await queryClient.fetchQuery({
              queryKey: queryKeys.crimes(g.lat, g.lng, month),
              queryFn: ({ signal: requestSignal }) => fetchCrimes(g.lat, g.lng, month, requestSignal),
              staleTime: CRIMES_STALE_MS,
              retry: shouldRetry,
            });
            return normalize(raw, g.postcode);
          } catch (e) {
            issues.push(`${g.postcode} (${month}): ${(e as Error).message}`);
            return [];
          } finally {
            tick();
          }
        })
      )
    )
  );
  signal.throwIfAborted();

  return { crimes: dedupeCrimes(batches.flat()), searchPoints: geocoded, issues };
}

const NO_PARAMS: SearchParams = { postcodes: [], from: '', to: '' };

export function useCrimes({ onSearchStart, onGeocoded }: UseCrimesOptions = {}) {
  const queryClient = useQueryClient();
  const [params, setParams] = useState<SearchParams | null>(null);
  const [progress, setProgress] = useState<SearchProgress | null>(null);
  const [validationError, setValidationError] = useState('');
  const [dismissed, setDismissed] = useState(false);
  // Only the latest search may fire onGeocoded once its result arrives.
  const latestRun = useRef(0);

  // Callbacks read through a ref, so `search` stays referentially stable even
  // when the caller passes inline functions.
  const callbacks = useRef({ onSearchStart, onGeocoded });
  useEffect(() => {
    callbacks.current = { onSearchStart, onGeocoded };
  });

  const searchQuery = useCallback(
    (p: SearchParams) =>
      queryOptions({
        queryKey: queryKeys.search(p),
        queryFn: ({ signal }) =>
          runCrimeSearch(queryClient, p, signal, () =>
            setProgress((prev) => (prev ? { ...prev, done: prev.done + 1 } : prev))
          ),
        staleTime: SEARCH_STALE_MS,
      }),
    [queryClient]
  );

  const query = useQuery({
    ...searchQuery(params ?? NO_PARAMS),
    // search() starts the fetch itself, and the observer only watches it. If
    // that fetch fails before the next render, the observer would see a new
    // key whose query is in error with no data, treat it as stale and quietly
    // fetch it again. So an errored search stays failed until the user asks:
    // retry() and search() call fetchQuery directly, which ignores `enabled`.
    enabled: (q) => params !== null && q.state.status !== 'error',
    // Keep the previous results on screen while a new search loads, instead
    // of flashing an empty map and table.
    placeholderData: keepPreviousData,
  });

  const search = useCallback(
    async (postcodes: string[], from: string, to: string) => {
      const run = ++latestRun.current;
      setValidationError('');
      setDismissed(false);

      const months = monthsBetween(from, to);
      const totalCombos = postcodes.length * months.length;
      if (totalCombos > MAX_REQUESTS) {
        setValidationError(
          `That's ${totalCombos} postcode/month combinations - please narrow your postcodes or date range (max ${MAX_REQUESTS}).`
        );
        return;
      }

      const next = { postcodes, from, to };
      const options = searchQuery(next);
      // Cancel whatever earlier search is still running. Its in-flight
      // requests finish into the cache; its queued ones never start.
      const nextHash = hashKey(options.queryKey);
      void queryClient.cancelQueries({
        queryKey: ['crime-search'],
        predicate: (q) => q.queryHash !== nextHash,
      });

      callbacks.current.onSearchStart?.(postcodes, from, to);
      setProgress({ done: 0, total: postcodes.length + totalCombos });
      setParams(next);

      // Same key as the useQuery above, so TanStack runs one fetch for both
      // (or returns the cached result straight away). Awaiting it lets callers
      // and tests know when the search has finished.
      try {
        const result = await queryClient.fetchQuery(options);
        if (run === latestRun.current && result.searchPoints.length > 0) {
          callbacks.current.onGeocoded?.(result.searchPoints.map((p) => p.postcode));
        }
      } catch {
        // Errors are shown through the query's state; a cancelled
        // (superseded) search just stops quietly.
      }
    },
    [queryClient, searchQuery]
  );

  const reset = useCallback(() => {
    latestRun.current += 1;
    setParams(null);
    setProgress(null);
    setValidationError('');
    setDismissed(false);
    // Stop everything still in flight: the search and its requests.
    void queryClient.cancelQueries({ queryKey: ['crime-search'] });
    void queryClient.cancelQueries({ queryKey: ['geocode'] });
    void queryClient.cancelQueries({ queryKey: ['crimes'] });
  }, [queryClient]);

  const clearError = useCallback(() => setDismissed(true), []);

  // Run the last search again, e.g. after the whole search failed. The failed
  // query has no data, so fetchQuery fetches it afresh rather than returning
  // the cached error.
  const retry = useCallback(() => {
    if (params) void search(params.postcodes, params.from, params.to);
  }, [params, search]);

  // No search, or this search failed outright: show nothing rather than the
  // previous search's results.
  const data = params && !query.isError ? query.data : undefined;
  const loading = params !== null && query.isFetching;

  // Order matters: fetching wins over error, so retrying a failed search shows
  // "loading" rather than the old error while it runs.
  const status: SearchStatus = validationError
    ? 'error'
    : params === null
      ? 'idle'
      : query.isFetching
        ? query.data
          ? 'refreshing'
          : 'loading'
        : query.isError
          ? 'error'
          : 'success';

  let error = validationError;
  if (!error && params && !loading) {
    if (query.error) error = query.error.message;
    else if (data?.issues.length) error = `Some requests had issues: ${data.issues.join('; ')}`;
    else if (data && data.crimes.length === 0) error = 'No crimes found for that search.';
  }

  return {
    status,
    crimes: data?.crimes ?? EMPTY_CRIMES,
    searchPoints: data?.searchPoints ?? EMPTY_POINTS,
    loading,
    progress: loading ? progress : null,
    error: dismissed ? '' : error,
    search,
    retry,
    reset,
    clearError,
    // Only a failed search can be retried; a validation error needs new input.
    canRetry: status === 'error' && !validationError,
  };
}

// Stable empty arrays, so memoised children don't re-render for a new [].
const EMPTY_CRIMES: CrimeRecord[] = [];
const EMPTY_POINTS: SearchPoint[] = [];
