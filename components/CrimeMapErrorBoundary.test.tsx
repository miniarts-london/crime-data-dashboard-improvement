import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CrimeMapErrorBoundary from '@/components/CrimeMapErrorBoundary';
import { renderWithProviders } from '@/test/render';

let shouldThrow = true;

function FlakyMap() {
  if (shouldThrow) throw new Error('Leaflet exploded');
  return <div>Map rendered</div>;
}

describe('CrimeMapErrorBoundary', () => {
  beforeEach(() => {
    shouldThrow = true;
    // React logs caught render errors; keep test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when nothing throws', () => {
    shouldThrow = false;
    renderWithProviders(
      <CrimeMapErrorBoundary>
        <FlakyMap />
      </CrimeMapErrorBoundary>
    );

    expect(screen.getByText('Map rendered')).toBeInTheDocument();
  });

  it('shows a fallback without taking down siblings, and recovers on retry', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <CrimeMapErrorBoundary>
          <FlakyMap />
        </CrimeMapErrorBoundary>
        <div>Crime table</div>
      </>
    );

    expect(screen.getByRole('alert')).toHaveTextContent("The map couldn't be displayed");
    expect(screen.getByText('Crime table')).toBeInTheDocument();

    shouldThrow = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Map rendered')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
