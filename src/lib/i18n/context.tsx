'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import type { Locale } from './types';
import { DEFAULT_LOCALE } from './types';
import { getDictionary, type Dictionary } from './dictionaries';

/* ─── Context shape ─── */
interface LocaleContextValue {
  locale: Locale;
  t: Dictionary;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  t: getDictionary(DEFAULT_LOCALE),
});

/* ─── Provider ─── */
interface LocaleProviderProps {
  locale: Locale;
  children: ReactNode;
}

export function LocaleProvider({ locale, children }: LocaleProviderProps) {
  const value = useMemo<LocaleContextValue>(
    () => ({ locale, t: getDictionary(locale) }),
    [locale],
  );

  // Atualiza o lang do <html> dinamicamente
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

/* ─── Hooks ─── */

/** Retorna o dicionário tipado inteiro */
export function useT(): Dictionary {
  return useContext(LocaleContext).t;
}

/** Retorna o locale ativo ('pt-BR' | 'en') */
export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}

/** Retorna locale + dicionário de uma vez */
export function useI18n(): LocaleContextValue {
  return useContext(LocaleContext);
}
