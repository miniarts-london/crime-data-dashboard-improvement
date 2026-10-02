import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCrimes } from '@/lib/useCrimes';
import { fetchCrimes, geocodePostcode } from '@/lib/police';
import type { RawCrime } from '@/types/dashboard';
import { createQueryWrapper } from '@/test/render';

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

  it('counts a crime found by two nearby postcodes once, tagged with both', async () => {
    geocodePostcodeMock.mockImplementation(async (pc) => ({ lat: 51.501, lng: -0.142, label: pc }));
    const { result } = renderHook(() => useCrimes(), { wrapper: createQueryWrapper() });

    await act(() => result.current.search(['SW1A 1AA', 'SW1A 2AA'], '2026-06', '2026-06'));

    // Both postcodes geocode to the same point here, so the two crime
    // requests share one query key and TanStack makes the call only once.
    expect(fetchCrimesMock).toHaveBeenCalledTimes(1);
    expect(result.current.crimes).toHaveLength(1);
    expect(result.current.crimes[0].postcodes).toEqual(expect.arrayContaining(['SW1A 1AA', 'SW1A 2AA']));
  });

  it('geocodes, fetches each month and fires callbacks', async () => {
    const onSearchStart = vi.fn();
    const onGeocoded = vi.fn();
    // Each month is a different crime with its own id, as the real API returns.
    fetchCrimesMock.mockImplementation(async (_lat, _lng, month) => [
      { ...sampleCrime, id: month === '2026-05' ? 1 : 2, month: month ?? '2026-06' },
    ]);
    const { result } = renderHook(() => useCrimes({ onSearchStart, onGeocoded }), { wrapper: createQueryWrapper() });

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
    const { result } = renderHook(() => useCrimes({ onSearchStart }), { wrapper: createQueryWrapper() });

    await act(() => result.current.search(['SW1A 1AA'], '2020-01', '2026-06'));

    expect(result.current.error).toMatch(/postcode\/month combinations/);
    expect(geocodePostcodeMock).not.toHaveBeenCalled();
    expect(onSearchStart).not.toHaveBeenCalled();
  });

  it('reports an error when no postcode geocodes', async () => {
    geocodePostcodeMock.mockRejectedValue(new Error('Postcode not found'));
    const onGeocoded = vi.fn();
    const { result } = renderHook(() => useCrimes({ onGeocoded }), { wrapper: createQueryWrapper() });

    await act(() => result.current.search(['ZZ1 1ZZ'], '2026-06', '2026-06'));

    expect(result.current.error).toMatch(/Couldn't find any of the entered postcodes/);
    expect(result.current.crimes).toEqual([]);
    expect(fetchCrimesMock).not.toHaveBeenCalled();
    expect(onGeocoded).not.toHaveBeenCalled();
  });

  it('reports partial failures but keeps successful rows', async () => {
    fetchCrimesMock.mockResolvedValueOnce([sampleCrime]).mockRejectedValueOnce(new Error('HTTP 502'));
    const { result } = renderHook(() => useCrimes(), { wrapper: createQueryWrapper() });

    await act(() => result.current.search(['SW1A 1AA'], '2026-05', '2026-06'));

    expect(result.current.crimes).toHaveLength(1);
    expect(result.current.error).toMatch(/Some requests had issues: .*HTTP 502/);
  });

  it('a superseded search never overwrites the latest results', async () => {
    let finishFirstGeocode!: () => void;
    geocodePostcodeMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishFirstGeocode = () => resolve({ lat: 51.52, lng: -0.1, label: 'EC1A 1BB' });
        })
    );
    const onGeocoded = vi.fn();
    const { result } = renderHook(() => useCrimes({ onGeocoded }), { wrapper: createQueryWrapper() });

    let first!: Promise<void>;
    act(() => {
      first = result.current.search(['EC1A 1BB'], '2026-06', '2026-06');
    });
    await act(() => result.current.search(['SW1A 1AA'], '2026-06', '2026-06'));
    await act(() => first);

    // The first search's geocode finishes late: its search was cancelled,
    // so it changes nothing.
    await act(async () => finishFirstGeocode());

    expect(result.current.searchPoints.map((p) => p.postcode)).toEqual(['SW1A 1AA']);
    expect(result.current.error).toBe('');
    expect(onGeocoded).toHaveBeenCalledTimes(1);
    expect(onGeocoded).toHaveBeenCalledWith(['SW1A 1AA']);
  });

  it('serves a repeated search from the cache without new requests', async () => {
    const onGeocoded = vi.fn();
    const { result } = renderHook(() => useCrimes({ onGeocoded }), { wrapper: createQueryWrapper() });

    await act(() => result.current.search(['SW1A 1AA'], '2026-06', '2026-06'));
    await act(() => result.current.search(['SW1A 1AA'], '2026-06', '2026-06'));

    expect(geocodePostcodeMock).toHaveBeenCalledTimes(1);
    expect(fetchCrimesMock).toHaveBeenCalledTimes(1);
    expect(result.current.crimes).toHaveLength(1);
    // History is still updated for the repeated search.
    expect(onGeocoded).toHaveBeenCalledTimes(2);
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
    const { result } = renderHook(() => useCrimes(), { wrapper: createQueryWrapper() });

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
    const { result } = renderHook(() => useCrimes(), { wrapper: createQueryWrapper() });
    await act(() => result.current.search(['SW1A 1AA'], '2020-01', '2026-06'));
    expect(result.current.error).not.toBe('');

    act(() => result.current.clearError());

    expect(result.current.error).toBe('');
  });
  describe('status', () => {
    it('goes idle -> loading -> success for a first search', async () => {
      let finishGeocode!: () => void;
      geocodePostcodeMock.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishGeocode = () => resolve({ lat: 51.501, lng: -0.142, label: 'SW1A 1AA' });
          })
      );
      const { result } = renderHook(() => useCrimes(), { wrapper: createQueryWrapper() });
      expect(result.current.status).toBe('idle');

      let done!: Promise<void>;
      act(() => {
        done = result.current.search(['SW1A 1AA'], '2026-06', '2026-06');
      });
      await waitFor(() => expect(result.current.status).toBe('loading'));

      await act(async () => finishGeocode());
      await act(() => done);
      expect(result.current.status).toBe('success');
      expect(result.current.crimes).toHaveLength(1);
    });

    it('is refreshing, with the previous results kept, while a new search runs', async () => {
      const { result } = renderHook(() => useCrimes(), { wrapper: createQueryWrapper() });
      await act(() => result.current.search(['SW1A 1AA'], '2026-06', '2026-06'));

      let finishGeocode!: () => void;
      geocodePostcodeMock.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishGeocode = () => resolve({ lat: 51.52, lng: -0.1, label: 'EC1A 1BB' });
          })
      );
      let done!: Promise<void>;
      act(() => {
        done = result.current.search(['EC1A 1BB'], '2026-06', '2026-06');
      });
      await waitFor(() => expect(result.current.status).toBe('refreshing'));
      expect(result.current.searchPoints.map((p) => p.postcode)).toEqual(['SW1A 1AA']);

      await act(async () => finishGeocode());
      await act(() => done);
      expect(result.current.status).toBe('success');
      expect(result.current.searchPoints.map((p) => p.postcode)).toEqual(['EC1A 1BB']);
    });

    it('is error when the search fails, and retry runs it again', async () => {
      geocodePostcodeMock.mockRejectedValueOnce(new Error('Postcode not found'));
      const { result } = renderHook(() => useCrimes(), { wrapper: createQueryWrapper() });

      await act(() => result.current.search(['SW1A 1AA'], '2026-06', '2026-06'));
      expect(result.current.status).toBe('error');
      // A failed search isn't silently fetched a second time.
      expect(geocodePostcodeMock).toHaveBeenCalledTimes(1);
      expect(result.current.canRetry).toBe(true);

      act(() => result.current.retry());
      await waitFor(() => expect(result.current.status).toBe('success'));
      expect(geocodePostcodeMock).toHaveBeenCalledTimes(2);
      expect(result.current.crimes).toHaveLength(1);
      expect(result.current.error).toBe('');
    });

    it('is error but not retryable for a search over MAX_REQUESTS', async () => {
      const { result } = renderHook(() => useCrimes(), { wrapper: createQueryWrapper() });

      await act(() => result.current.search(['SW1A 1AA'], '2020-01', '2026-06'));

      expect(result.current.status).toBe('error');
      expect(result.current.canRetry).toBe(false);
    });

    it('goes back to idle after reset', async () => {
      const { result } = renderHook(() => useCrimes(), { wrapper: createQueryWrapper() });
      await act(() => result.current.search(['SW1A 1AA'], '2026-06', '2026-06'));
      expect(result.current.status).toBe('success');

      act(() => result.current.reset());

      expect(result.current.status).toBe('idle');
    });
  });
});
