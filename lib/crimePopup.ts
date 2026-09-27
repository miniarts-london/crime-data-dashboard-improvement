import dayjs from 'dayjs';
import { categoryLabel } from '@/lib/theme';
import type { CrimeRecord } from '@/types/dashboard';

function escapeHtml(value: string | null | undefined): string {
  return (value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function crimePopupHtml(crime: CrimeRecord): string {
  const postcodes = (crime.postcodes ?? []).join(', ');
  return `<div class="crime-popup">
      <strong>${escapeHtml(categoryLabel(crime.category))}</strong>
      <div class="crime-popup-meta">
        Postcode: ${escapeHtml(postcodes)}<br />
        Street: ${escapeHtml(crime.street)}<br />
        Month: ${escapeHtml(dayjs(`${crime.month}-01`).format('MMM YYYY'))}<br />
        Outcome: ${escapeHtml(crime.outcome)}
      </div>
    </div>`;
}
