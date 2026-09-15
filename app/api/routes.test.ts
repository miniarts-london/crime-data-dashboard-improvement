import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as getPostcode } from '@/app/api/postcode/[postcode]/route';
import { GET as getCrimes } from '@/app/api/crimes/route';

const fetchMock = vi.fn();

describe('API route handlers', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects an invalid postcode before calling getthedata', async () => {
    const res = await getPostcode(new Request('http://localhost/api/postcode/not-a-postcode'), {
      params: Promise.resolve({ postcode: 'not-a-postcode' }),
    });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('proxies a matching postcode as lat/lng', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'match',
        data: { postcode: 'SW1A 1AA', latitude: '51.501', longitude: '-0.142' },
      }),
    });

    const res = await getPostcode(new Request('http://localhost/api/postcode/SW1A%201AA'), {
      params: Promise.resolve({ postcode: 'SW1A 1AA' }),
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ lat: 51.501, lng: -0.142, label: 'SW1A 1AA' });
  });

  it('rejects a crime request with a bad latitude', async () => {
    const res = await getCrimes(new Request('http://localhost/api/crimes?lat=999&lng=0&date=2026-01'));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns an empty list when police.uk has no month', async () => {
    fetchMock.mockResolvedValue({ status: 404, ok: false, json: async () => null });
    const res = await getCrimes(new Request('http://localhost/api/crimes?lat=51.5&lng=-0.12&date=2026-01'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([]);
  });
});
