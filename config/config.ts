export const MIN_SUGGEST_CHARS = 2;
export const SUGGEST_DEBOUNCE_MS = 250;
export const MAX_REQUESTS = 40;
// Bounds how long any single postcode/crimes request is allowed to run.
// Without this, a hung `fetch` - slow network, an upstream that never
// responds - would permanently consume one of createLimiter's concurrency
// slots and never surface an error: nothing else in this stack (no
// upstream timeout, no AbortController) bounds request duration otherwise.
export const REQUEST_TIMEOUT_MS = 15_000;

// Crime data is published monthly and postcodes almost never move, so cached
// answers stay good for a long time. These replace the old module-level Map
// caches in lib/police.ts, with the difference that entries now expire.
export const GEOCODE_STALE_MS = Infinity;
export const CRIMES_STALE_MS = 60 * 60 * 1000; // 1 hour
export const SEARCH_STALE_MS = 10 * 60 * 1000; // 10 minutes