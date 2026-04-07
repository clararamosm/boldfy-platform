import { ptBR } from 'date-fns/locale/pt-BR';
import { enUS } from 'date-fns/locale/en-US';
import { format as dateFnsFormat, type Locale as DateFnsLocale } from 'date-fns';
import type { Locale } from './types';

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
