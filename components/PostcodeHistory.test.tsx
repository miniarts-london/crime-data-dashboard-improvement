import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PostcodeHistory, { type FilterOption } from '@/components/PostcodeHistory';
import { renderWithProviders } from '@/test/render';

const categoryOptions: FilterOption[] = [
  { value: 'burglary', label: 'Burglary' },
  { value: 'anti-social-behaviour', label: 'Anti-social behaviour' },
];
const statusOptions: FilterOption[] = [
  { value: 'Under investigation', label: 'Under investigation' },
  { value: 'Investigation complete', label: 'Investigation complete' },
];

const filterProps = {
  categoryOptions: [] as FilterOption[],
  statusOptions: [] as FilterOption[],
  category: null as string | null,
  status: null as string | null,
  onCategoryChange: vi.fn(),
  onStatusChange: vi.fn(),
};

describe('PostcodeHistory', () => {
  it('shows an empty state when nothing has been searched', () => {
    renderWithProviders(
      <PostcodeHistory entries={[]} onSelect={vi.fn()} onRemove={vi.fn()} {...filterProps} />
    );

    expect(screen.getByText('Searched postcodes')).toBeInTheDocument();
    expect(screen.getByText('Postcodes you search will appear here.')).toBeInTheDocument();
    expect(screen.getByLabelText('Category')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByLabelText('Status')).toHaveAttribute('aria-disabled', 'true');
  });

  it('lists searched postcode chips', () => {
    renderWithProviders(
      <PostcodeHistory
        entries={[{ postcode: 'SW1A 1AA', lastSearchedAt: '2026-07-01T00:00:00.000Z' }]}
        onSelect={vi.fn()}
        onRemove={vi.fn()}
        {...filterProps}
      />
    );

    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'SW1A 1AA' })).toBeInTheDocument();
  });

  it('selects a postcode when its chip is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithProviders(
      <PostcodeHistory
        entries={[{ postcode: 'SW1A 1AA', lastSearchedAt: '2026-07-01T00:00:00.000Z' }]}
        onSelect={onSelect}
        onRemove={vi.fn()}
        {...filterProps}
      />
    );

    await user.click(screen.getByRole('button', { name: 'SW1A 1AA' }));
    expect(onSelect).toHaveBeenCalledWith('SW1A 1AA');
  });

  it('removes a postcode from history', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    renderWithProviders(
      <PostcodeHistory
        entries={[{ postcode: 'SW1A 1AA', lastSearchedAt: '2026-07-01T00:00:00.000Z' }]}
        onSelect={vi.fn()}
        onRemove={onRemove}
        {...filterProps}
      />
    );

    await user.click(screen.getByTestId('CancelIcon'));
    expect(onRemove).toHaveBeenCalledWith('SW1A 1AA');
  });

  it('filters by category and status from the panel selects', async () => {
    const user = userEvent.setup();
    const onCategoryChange = vi.fn();
    const onStatusChange = vi.fn();
    renderWithProviders(
      <PostcodeHistory
        entries={[{ postcode: 'SW1A 1AA', lastSearchedAt: '2026-07-01T00:00:00.000Z' }]}
        onSelect={vi.fn()}
        onRemove={vi.fn()}
        categoryOptions={categoryOptions}
        statusOptions={statusOptions}
        category={null}
        status={null}
        onCategoryChange={onCategoryChange}
        onStatusChange={onStatusChange}
      />
    );

    await user.click(screen.getByLabelText('Category'));
    await user.click(screen.getByRole('option', { name: 'Burglary' }));
    expect(onCategoryChange).toHaveBeenCalledWith('burglary');

    await user.click(screen.getByLabelText('Status'));
    await user.click(screen.getByRole('option', { name: 'Under investigation' }));
    expect(onStatusChange).toHaveBeenCalledWith('Under investigation');
  });
});
