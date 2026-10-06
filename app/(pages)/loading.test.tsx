import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Loading from './loading';
import { renderWithProviders } from '@/test/render';

describe('Loading', () => {
  it('tells screen readers the dashboard is loading', () => {
    renderWithProviders(<Loading />);

    expect(screen.getByRole('status', { name: 'Loading dashboard' })).toBeInTheDocument();
  });
});
