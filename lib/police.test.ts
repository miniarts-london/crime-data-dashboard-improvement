import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

describe('police API helpers', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('geocodes a matching postcode via the app proxy', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ lat: 51.501, lng: -0.142, label: 'SW1A 1AA' }),
    });

    const { geocodePostcode } = await import('@/lib/police');
    await expect(geocodePostcode('sw1a 1aa')).resolves.toEqual({
      lat: 51.501,
      lng: -0.142,
      label: 'SW1A 1AA',
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/postcode/SW1A%201AA');
  });

  it('reuses a cached geocode result', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ lat: 51.52, lng: -0.14, label: 'W1A 1AA' }),
    });

    const { geocodePostcode } = await import('@/lib/police');
    await geocodePostcode('W1A 1AA');
    await geocodePostcode('W1A 1AA');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('treats an empty crime payload as no crimes for that month', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] });
    const { fetchCrimes } = await import('@/lib/police');
    await expect(fetchCrimes(51.5, -0.12, '2026-01')).resolves.toEqual([]);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/crimes?');
  });

  it('surfaces a 503 from the crime proxy', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: 'too many crimes in this area for one request - try a smaller date range' }),
    });
    const { fetchCrimes } = await import('@/lib/police');
    await expect(fetchCrimes(51.6, -0.13, '2026-02')).rejects.toThrow(/too many crimes/i);
  });

  it('preserves the response status on the thrown error, not just the message', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: 'too many crimes in this area for one request - try a smaller date range' }),
    });
    const { fetchCrimes, ApiError } = await import('@/lib/police');

    await expect(fetchCrimes(51.6, -0.13, '2026-02')).rejects.toMatchObject({
      status: 503,
    });
    // Also directly catchable as the typed error, not just duck-typed.
    try {
      await fetchCrimes(51.6, -0.13, '2026-02');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(503);
    }
  });

  it('preserves a 400 differently from a 5xx', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid lat' }),
    });
    const { geocodePostcode } = await import('@/lib/police');

    await expect(geocodePostcode('nonsense')).rejects.toMatchObject({ status: 400 });
  });
});
