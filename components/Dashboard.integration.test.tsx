import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Dashboard from '@/components/Dashboard';
import { renderWithProviders } from '@/test/render';
import type { InitialParams, RawCrime } from '@/types/dashboard';

// Dashboard.test.tsx mocks `@/lib/police` (geocodePostcode/fetchCrimes)
// entirely. That's the right boundary for a unit test of Dashboard's own
// orchestration - but it means none of lib/police.ts's own code ever runs
// in the suite: its /api/... URL construction, its geocode/crimes caches
// (the two module-scope Maps), or its error-message reading. This file
// mocks one layer lower instead - the global `fetch` the app would
// actually send over the network - so lib/police runs for real, and
// Dashboard is exercised against something much closer to what the
// browser does.
//
// CrimeMap stays mocked: Leaflet needs real layout/canvas that jsdom can't
// provide, and it isn't part of the fetch -> cache -> render -> filter
// path this file is testing. `@/components/ContextRoot/Providers` is left
// UNmocked on purpose - its ColorModeContext has a real `createContext`
// default ({ mode: 'light', toggleColorMode: () => {} }), so nothing
// crashes without a mock, and using the real thing here is one less
// assumption to keep in sync with the component.
vi.mock('@/lib/postcodeSuggestions', () => ({
  suggestPostcodes: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/components/CrimeMap', () => ({
  default: function CrimeMapMock() {
    return <div>Crime map mock</div>;
  },
}));

const GEOCODED: Record<string, { lat: number; lng: number; label: string }> = {
  'SW1A 1AA': { lat: 51.501, lng: -0.142, label: 'SW1A 1AA' },
  // Each test below searches a postcode none of the others touch. lib/police.ts's
  // geocodeCache/crimesCache are module-scope Maps (Q7/Q12 in the interview doc)
  // that live for this whole file's run, since Dashboard - and so lib/police - is
  // only ever imported once normally at the top of the file; there's no per-test
  // vi.resetModules() + dynamic import here the way lib/police.test.ts uses to get
  // a fresh cache each time (Q18). Giving every test its own postcode keeps their
  // cache keys from colliding, without needing that heavier reset machinery on a
  // component test.
  'EC1A 1BB': { lat: 51.518, lng: -0.098, label: 'EC1A 1BB' },
  'W1A 0AX': { lat: 51.517, lng: -0.141, label: 'W1A 0AX' },
};

function rawCrime(overrides: Partial<RawCrime> = {}): RawCrime {
  return {
    category: 'burglary',
    id: 1,
    month: '2026-06',
    location: {
      latitude: '51.501',
      longitude: '-0.142',
      street: { id: 1, name: 'On or near Whitehall' },
    },
    outcome_status: { category: 'Under investigation', date: '2026-06' },
    ...overrides,
  };
}

// A stand-in for the network, keyed off the same relative URLs
// lib/police.ts actually calls (/api/postcode/..., /api/crimes?...) -
// not off the mocked lib/police functions themselves, since those aren't
// mocked in this file.
function installFetchMock(crimesByPostcode: Record<string, RawCrime[]>) {
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.startsWith('/api/postcode/')) {
      const code = decodeURIComponent(url.replace('/api/postcode/', ''));
      const hit = GEOCODED[code];
      if (!hit) {
        return new Response(JSON.stringify({ error: 'Postcode not found' }), { status: 400 });
      }
      return new Response(JSON.stringify(hit), { status: 200 });
    }

    if (url.startsWith('/api/crimes')) {
      const params = new URLSearchParams(url.split('?')[1]);
      const lat = Number(params.get('lat'));
      const postcode = Object.entries(GEOCODED).find(([, g]) => g.lat === lat)?.[0] ?? '';
      return new Response(JSON.stringify(crimesByPostcode[postcode] ?? []), { status: 200 });
    }

    throw new Error(`Unexpected fetch in integration test: ${url}`);
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function searchPostcode(user: ReturnType<typeof userEvent.setup>, postcode: string) {
  const input = screen.getByRole('combobox', { name: /postcodes/i });
  await user.type(input, postcode);
  await user.keyboard('{Enter}');
  await user.click(screen.getByRole('button', { name: 'Search' }));
}

