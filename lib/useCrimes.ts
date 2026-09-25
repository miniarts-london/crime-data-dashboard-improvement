'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CrimeRecord, SearchPoint } from '@/types/dashboard';
import { MAX_REQUESTS } from '@/config/config';
import { fetchCrimes, geocodePostcode } from '@/lib/police';
import { createLimiter } from '@/lib/concurrency';
import { monthsBetween } from '@/lib/dateRange';
import { normalize } from '@/components/Helper';

const limiter = createLimiter(4);

export interface SearchProgress {
  done: number;
  total: number;
}

export interface UseCrimesOptions {
  // Fires once a search has passed the MAX_REQUESTS check and is about to
  // hit the network - e.g. to sync the query string or reset filters.
  onSearchStart?: (postcodes: string[], from: string, to: string) => void;
  // Fires with the postcodes that geocoded successfully (skipped if none did).
  onGeocoded?: (postcodes: string[]) => void;
}

// Owns the geocode -> crimes-per-month fan-out for a search, plus its
// loading/progress/error state. Only the most recent search may update
// state: starting a new one (or resetting, or unmounting) aborts whatever
// the previous one still had in flight, so abandoned requests stop
// occupying the limiter's concurrency slots. A queued-but-not-started task
// gets an already-aborted signal and fetch rejects without a network call.
export function useCrimes({ onSearchStart, onGeocoded }: UseCrimesOptions = {}) {
  const [crimes, setCrimes] = useState<CrimeRecord[]>([]);
  const [searchPoints, setSearchPoints] = useState<SearchPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<SearchProgress | null>(null);
  const [error, setError] = useState('');

  const searchGen = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // Read callbacks through a ref so `search` stays referentially stable
  // even when the caller passes inline functions.
  const callbacks = useRef({ onSearchStart, onGeocoded });
  useEffect(() => {
    callbacks.current = { onSearchStart, onGeocoded };
  });

  const search = useCallback(async (postcodes: string[], from: string, to: string) => {
    const gen = ++searchGen.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError('');

    const months = monthsBetween(from, to);
    const totalCombos = postcodes.length * months.length;
    if (totalCombos > MAX_REQUESTS) {
      setError(
        `That's ${totalCombos} postcode/month combinations - please narrow your postcodes or date range (max ${MAX_REQUESTS}).`
      );
      return;
    }

    callbacks.current.onSearchStart?.(postcodes, from, to);
    setLoading(true);
    setProgress({ done: 0, total: postcodes.length + totalCombos });

    const stillCurrent = () => gen === searchGen.current;
    const tick = () => {
      if (stillCurrent()) setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    };

    try {
      const geocoded: SearchPoint[] = [];
      const issues: string[] = [];

      await Promise.all(
        postcodes.map((pc) =>
          limiter(async () => {
            try {
              const loc = await geocodePostcode(pc, controller.signal);
              geocoded.push({ postcode: loc.label || pc, lat: loc.lat, lng: loc.lng });
            } catch (e) {
              issues.push(`${pc}: ${(e as Error).message}`);
            } finally {
              tick();
            }
          })
        )
      );

      if (!stillCurrent()) return;

      setSearchPoints(geocoded);
      if (geocoded.length === 0) {
        setCrimes([]);
        setError(`Couldn't find any of the entered postcodes. ${issues.join('; ')}`);
        return;
      }
      callbacks.current.onGeocoded?.(geocoded.map((g) => g.postcode));

      const allRows: CrimeRecord[] = [];
      await Promise.all(
        geocoded.flatMap((g) =>
          months.map((month) =>
            limiter(async () => {
              try {
                const raw = await fetchCrimes(g.lat, g.lng, month, controller.signal);
                allRows.push(...normalize(raw, g.postcode));
              } catch (e) {
                issues.push(`${g.postcode} (${month}): ${(e as Error).message}`);
              } finally {
                tick();
              }
            })
          )
        )
      );

      if (!stillCurrent()) return;

      setCrimes(allRows);
      if (issues.length) {
        setError(`Some requests had issues: ${issues.join('; ')}`);
      } else if (allRows.length === 0) {
        setError('No crimes found for that search.');
      }
    } finally {
      if (stillCurrent()) {
        setLoading(false);
        setProgress(null);
      }
    }
  }, []);

  const reset = useCallback(() => {
    searchGen.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setCrimes([]);
    setSearchPoints([]);
    setLoading(false);
    setProgress(null);
    setError('');
  }, []);

  const clearError = useCallback(() => setError(''), []);

  // Cancel whatever's in flight if the owning component unmounts mid-search.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { crimes, searchPoints, loading, progress, error, search, reset, clearError };
}
