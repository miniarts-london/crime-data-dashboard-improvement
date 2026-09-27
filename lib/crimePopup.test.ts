import { describe, expect, it } from 'vitest';
import { crimePopupHtml } from '@/lib/crimePopup';
import type { CrimeRecord } from '@/types/dashboard';

const crime: CrimeRecord = {
  id: '1',
  postcodes: ['SW1A 1AA'],
  hasLocation: true,
  lat: 51.5,
  lng: -0.14,
  category: 'burglary',
  bucket: 'burglary',
  street: 'Whitehall',
  month: '2026-07',
  outcome: 'Under investigation',
};

describe('crimePopupHtml', () => {
  it('includes the crime details used in marker popups', () => {
    const html = crimePopupHtml(crime);
    expect(html).toContain('Burglary');
    expect(html).toContain('SW1A 1AA');
    expect(html).toContain('Whitehall');
    expect(html).toContain('Jul 2026');
    expect(html).toContain('Under investigation');
  });

  it('escapes HTML in crime fields', () => {
    const html = crimePopupHtml({ ...crime, street: '<script>alert(1)</script>' });
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('lists every postcode a crime was found near', () => {
    const html = crimePopupHtml({ ...crime, postcodes: ['SW1A 1AA', 'SW1A 2AA'] });
    expect(html).toContain('SW1A 1AA, SW1A 2AA');
  });

  it('does not throw when postcodes is missing at runtime', () => {
    const broken = { ...crime, postcodes: undefined } as unknown as CrimeRecord;
    expect(crimePopupHtml(broken)).toContain('Postcode:');
  });
});
