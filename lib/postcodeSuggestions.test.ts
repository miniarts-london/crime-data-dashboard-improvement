import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

function queryFromCall(call: unknown[]): string {
  const url = String(call[0]);
  const q = new URL(url, 'http://localhost').searchParams.get('q') ?? '';
  return decodeURIComponent(q);
}

describe('suggestPostcodes', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('returns prefix matches for a partial outcode', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ result: ['EN10 6AA', 'EN10 6AB'] }),
    });

    const { suggestPostcodes } = await import('@/lib/postcodeSuggestions');
    await expect(suggestPostcodes('en1')).resolves.toEqual(['EN10 6AA', 'EN10 6AB']);
    expect(queryFromCall(fetchMock.mock.calls[0] ?? [])).toBe('EN1');
  });

  it('after a trailing space, returns postcodes for that outcode rather than EN10', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const query = decodeURIComponent(new URL(String(url), 'http://localhost').searchParams.get('q') ?? '');
      const result = query === 'EN1 1A'
        ? ['EN1 1AA', 'EN1 1AL']
        : query === 'EN1 2A'
          ? ['EN1 2AA']
          : [];
      return { ok: true, json: async () => ({ result }) };
    });

    const { suggestPostcodes } = await import('@/lib/postcodeSuggestions');
    await expect(suggestPostcodes('en1 ')).resolves.toEqual(['EN1 1AA', 'EN1 1AL', 'EN1 2AA']);
  });
});
