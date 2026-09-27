import { describe, expect, it } from 'vitest';
import { clearQueryString, dedupeCrimes, normalize, parseSearchParams, updateQueryString } from '@/components/Helper';
import type { RawCrime } from '@/types/dashboard';

describe('parseSearchParams', () => {
  it('reads valid postcodes and dates from a query record', () => {
    expect(
      parseSearchParams({
        postcodes: 'SW1A 1AA, hello',
        from: '2026-01',
        to: '2026-03',
      })
    ).toEqual({
      postcodes: ['SW1A 1AA'],
      from: '2026-01',
      to: '2026-03',
    });
  });

  it('defaults missing dates to the current month', () => {
    const params = parseSearchParams(new URLSearchParams());
    expect(params.postcodes).toEqual([]);
    expect(params.from).toMatch(/^\d{4}-\d{2}$/);
    expect(params.to).toBe(params.from);
  });
});

describe('query string helpers', () => {
  it('writes postcodes and dates into the URL', () => {
    updateQueryString(['SW1A 1AA'], '2026-01', '2026-03');
    expect(window.location.search).toBe('?postcodes=SW1A+1AA&from=2026-01&to=2026-03');
  });

  it('clears the query string', () => {
    updateQueryString(['SW1A 1AA'], '2026-01', '2026-03');
    clearQueryString();
    expect(window.location.search).toBe('');
  });
});

describe('normalize', () => {
  it('maps a raw police crime onto a dashboard row', () => {
    const raw: RawCrime = {
      category: 'burglary',
      id: 9,
      month: '2026-06',
      location: {
        latitude: '51.501',
        longitude: '-0.142',
        street: { id: 1, name: 'On or near Whitehall' },
      },
      outcome_status: { category: 'Under investigation', date: '2026-06' },
    };

    expect(normalize([raw], 'SW1A 1AA')[0]).toMatchObject({
      id: '9',
      postcodes: ['SW1A 1AA'],
      hasLocation: true,
      lat: 51.501,
      lng: -0.142,
      category: 'burglary',
      bucket: 'burglary',
      street: 'Whitehall',
      month: '2026-06',
      outcome: 'Under investigation',
    });
  });

  it('handles crimes with no location or outcome', () => {
    const raw: RawCrime = {
      category: 'other-theft',
      persistent_id: 'abc',
      month: '2026-06',
      location: null,
    };

    expect(normalize([raw], 'EC1A 1BB')[0]).toMatchObject({
      id: 'abc',
      hasLocation: false,
      lat: null,
      lng: null,
      street: 'Unknown location',
      outcome: 'No outcome recorded yet',
      bucket: 'other-theft',
    });
  });
});

describe('dedupeCrimes', () => {
  const raw = (id: number, category = 'burglary'): RawCrime => ({
    category,
    id,
    month: '2026-06',
    location: { latitude: '51.501', longitude: '-0.142' },
  });

  it('merges a crime found by two overlapping postcode searches into one row', () => {
    const rows = [
      ...normalize([raw(1), raw(2)], 'SW1A 1AA'),
      ...normalize([raw(2), raw(3)], 'SW1A 2AA'),
    ];

    const crimes = dedupeCrimes(rows);

    expect(crimes.map((c) => c.id)).toEqual(['1', '2', '3']);
    expect(crimes.find((c) => c.id === '2')?.postcodes).toEqual(['SW1A 1AA', 'SW1A 2AA']);
    expect(crimes.find((c) => c.id === '1')?.postcodes).toEqual(['SW1A 1AA']);
  });

  it('does not list the same postcode twice or mutate its input', () => {
    const rows = normalize([raw(5), raw(5)], 'SW1A 1AA');

    const crimes = dedupeCrimes(rows);

    expect(crimes).toHaveLength(1);
    expect(crimes[0].postcodes).toEqual(['SW1A 1AA']);
    expect(rows[0].postcodes).toEqual(['SW1A 1AA']);
  });

  it('never merges crimes that have no id', () => {
    const noId: RawCrime = { category: 'other-theft', month: '2026-06', location: null };

    expect(dedupeCrimes(normalize([noId, noId], 'EC1A 1BB'))).toHaveLength(2);
  });
});

