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

  it('drops malformed crime records but keeps the valid ones', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const valid = {
      category: 'burglary',
      id: 1,
      month: '2026-01',
      location: { latitude: '51.5', longitude: '-0.12', street: { id: 1, name: 'On or near High St' } },
      outcome_status: null,
      context: 'stripped',
    };
    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => [valid, { category: 42, month: '2026-01', location: null }],
    });

    const { fetchCrimesUpstream } = await import('@/lib/server/upstream');
    const crimes = await fetchCrimesUpstream(51.5, -0.12, '2026-01');

    expect(crimes).toHaveLength(1);
    expect(crimes[0]).not.toHaveProperty('context');
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/Dropped 1 of 2/), expect.any(String));
    warn.mockRestore();
  });

  it('rejects a crime response that is not an array', async () => {
    fetchMock.mockResolvedValue({ status: 200, ok: true, json: async () => ({ oops: true }) });
    const { fetchCrimesUpstream } = await import('@/lib/server/upstream');
    await expect(fetchCrimesUpstream(51.5, -0.12, '2026-03')).rejects.toMatchObject({ status: 502 });
  });

  it('treats a match with unusable coordinates as not found', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'match',
        data: { postcode: 'SW1A 1AA', latitude: '', longitude: 'abc' },
      }),
    });
    const { geocodePostcodeUpstream } = await import('@/lib/server/upstream');
    await expect(geocodePostcodeUpstream('SW1A 1AA')).rejects.toThrow('Postcode not found');
  });

  it('returns no suggestions for a malformed autocomplete response', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ result: [1, 2, 3] }) });
    const { autocompletePostcodesUpstream } = await import('@/lib/server/upstream');
    await expect(autocompletePostcodesUpstream('SW1')).resolves.toEqual([]);
  });
});
