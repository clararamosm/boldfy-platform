import { ptBR } from 'date-fns/locale/pt-BR';
import { enUS } from 'date-fns/locale/en-US';
import { format as dateFnsFormat, type Locale as DateFnsLocale } from 'date-fns';
import type { Locale } from './types';

// ─── Format constants ────────────────────────────────────────
// Centralizes format strings so we don't scatter magic strings across files.

export const DATE_FORMATS = {
  /** dd/MM/yyyy — e.g. 15/03/2025 */
  DISPLAY: 'dd/MM/yyyy',
  /** HH:mm — e.g. 14:30 */
  TIME: 'HH:mm',
  /** dd/MM HH:mm — e.g. 15/03 14:30 */
  DATETIME_SHORT: 'dd/MM HH:mm',
  /** MMMM yyyy — e.g. março 2025 (locale-aware) */
  MONTH_YEAR: 'MMMM yyyy',
  /** yyyy-MM-dd — ISO date for inputs and keys */
  ISO_DATE: 'yyyy-MM-dd',
  /** d — day of month, e.g. 5 */
  DAY: 'd',
  /** dd/MM — short date, e.g. 15/03 */
  SHORT_DATE: 'dd/MM',
} as const;

// ─── Firestore timestamp helper ──────────────────────────────
// Safely converts Firestore Timestamps, ISO strings, or Date objects to JS Date.

type FirestoreTimestampLike = { toDate: () => Date };

export function toSafeDate(
  d: Date | string | FirestoreTimestampLike | null | undefined,
): Date | null {
  if (!d) return null;
  if (d instanceof Date) return d;
  if (typeof d === 'string') return new Date(d);
  if (typeof d === 'object' && 'toDate' in d && typeof d.toDate === 'function') {
    return d.toDate();
  }
  return null;
}

const DATE_LOCALE_MAP: Record<Locale, DateFnsLocale> = {
  'pt-BR': ptBR,
  'en': enUS,
};

/** Retorna o locale do date-fns correspondente */
export function getDateLocale(locale: Locale): DateFnsLocale {
  return DATE_LOCALE_MAP[locale] || ptBR;
}

/** Formata uma data usando o locale correto */
export function formatLocalDate(
  date: Date | number | string,
  pattern: string,
  locale: Locale,
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return dateFnsFormat(d, pattern, { locale: getDateLocale(locale) });
}

/** Formata número com separadores do locale */
export function formatLocalNumber(value: number, locale: Locale): string {
  return value.toLocaleString(locale === 'en' ? 'en-US' : 'pt-BR');
}

/** Formata moeda (BRL pra PT, USD pra EN) */
export function formatLocalCurrency(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'pt-BR', {
    style: 'currency',
    currency: locale === 'en' ? 'USD' : 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
