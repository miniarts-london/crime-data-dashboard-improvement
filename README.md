# Crime Data Dashboard

Search UK street-level crime by postcode and month range. Results show as totals, a map, and a filterable table. Data comes from [police.uk](https://data.police.uk/) (usually about two months behind) and postcodes are geocoded via [getthedata.com](https://www.getthedata.com/open-postcode-geo-api).

## Run

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) (or the port Next prints if 3000 is taken).

```bash
npm run test:run   # unit / component tests
npm run lint
```

## Trade-offs

- **APIs are proxied through Next.js Route Handlers** (`/api/postcode/[postcode]`, `/api/crimes`, `/api/postcodes/autocomplete`). The browser never talks to getthedata’s `http://` endpoint, so HTTPS deploys no longer fail as mixed content, and the upstream URLs stay off the client bundle. What it gives up: the app is no longer a static export — it needs the Next.js server — and each search pays an extra hop.

- **The map skips SSR (`next/dynamic` with `ssr: false`) so Leaflet never runs on the server, and the component is only rendered after a search.** That avoided the `window is not defined` crash and keeps the Leaflet chunk off the first visit. What it gives up: the map is absent from the first HTML payload, and there is an empty-state gap until the first successful geocode.

- **Searched postcodes live in `localStorage` (25 most recent), not a user account.** History survives refresh and extra tabs on the same browser with no auth. What it gives up: no history across devices or browsers, and nothing is stored if storage is blocked.

- **Searches are capped at 40 postcode/month combinations, with four requests in flight.** That avoids hammering public APIs and the police.uk 10k-crime 503. What it gives up: you cannot run a wide date range across many postcodes in one go.


## What I'd do with more time

- **Batch large searches instead of rejecting them outright.** `runSearch` in `Dashboard.tsx` currently rejects any search over `MAX_REQUESTS` (40) postcode/month combinations before firing a single request. Chunking the pairs into batches of `MAX_REQUESTS`, running them sequentially through the existing concurrency limiter, and streaming `crimes` updates as each batch resolves (instead of one `setCrimes` call at the end) would let a genuinely large search run — slower, with results appearing progressively — rather than being blocked outright. The police API has no bulk endpoint, so the total request count doesn't shrink; only the all-or-nothing UX does.

- **Cross-highlight the table and map on selection.** Clicking a table row doesn't currently do anything beyond the existing cell-level postcode/category/outcome filters, and clicking a map marker only opens its popup — neither is aware of the other. A shared `selectedCrimeId` state (keyed by `CrimeRecord.id`, lifted into `Dashboard.tsx` and passed to both `CrimeTable` and `CrimeMap`) would let selecting a row call `leaflet.markercluster`'s `zoomToShowLayer(marker, callback)` — built in specifically to reveal a marker that's currently rolled up inside a cluster bubble — and open its popup, and let clicking a marker highlight and scroll to the matching row in the table. The main wrinkle: crime markers in `CrimeMap.tsx` are built imperatively via `L.markerClusterGroup()` inside `ClusterLayer`'s `useEffect` rather than as declarative react-leaflet `<Marker>`s, so each one would need to be kept in a `Map<string, L.Marker>` keyed by crime id as it's created, so it can be looked up when a table row is clicked.

- **No feedback for an invalid From/To month.** `SearchBar.tsx` disables invalid months in the calendar UI (`shouldDisableMonth`, `maxDate`) so clicking one does nothing visible beyond it being greyed out — but that check isn't repeated for typed input: the `onChange` handlers only call `newValue.isValid()` (is this a real date) before accepting it into `from`/`to` state, not `isUnavailableMonth()` (is this an allowed date). So typing a future month, or a "To" month before "From", directly into the field slips straight into state with no rejection, no red/error styling, and no message — the `onError` callback MUI X's `DatePicker` provides specifically for this (reporting `'shouldDisableMonth' | 'minDate' | 'maxDate' | 'invalidDate' | null`) isn't wired up at all. The fix is two-part: add `onError` on both pickers to set a local `fromError`/`toError` state shown via `slotProps.textField.error`/`helperText` (e.g. "No data before this month yet" / "Must be on or after From"), and have the `onChange` handlers themselves re-check `isUnavailableMonth()` before calling `onFromChange`/`onToChange`, so a typed value can't bypass the same rule the calendar already enforces.

- **Rate-limit and cache on the server.** The in-memory Maps in `lib/police.ts` still only help one browser tab. The Route Handlers already set `fetch` revalidate windows, but a shared cache (or even a short in-process Map in the handlers) plus a per-IP cap would do more to protect police.uk than the client-side 40-combo limit alone.

- **Finish splitting route files from screen components.** `page.tsx` already moved under `app/(pages)/`, which keeps the route entry file separate from layouts and API routes — but that's only half the refactor. `Dashboard.tsx`, the actual full-page composition, is still sitting flat in `components/` alongside pieces that are genuinely reused (`SearchBar.tsx`, `CrimeMap.tsx`, `CrimeTable.tsx`, `CrimeOverview.tsx`, `PostcodeHistory.tsx`, `Header.tsx`). Moving it into a `screens/` folder (`Dashboard.tsx` → `screens/DashboardScreen.tsx`, updating the one import in `app/(pages)/page.tsx`) would finish the separation: `page.tsx` stays a thin wrapper, `screens/` holds per-route composition and state, and `components/` stays reserved for what's actually shared across more than one screen. What's left is a single file move, not a redesign.
