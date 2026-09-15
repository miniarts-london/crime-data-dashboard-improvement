import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Home from './page';
import { renderWithProviders } from '@/test/render';
import type { InitialParams } from '@/types/dashboard';

vi.mock('@/components/Dashboard', () => ({
  default: function DashboardMock({ initialParams }: { initialParams: InitialParams }) {
    return (
      <div>
        <p>Dashboard mock</p>
        <p>{initialParams.postcodes.join(',') || 'none'}</p>
        <p>{initialParams.from}</p>
        <p>{initialParams.to}</p>
      </div>
    );
  },
}));

describe('Home page', () => {
  it('passes parsed search params into the dashboard', async () => {
    const ui = await Home({
      params: Promise.resolve({}),
      searchParams: Promise.resolve({
        postcodes: 'SW1A 1AA, not-a-postcode',
        from: '2026-01',
        to: '2026-03',
      }),
    });

    renderWithProviders(ui);

    expect(screen.getByText('Dashboard mock')).toBeInTheDocument();
    expect(screen.getByText('SW1A 1AA')).toBeInTheDocument();
    expect(screen.queryByText(/not-a-postcode/)).not.toBeInTheDocument();
    expect(screen.getByText('2026-01')).toBeInTheDocument();
    expect(screen.getByText('2026-03')).toBeInTheDocument();
  });

  it('defaults missing query params to no postcodes and the current month', async () => {
    const ui = await Home({
      params: Promise.resolve({}),
      searchParams: Promise.resolve({}),
    });

    renderWithProviders(ui);

    expect(screen.getByText('none')).toBeInTheDocument();
    const months = screen.getAllByText(/^\d{4}-\d{2}$/);
    expect(months).toHaveLength(2);
    expect(months[0].textContent).toBe(months[1].textContent);
  });
});
