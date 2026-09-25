import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCrimes } from '@/lib/useCrimes';
import { fetchCrimes, geocodePostcode } from '@/lib/police';
import type { RawCrime } from '@/types/dashboard';

vi.mock('@/lib/police', () => ({
  geocodePostcode: vi.fn(),
  fetchCrimes: vi.fn(),
}));

const geocodePostcodeMock = vi.mocked(geocodePostcode);
const fetchCrimesMock = vi.mocked(fetchCrimes);

const sampleCrime: RawCrime = {
  category: 'burglary',
  id: 1,
  month: '2026-06',
  location: { latitude: '51.501', longitude: '-0.142', street: { id: 1, name: 'On or near Whitehall' } },
  outcome_status: { category: 'Under investigation', date: '2026-06' },
};

describe('useCrimes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    geocodePostcodeMock.mockResolvedValue({ lat: 51.501, lng: -0.142, label: 'SW1A 1AA' });
    fetchCrimesMock.mockResolvedValue([sampleCrime]);
  });

  it('geocodes, fetches each month and fires callbacks', async () => {
    const onSearchStart = vi.fn();
    const onGeocoded = vi.fn();
    const { result } = renderHook(() => useCrimes({ onSearchStart, onGeocoded }));

    await act(() => result.current.search(['SW1A 1AA'], '2026-05', '2026-06'));

    expect(fetchCrimesMock).toHaveBeenCalledTimes(2);
    expect(result.current.crimes).toHaveLength(2);
    expect(result.current.searchPoints).toEqual([{ postcode: 'SW1A 1AA', lat: 51.501, lng: -0.142 }]);
    expect(result.current.loading).toBe(false);
    expect(result.current.progress).toBeNull();
    expect(result.current.error).toBe('');
    expect(onSearchStart).toHaveBeenCalledWith(['SW1A 1AA'], '2026-05', '2026-06');
    expect(onGeocoded).toHaveBeenCalledWith(['SW1A 1AA']);
  });

  it('rejects searches over MAX_REQUESTS without fetching', async () => {
    const onSearchStart = vi.fn();
    const { result } = renderHook(() => useCrimes({ onSearchStart }));

    await act(() => result.current.search(['SW1A 1AA'], '2020-01', '2026-06'));

    expect(result.current.error).toMatch(/postcode\/month combinations/);
    expect(geocodePostcodeMock).not.toHaveBeenCalled();
    expect(onSearchStart).not.toHaveBeenCalled();
  });

  it('reports an error when no postcode geocodes', async () => {
    geocodePostcodeMock.mockRejectedValue(new Error('Postcode not found'));
    const onGeocoded = vi.fn();
    const { result } = renderHook(() => useCrimes({ onGeocoded }));

    await act(() => result.current.search(['ZZ1 1ZZ'], '2026-06', '2026-06'));

    expect(result.current.error).toMatch(/Couldn't find any of the entered postcodes/);
    expect(result.current.crimes).toEqual([]);
    expect(fetchCrimesMock).not.toHaveBeenCalled();
    expect(onGeocoded).not.toHaveBeenCalled();
  });

  it('reports partial failures but keeps successful rows', async () => {
    fetchCrimesMock.mockResolvedValueOnce([sampleCrime]).mockRejectedValueOnce(new Error('HTTP 502'));
    const { result } = renderHook(() => useCrimes());

    await act(() => result.current.search(['SW1A 1AA'], '2026-05', '2026-06'));

    expect(result.current.crimes).toHaveLength(1);
    expect(result.current.error).toMatch(/Some requests had issues: .*HTTP 502/);
  });

  it('aborts a superseded search and keeps only the latest results', async () => {
    let firstSignal: AbortSignal | undefined;
    geocodePostcodeMock.mockImplementationOnce(
      (_pc, signal) =>
        new Promise((_resolve, reject) => {
          firstSignal = signal;
          signal?.addEventListener('abort', () => reject(new Error('aborted')));
        })
    );
    const { result } = renderHook(() => useCrimes());

    let first!: Promise<void>;
    act(() => {
      first = result.current.search(['EC1A 1BB'], '2026-06', '2026-06');
    });
    await act(() => result.current.search(['SW1A 1AA'], '2026-06', '2026-06'));
    await act(() => first);

    expect(firstSignal?.aborted).toBe(true);
    expect(result.current.searchPoints.map((p) => p.postcode)).toEqual(['SW1A 1AA']);
    expect(result.current.error).toBe('');
  });

  it('reset clears results and aborts in-flight requests', async () => {
    let signal: AbortSignal | undefined;
    geocodePostcodeMock.mockImplementationOnce(
      (_pc, s) =>
        new Promise((_resolve, reject) => {
          signal = s;
          s?.addEventListener('abort', () => reject(new Error('aborted')));
        })
    );
    const { result } = renderHook(() => useCrimes());

    act(() => {
      void result.current.search(['SW1A 1AA'], '2026-06', '2026-06');
    });
    await waitFor(() => expect(result.current.loading).toBe(true));

    act(() => result.current.reset());

    expect(signal?.aborted).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.crimes).toEqual([]);
    expect(result.current.searchPoints).toEqual([]);
  });

  it('clearError clears the error message', async () => {
    const { result } = renderHook(() => useCrimes());
    await act(() => result.current.search(['SW1A 1AA'], '2020-01', '2026-06'));
    expect(result.current.error).not.toBe('');

    act(() => result.current.clearError());

    expect(result.current.error).toBe('');
  });
});
