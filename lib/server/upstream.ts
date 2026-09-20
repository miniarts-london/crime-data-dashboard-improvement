import type { GeocodeResult, RawCrime } from '@/types/dashboard';

// Carries the real upstream HTTP status alongside the message, so callers
// (route handlers) can map it to a response status without having to
// pattern-match on message text.
export class UpstreamError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'UpstreamError';
  }
}

const POSTCODE_BASE =
  process.env.POSTCODE_API_BASE_URL || 'http://api.getthedata.com/postcode';
const CRIME_BASE = process.env.CRIME_API_BASE_URL || 'https://data.police.uk/api';
const AUTOCOMPLETE_BASE =
  process.env.POSTCODE_AUTOCOMPLETE_BASE_URL || 'https://api.postcodes.io/postcodes';

// Street-level crime barely changes within an hour; postcodes almost never do.
const GEOCODE_REVALIDATE = 60 * 60;
const CRIME_REVALIDATE = 10 * 60;
const AUTOCOMPLETE_REVALIDATE = 60 * 60;

interface GetTheDataPostcodeResponse {
  status: string;
  notice?: string;
  data?: {
    postcode: string;
    latitude: string;
    longitude: string;
  };
}

interface AutocompleteResponse {
  status: number;
  result: string[] | null;
}

export async function geocodePostcodeUpstream(postcode: string): Promise<GeocodeResult> {
  const res = await fetch(`${POSTCODE_BASE}/${encodeURIComponent(postcode)}`, {
    next: { revalidate: GEOCODE_REVALIDATE },
  });
  const body: GetTheDataPostcodeResponse | null = await res.json().catch(() => null);
  if (!res.ok || !body || body.status !== 'match' || !body.data) {
    throw new Error(body?.notice || body?.status || 'Postcode not found');
  }
  const { latitude, longitude, postcode: formatted } = body.data;
  return { lat: parseFloat(latitude), lng: parseFloat(longitude), label: formatted };
}

export async function fetchCrimesUpstream(
  lat: number,
  lng: number,
  date: string
): Promise<RawCrime[]> {
  const url = new URL(`${CRIME_BASE}/crimes-street/all-crime`);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lng', String(lng));
  if (date) url.searchParams.set('date', date);

  const res = await fetch(url, { next: { revalidate: CRIME_REVALIDATE } });

  if (res.status === 404) {
    // Rolling window with no data for that month — treat as zero crimes.
    return [];
  }
  if (res.status === 503) {
    throw new UpstreamError(
      'too many crimes in this area for one request - try a smaller date range',
      503
    );
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  return res.json();
}

export async function autocompletePostcodesUpstream(query: string): Promise<string[]> {
  const url = `${AUTOCOMPLETE_BASE}/${encodeURIComponent(query)}/autocomplete?limit=10`;
  const res = await fetch(url, { next: { revalidate: AUTOCOMPLETE_REVALIDATE } });
  if (!res.ok) return [];
  const body: AutocompleteResponse = await res.json();
  return body.result ?? [];
}
