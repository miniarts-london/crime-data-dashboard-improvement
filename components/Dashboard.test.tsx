import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from '@/components/Dashboard';
import { fetchCrimes, geocodePostcode } from '@/lib/police';
import { renderWithProviders } from '@/test/render';
import type { InitialParams, RawCrime } from '@/types/dashboard';

vi.mock('@/lib/postcodeSuggestions', () => ({
  suggestPostcodes: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/police', () => ({
  geocodePostcode: vi.fn(),
  fetchCrimes: vi.fn(),
}));

vi.mock('@/components/CrimeMap', () => ({
  default: function CrimeMapMock() {
    return <div>Crime map mock</div>;
  },
}));

vi.mock('@/components/ContextRoot/Providers', () => ({
  useColorMode: () => ({ mode: 'light', toggleColorMode: vi.fn() }),
}));

const geocodePostcodeMock = vi.mocked(geocodePostcode);
const fetchCrimesMock = vi.mocked(fetchCrimes);

const sampleCrime: RawCrime = {
  category: 'burglary',
  id: 1,
  month: '2026-06',
  location: {
    latitude: '51.501',
    longitude: '-0.142',
    street: { id: 1, name: 'On or near Whitehall' },
  },
  outcome_status: { category: 'Under investigation', date: '2026-06' },
};

const emptyParams: InitialParams = {
  postcodes: [],
  from: '2026-06',
  to: '2026-06',
};

async function searchPostcode(user: ReturnType<typeof userEvent.setup>, postcode = 'SW1A 1AA') {
  const input = screen.getByRole('combobox', { name: /postcodes/i });
  await user.type(input, postcode);
  await user.keyboard('{Enter}');
  await user.click(screen.getByRole('button', { name: 'Search' }));
}

describe('Dashboard', () => {
  beforeEach(() => {
    geocodePostcodeMock.mockResolvedValue({ lat: 51.501, lng: -0.142, label: 'SW1A 1AA' });
    fetchCrimesMock.mockResolvedValue([sampleCrime]);
    window.history.replaceState(null, '', '/');
  });

  it('searches a postcode and shows crime results', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Dashboard initialParams={emptyParams} />);

    await searchPostcode(user);

    expect(await screen.findByRole('heading', { level: 3, name: '1' })).toBeInTheDocument();
    expect(screen.getByText('Whitehall')).toBeInTheDocument();
    expect(screen.getByText('Crime map mock')).toBeInTheDocument();
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'SW1A 1AA' }).length).toBeGreaterThan(0);
    // Dashboard now also passes its per-search AbortController's signal
    // as a second argument, so match it positionally rather than assert
    // an exact single-arg call.
    expect(geocodePostcodeMock).toHaveBeenCalledWith('SW1A 1AA', expect.anything());
    expect(fetchCrimesMock).toHaveBeenCalled();
  });

  it('auto-searches when the page is opened with query params', async () => {
    renderWithProviders(
      <Dashboard initialParams={{ postcodes: ['SW1A 1AA'], from: '2026-06', to: '2026-06' }} />
    );

    expect(await screen.findByRole('heading', { level: 3, name: '1' })).toBeInTheDocument();
    // Dashboard now also passes its per-search AbortController's signal
    // as a second argument, so match it positionally rather than assert
    // an exact single-arg call.
    expect(geocodePostcodeMock).toHaveBeenCalledWith('SW1A 1AA', expect.anything());
  });

  it('resets postcodes, searched history, results, and the URL', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Dashboard initialParams={emptyParams} />);

    await searchPostcode(user);
    expect(await screen.findByRole('heading', { level: 3, name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('list')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reset' }));

    await waitFor(() => {
      expect(screen.getByText('Postcodes you search will appear here.')).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { level: 3, name: '0' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'SW1A 1AA' })).not.toBeInTheDocument();
    expect(screen.getAllByText('No data yet - run a search above.')).toHaveLength(3);
    expect(window.location.search).toBe('');
    expect(window.localStorage.getItem('crime-dashboard:postcode-history')).toBe('[]');
  });

  it('does not search until a valid postcode is present', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Dashboard initialParams={emptyParams} />);

    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
    await user.type(screen.getByRole('combobox', { name: /postcodes/i }), 'not a postcode');
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
    expect(geocodePostcodeMock).not.toHaveBeenCalled();
  });

  it('filters the overview when a crime type in the table is clicked', async () => {
    const user = userEvent.setup();
    fetchCrimesMock.mockResolvedValue([
      sampleCrime,
      {
        ...sampleCrime,
        id: 2,
        category: 'anti-social-behaviour',
        outcome_status: { category: 'Investigation complete', date: '2026-06' },
      },
    ]);
    renderWithProviders(<Dashboard initialParams={emptyParams} />);

    await searchPostcode(user);
    expect(await screen.findByRole('heading', { level: 3, name: '2' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Burglary' }));

    expect(await screen.findByRole('heading', { level: 3, name: '1' })).toBeInTheDocument();
    expect(screen.getByText(/filtered by/i)).toBeInTheDocument();
  });

  it('filters when a category bar in the overview is clicked', async () => {
    const user = userEvent.setup();
    fetchCrimesMock.mockResolvedValue([
      sampleCrime,
      {
        ...sampleCrime,
        id: 2,
        category: 'anti-social-behaviour',
        outcome_status: { category: 'Investigation complete', date: '2026-06' },
      },
    ]);
    renderWithProviders(<Dashboard initialParams={emptyParams} />);

    await searchPostcode(user);
    expect(await screen.findByRole('heading', { level: 3, name: '2' })).toBeInTheDocument();

    const categoryBars = screen.getAllByRole('button', { name: /burglary/i });
    await user.click(categoryBars[0]);

    expect(await screen.findByRole('heading', { level: 3, name: '1' })).toBeInTheDocument();
    expect(screen.getByText(/filtered by/i)).toBeInTheDocument();
  });

  it('filters from the category and status selects in the searched postcodes panel', async () => {
    const user = userEvent.setup();
    fetchCrimesMock.mockResolvedValue([
      sampleCrime,
      {
        ...sampleCrime,
        id: 2,
        category: 'anti-social-behaviour',
        outcome_status: { category: 'Investigation complete', date: '2026-06' },
      },
    ]);
    renderWithProviders(<Dashboard initialParams={emptyParams} />);

    await searchPostcode(user);
    expect(await screen.findByRole('heading', { level: 3, name: '2' })).toBeInTheDocument();

    await user.click(screen.getByLabelText('Category'));
    await user.click(screen.getByRole('option', { name: 'Burglary' }));
    expect(await screen.findByRole('heading', { level: 3, name: '1' })).toBeInTheDocument();

    await user.click(screen.getByLabelText('Status'));
    await user.click(screen.getByRole('option', { name: 'Under investigation' }));
    expect(await screen.findByRole('heading', { level: 3, name: '1' })).toBeInTheDocument();
    expect(screen.getByText(/filtered by/i)).toBeInTheDocument();
  });
});
