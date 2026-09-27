import { currentMonth } from "@/lib/dateRange";
import { parsePostcodesInput } from "@/lib/postcodes";
import { bucketFor } from "@/lib/theme";
import { CrimeRecord, InitialParams, RawCrime } from "@/types/dashboard";

function getParam(
  search: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string,
): string {
  if (search instanceof URLSearchParams) {
    return search.get(key) || '';
  }
  const value = search[key];
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

export function parseSearchParams(
  search: URLSearchParams | Record<string, string | string[] | undefined>,
): InitialParams {
  const { valid } = parsePostcodesInput(getParam(search, 'postcodes'));
  const today = currentMonth();
  return {
    postcodes: valid,
    from: getParam(search, 'from') || today,
    to: getParam(search, 'to') || today,
  };
}

export function updateQueryString(postcodes: string[], from: string, to: string) {
  const params = new URLSearchParams();
  if (postcodes.length > 0) params.set('postcodes', postcodes.join(','));
  params.set('from', from);
  params.set('to', to);
  window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
}

export function clearQueryString() {
  window.history.replaceState(null, '', window.location.pathname);
}

export function normalize(raw: RawCrime[], postcode: string): CrimeRecord[] {
  return raw.map((c, i) => {
    const loc = c.location;
    const hasLocation = Boolean(loc && loc.latitude && loc.longitude);
    return {
      // The API's own id, not prefixed with the postcode, so dedupeCrimes can
      // spot the same crime coming back from two overlapping searches. A crime
      // with neither id gets a key of its own and is never merged.
      id: c.id != null ? String(c.id) : c.persistent_id || `${postcode}-${c.month}-${i}`,
      postcodes: [postcode],
      hasLocation,
      lat: hasLocation && loc ? parseFloat(loc.latitude) : null,
      lng: hasLocation && loc ? parseFloat(loc.longitude) : null,
      category: c.category,
      bucket: bucketFor(c.category),
      street: loc?.street?.name?.replace(/^on or near\s*/i, '') || 'Unknown location',
      month: c.month,
      outcome: c.outcome_status?.category || 'No outcome recorded yet',
    };
  });
}

// The police API returns every crime within 1 mile of each searched point, so
// nearby postcodes return some of the same crimes. Merge them into one row per
// crime (keeping first-seen order) that lists every postcode it was found near,
// so totals count each crime once and a postcode filter still shows them all.
export function dedupeCrimes(rows: CrimeRecord[]): CrimeRecord[] {
  const byId = new Map<string, CrimeRecord>();
  for (const row of rows) {
    const existing = byId.get(row.id);
    if (!existing) {
      byId.set(row.id, { ...row, postcodes: [...row.postcodes] });
      continue;
    }
    for (const pc of row.postcodes) {
      if (!existing.postcodes.includes(pc)) existing.postcodes.push(pc);
    }
  }
  return [...byId.values()];
}
