# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

Node >= 20.19 (`.nvmrc` pins 20).

```bash
npm run dev                         # Next dev server on :3000
npm run build
npm run lint                        # eslint (flat config, eslint.config.mjs)
npm run test:run                    # vitest, single run
npm test                            # vitest watch mode
npx vitest run lib/useCrimes.test.ts          # one file
npx vitest run -t "name of the test"          # one test by name
```

Env vars (see `.env.example`) are optional — upstream base URLs have defaults in `lib/server/upstream.ts` and are read only server-side.

## Architecture

Next.js 16 App Router + React 19, MUI 9 (with `@mui/x-date-pickers`, `material-react-table`), TanStack Query 5, Leaflet, zod 4. Path alias `@/*` → repo root.

UK street-crime dashboard: user enters postcodes + a month range; the app geocodes each postcode and fetches police.uk crimes for every postcode × month pair.

### Request flow (two layers, deliberately separate)

1. **Client** — `lib/police.ts` calls only our own `/api/...` routes, never upstream APIs directly. Every request gets a timeout (`REQUEST_TIMEOUT_MS`) combined with the caller's abort signal, and failures throw `ApiError` carrying our route's status.
2. **Route Handlers** — `app/api/{postcode/[postcode],crimes,postcodes/autocomplete}/route.ts` validate input with zod schemas from `lib/schemas.ts`, then call `lib/server/upstream.ts`, which hits getthedata.com (geocode), data.police.uk (crimes) and postcodes.io (autocomplete only). Upstream responses are zod-validated; crimes are validated per record (bad records dropped and logged, not fatal). `UpstreamError` carries the upstream status so routes can map it (e.g. police.uk 503 = "too many crimes", passed through). police.uk 404 means "no data for that month" and becomes `[]`.

`ApiError` (client) and `UpstreamError` (server) are intentionally separate classes — don't import across the client/server boundary.

### Search orchestration — `lib/useCrimes.ts`

The core logic. A whole search is one TanStack query (`queryKeys.search`) whose queryFn fans out via `queryClient.fetchQuery` into per-postcode geocode queries and per-point×month crimes queries, so overlapping searches share cache entries. A module-level `createLimiter(4)` (`lib/concurrency.ts`) caps in-flight requests, since TanStack doesn't. Searches over `MAX_REQUESTS` (40) combinations are rejected up front. Partial failures are collected into `issues` rather than failing the search; only "no postcode geocoded" fails it. Results go through `normalize` + `dedupeCrimes` (`components/Helper.ts`). The hook exposes a derived `SearchStatus` (`idle | loading | refreshing | error | success`) combining TanStack's `status`/`fetchStatus` with `keepPreviousData`.

Retry policy lives in `lib/queryClient.ts` (`shouldRetry`: only 5xx except 503). Stale times and limits are in `config/config.ts`.

### UI

- `app/(pages)/page.tsx` is a thin server component: parses `searchParams` (`parseSearchParams`) and renders `components/Dashboard.tsx`, the client component that owns page state. Search state is mirrored into the URL query string (`updateQueryString`/`clearQueryString`).
- `components/ContextRoot/Providers.tsx` wires MUI cache/theme, color mode (persisted in localStorage), date-picker localization, and a per-session `QueryClient`.
- `CrimeMap` is loaded with `next/dynamic` `ssr: false` (Leaflet needs `window`) and wrapped in `CrimeMapErrorBoundary`. Markers are built imperatively with `leaflet.markercluster` inside an effect, not as react-leaflet `<Marker>`s.
- Postcode history: `lib/usePostcodeHistory.ts`, localStorage, 25 most recent.

## Testing

Vitest + jsdom + Testing Library, tests colocated as `*.test.ts(x)`. `test/setup.ts` stubs `matchMedia`, `ResizeObserver`, scroll/pointer-capture APIs and clears localStorage after each test. Render components with `renderWithProviders` from `test/render.tsx` (fresh QueryClient per test + theme + date-picker localization); use `createQueryWrapper` for hooks. Route handlers are tested in `app/api/routes.test.ts`.