const emptyParams: InitialParams = { postcodes: [], from: '2026-06', to: '2026-06' };

describe('Dashboard (integration: real lib/police, mocked network boundary)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('goes through the real fetch -> cache -> normalize -> render pipeline', async () => {
    const fetchMock = installFetchMock({ 'SW1A 1AA': [rawCrime()] });
    const user = userEvent.setup();
    renderWithProviders(<Dashboard initialParams={emptyParams} />);

    await searchPostcode(user, 'SW1A 1AA');

    expect(await screen.findByRole('heading', { level: 3, name: '1' })).toBeInTheDocument();
    expect(screen.getByText('Whitehall')).toBeInTheDocument();

    // These prove lib/police itself built the right request - a
    // fully-mocked `@/lib/police` test can't see this, since the real
    // function bodies never run there.
    // lib/police.ts now always passes a second { signal } argument to
    // fetch (see withTimeout() in lib/police.ts), so match the URL
    // positionally rather than the exact full call.
    expect(fetchMock).toHaveBeenCalledWith('/api/postcode/SW1A%201AA', expect.anything());
    expect(fetchMock.mock.calls.some(([u]) => String(u).startsWith('/api/crimes?'))).toBe(true);
  });

  it('does not hit the network twice for a postcode/month already fetched (lib/police cache)', async () => {
    const fetchMock = installFetchMock({ 'EC1A 1BB': [rawCrime()] });
    const user = userEvent.setup();
    renderWithProviders(<Dashboard initialParams={emptyParams} />);

    await searchPostcode(user, 'EC1A 1BB');
    expect(await screen.findByRole('heading', { level: 3, name: '1' })).toBeInTheDocument();
    const callsAfterFirstSearch = fetchMock.mock.calls.length;
    expect(callsAfterFirstSearch).toBe(2); // one geocode call, one crimes call

    // Same postcode, same date range, no retyping - just search again.
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      // Dashboard has no "already searched this" guard of its own - it
      // calls geocodePostcode/fetchCrimes again every time. It's
      // lib/police's in-memory Maps that should short-circuit before
      // either call reaches `fetch`.
      expect(fetchMock).toHaveBeenCalledTimes(callsAfterFirstSearch);
    });
  });

  it('lets a keyboard-only user activate a table cell to filter (regression check for the CrimeTable a11y fix)', async () => {
    installFetchMock({
      'W1A 0AX': [
        rawCrime(),
        rawCrime({
          id: 2,
          category: 'anti-social-behaviour',
          outcome_status: { category: 'Investigation complete', date: '2026-06' },
        }),
      ],
    });
    const user = userEvent.setup();
    renderWithProviders(<Dashboard initialParams={emptyParams} />);

    await searchPostcode(user, 'W1A 0AX');
    expect(await screen.findByRole('heading', { level: 3, name: '2' })).toBeInTheDocument();

    // "Under investigation" only appears as the outcome cell for the first
    // crime - unambiguous, unlike the postcode, which also shows up in the
    // search chip and the history panel.
    const outcomeCell = await screen.findByRole('button', { name: 'Under investigation' });
    outcomeCell.focus();
    expect(outcomeCell).toHaveFocus();

    // Enter, not a click - this is what a `<Box component="span" onClick>`
    // could never do, since a plain span with no tabIndex can't take focus
    // at all. Passing here is what proves the button conversion actually
    // fixed keyboard access rather than just satisfying a linter.
    await user.keyboard('{Enter}');

    expect(await screen.findByText(/filtered by/i)).toBeInTheDocument();
  });
});
