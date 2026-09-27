import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CrimeTable from '@/components/CrimeTable';
import { renderWithProviders } from '@/test/render';
import type { CrimeRecord, QuickFilters } from '@/types/dashboard';

vi.mock('@/components/ContextRoot/Providers', () => ({
  useColorMode: () => ({ mode: 'light', toggleColorMode: vi.fn() }),
}));

const crime: CrimeRecord = {
  id: '1',
  postcodes: ['SW1A 1AA'],
  hasLocation: true,
  lat: 51.5,
  lng: -0.14,
  category: 'burglary',
  bucket: 'burglary',
  street: 'Whitehall',
  month: '2026-06',
  outcome: 'Under investigation',
};

const noFilters: QuickFilters = { postcode: null, category: null, outcome: null };

describe('CrimeTable', () => {
  it('renders crime rows', () => {
    renderWithProviders(
      <CrimeTable crimes={[crime]} onQuickFilter={vi.fn()} activeFilters={noFilters} />
    );

    expect(screen.getByText('SW1A 1AA')).toBeInTheDocument();
    expect(screen.getByText('Whitehall')).toBeInTheDocument();
    expect(screen.getByText('Jun 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Burglary' })).toBeInTheDocument();
    expect(screen.getByText('Under investigation')).toBeInTheDocument();
  });

  it('requests a quick filter when a postcode, type, or outcome is clicked', async () => {
    const user = userEvent.setup();
    const onQuickFilter = vi.fn();
    renderWithProviders(
      <CrimeTable crimes={[crime]} onQuickFilter={onQuickFilter} activeFilters={noFilters} />
    );

    await user.click(screen.getByText('SW1A 1AA'));
    await user.click(screen.getByRole('button', { name: 'Burglary' }));
    await user.click(screen.getByText('Under investigation'));

    expect(onQuickFilter).toHaveBeenCalledWith('postcode', 'SW1A 1AA');
    expect(onQuickFilter).toHaveBeenCalledWith('category', 'burglary');
    expect(onQuickFilter).toHaveBeenCalledWith('outcome', 'Under investigation');
  });
});
