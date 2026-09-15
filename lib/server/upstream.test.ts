import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

describe('upstream police/postcode APIs', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('geocodes a matching postcode from getthedata', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'match',
        data: { postcode: 'SW1A 1AA', latitude: '51.501', longitude: '-0.142' },
      }),
    });

    const { geocodePostcodeUpstream } = await import('@/lib/server/upstream');
    await expect(geocodePostcodeUpstream('SW1A 1AA')).resolves.toEqual({
      lat: 51.501,
      lng: -0.142,
      label: 'SW1A 1AA',
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('api.getthedata.com/postcode/SW1A%201AA');
  });

  it('treats a 404 crime response as an empty month', async () => {
    fetchMock.mockResolvedValue({ status: 404, ok: false, json: async () => null });
    const { fetchCrimesUpstream } = await import('@/lib/server/upstream');
    await expect(fetchCrimesUpstream(51.5, -0.12, '2026-01')).resolves.toEqual([]);
  });

  it('explains a 503 crime response', async () => {
    fetchMock.mockResolvedValue({ status: 503, ok: false, json: async () => null });
    const { fetchCrimesUpstream } = await import('@/lib/server/upstream');
    await expect(fetchCrimesUpstream(51.6, -0.13, '2026-02')).rejects.toThrow(/too many crimes/i);
  });
});
