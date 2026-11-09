export type Lang = 'fi' | 'en';

export interface Formatters {
  int(value: number): string;
  /** `null` renders as a dash. */
  pct(value: number | null): string;
  decimal(value: number): string;
  signedInt(value: number): string;
  monthName(month: number): string;
  signed(value: number | null, unit: string): string;
  signedPct(value: number | null): string;
  month(period: string): string;
  date(iso: string): string;
}

const NBSP = String.fromCharCode(0xa0); // non-breaking space keeps "50,3 %" on one line

export function makeFormatters(lang: Lang): Formatters {
  const locale = lang === 'fi' ? 'fi-FI' : 'en-GB';
  const int = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const dec1 = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const monthFmt = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const monthNameFmt = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' });
  const dateFmt = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeZone: 'Europe/Helsinki',
  });
  const percentSuffix = lang === 'fi' ? `${NBSP}%` : '%';

  const signed = (v: number | null, unit: string): string => {
    if (v === null || !Number.isFinite(v)) return '–';
    const sign = v > 0 ? '+' : v < 0 ? '−' : '';
    return `${sign}${dec1.format(Math.abs(v))}${unit}`;
  };

  return {
    int: (v) => int.format(v),
    decimal: (v) => dec1.format(v),
    pct: (v) => (v === null || !Number.isFinite(v) ? '–' : `${dec1.format(v)}${percentSuffix}`),
    signedInt: (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${int.format(Math.abs(v))}`,
    monthName: (month) => monthNameFmt.format(new Date(Date.UTC(2000, month - 1, 1))),
    signedPct: (v) => signed(v, percentSuffix),
    signed,
    month: (period) => monthFmt.format(new Date(`${period}-01T00:00:00Z`)),
    date: (iso) => dateFmt.format(new Date(iso)),
  };
}
