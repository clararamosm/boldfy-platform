'use client';

import { useCallback } from 'react';
import { useLocale } from '@/lib/i18n/context';
import {
  formatLocalDate,
  formatLocalNumber,
  formatLocalCurrency,
} from '@/lib/i18n/date-utils';

/**
 * Hook que expõe helpers de formatação já vinculados ao locale ativo.
 *
 * @example
 * const { fmtDate, fmtNumber, fmtCurrency } = useFormat();
 * fmtDate(new Date(), 'dd/MM/yyyy')  // respeita locale
 * fmtCurrency(1500)                   // R$ 1.500 ou $1,500
 */
export function useFormat() {
  const locale = useLocale();

  const fmtDate = useCallback(
    (date: Date | number | string, pattern: string) =>
      formatLocalDate(date, pattern, locale),
    [locale],
  );

  const fmtNumber = useCallback(
    (value: number) => formatLocalNumber(value, locale),
    [locale],
  );

  const fmtCurrency = useCallback(
    (value: number) => formatLocalCurrency(value, locale),
    [locale],
  );

  return { fmtDate, fmtNumber, fmtCurrency, locale } as const;
}
