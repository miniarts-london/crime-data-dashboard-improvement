import type { RawCrime, GeocodeResult } from '@/types/dashboard';
import { REQUEST_TIMEOUT_MS } from '@/config/config';

// Preserves the HTTP status our own /api/... route responded with, not just
// the message - so a caller (eventually Dashboard) can tell a 4xx (bad
// input, retrying won't help) apart from a 5xx (upstream/proxy trouble,
// might be worth retrying) instead of only ever seeing a string. This is
// the client-side counterpart to UpstreamError in lib/server/upstream.ts -
// a different layer (our route's response status, not the upstream API's),
// so it's its own small class rather than importing across that boundary.
export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

const geocodeCache = new Map<string, GeocodeResult>();
const crimesCache = new Map<string, RawCrime[]>();

// Combines a caller-provided signal - Dashboard uses this to cancel a
// stale search's requests the moment a new one starts - with a fixed
// timeout, so every request has an upper bound on how long it can run
// even when nobody passes a signal in at all. AbortSignal.any() aborts as
// soon as either source does, whichever fires first.
function withTimeout(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error || `HTTP ${res.status}`;
}

export async function geocodePostcode(postcode: string, signal?: AbortSignal): Promise<GeocodeResult> {
  const key = postcode.trim().toUpperCase();
  const cached = geocodeCache.get(key);
  if (cached) return cached;

  const res = await fetch(`/api/postcode/${encodeURIComponent(key)}`, { signal: withTimeout(signal) });
  if (!res.ok) throw new ApiError(await readError(res), res.status);
  const result: GeocodeResult = await res.json();
  geocodeCache.set(key, result);
  return result;
}

export async function fetchCrimes(
  lat: number,
  lng: number,
  date: string,
  signal?: AbortSignal
): Promise<RawCrime[]> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)},${date}`;
  const cached = crimesCache.get(key);
  if (cached) return cached;

  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  if (date) params.set('date', date);

  const res = await fetch(`/api/crimes?${params}`, { signal: withTimeout(signal) });
  if (!res.ok) throw new ApiError(await readError(res), res.status);

  const data: RawCrime[] = await res.json();
  crimesCache.set(key, data);
  return data;
}
