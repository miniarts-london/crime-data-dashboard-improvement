import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CrimeOverview from '@/components/CrimeOverview';
import { renderWithProviders } from '@/test/render';

vi.mock('@/components/ContextRoot/Providers', () => ({
  useColorMode: () => ({ mode: 'light', toggleColorMode: vi.fn() }),
}));

describe('CrimeOverview', () => {
  it('shows the empty state before a search', () => {
    renderWithProviders(
      <CrimeOverview total={0} categoryCounts={{}} outcomeCounts={{}} />
    );

    expect(screen.getByRole('heading', { level: 3, name: '0' })).toBeInTheDocument();
    expect(screen.getAllByText('No data yet - run a search above.')).toHaveLength(2);
  });

  it('shows totals with category and outcome breakdowns', () => {
    renderWithProviders(
      <CrimeOverview
        total={3}
        categoryCounts={{ burglary: 2, 'anti-social-behaviour': 1 }}
        outcomeCounts={{ 'Under investigation': 3 }}
      />
    );

    expect(screen.getByRole('heading', { level: 3, name: '3' })).toBeInTheDocument();
    expect(screen.getByText('Burglary')).toBeInTheDocument();
    expect(screen.getByText('Anti-social behaviour')).toBeInTheDocument();
    expect(screen.getByText('Under investigation')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('requests a quick filter when a category or outcome bar is clicked', async () => {
    const user = userEvent.setup();
    const onQuickFilter = vi.fn();
    renderWithProviders(
      <CrimeOverview
        total={3}
        categoryCounts={{ burglary: 2 }}
        outcomeCounts={{ 'Under investigation': 3 }}
        onQuickFilter={onQuickFilter}
        activeFilters={{ postcode: null, category: null, outcome: null }}
      />
    );

    await user.click(screen.getByRole('button', { name: /burglary/i }));
    await user.click(screen.getByRole('button', { name: /under investigation/i }));

    expect(onQuickFilter).toHaveBeenCalledWith('category', 'burglary');
    expect(onQuickFilter).toHaveBeenCalledWith('outcome', 'Under investigation');
  });
});
