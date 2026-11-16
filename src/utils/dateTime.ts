/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Asia/Karachi Date & Time Utilities
 */

export function formatKarachiDate(iso?: string | null, lang: 'en' | 'ur' = 'en'): string {
  if (!iso) return lang === 'ur' ? '—' : '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  try {
    return new Intl.DateTimeFormat(lang === 'ur' ? 'ur-PK' : 'en-PK', {
      timeZone: 'Asia/Karachi',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}

export function formatKarachiDateTime(iso?: string | null, lang: 'en' | 'ur' = 'en'): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  try {
    return (
      new Intl.DateTimeFormat(lang === 'ur' ? 'ur-PK' : 'en-PK', {
        timeZone: 'Asia/Karachi',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(date) + ' PKT'
    );
  } catch {
    return date.toLocaleString();
  }
}
