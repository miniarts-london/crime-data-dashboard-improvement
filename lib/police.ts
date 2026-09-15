import type { RawCrime, GeocodeResult } from '@/types/dashboard';

const geocodeCache = new Map<string, GeocodeResult>();
const crimesCache = new Map<string, RawCrime[]>();

async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error || `HTTP ${res.status}`;
}

export async function geocodePostcode(postcode: string): Promise<GeocodeResult> {
  const key = postcode.trim().toUpperCase();
  const cached = geocodeCache.get(key);
  if (cached) return cached;

  const res = await fetch(`/api/postcode/${encodeURIComponent(key)}`);
  if (!res.ok) throw new Error(await readError(res));
  const result: GeocodeResult = await res.json();
  geocodeCache.set(key, result);
  return result;
}

export async function fetchCrimes(lat: number, lng: number, date: string): Promise<RawCrime[]> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)},${date}`;
  const cached = crimesCache.get(key);
  if (cached) return cached;

  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  if (date) params.set('date', date);

  const res = await fetch(`/api/crimes?${params}`);
  if (!res.ok) throw new Error(await readError(res));

  const data: RawCrime[] = await res.json();
  crimesCache.set(key, data);
  return data;
}
