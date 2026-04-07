'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { LocaleProvider } from '@/lib/i18n/context';
import type { Locale } from '@/lib/i18n/types';
import { DEFAULT_LOCALE } from '@/lib/i18n/types';

const STORAGE_KEY = 'boldfy-locale';

function getStoredLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'en' ? 'en' : 'pt-BR';
}

interface PublicLocaleWrapperProps {
  children: (locale: Locale, setLocale: (l: Locale) => void) => ReactNode;
}

/**
 * Wrapper para páginas públicas (login, beta-test, etc.).
 * Lê/grava locale no localStorage e provê o LocaleProvider.
 *
 * Usage:
 * <PublicLocaleWrapper>
 *   {(locale, setLocale) => (
 *     <LanguageToggle locale={locale} onChange={setLocale} />
 *     <MyPageContent />
 *   )}
 * </PublicLocaleWrapper>
 */
export function PublicLocaleWrapper({ children }: PublicLocaleWrapperProps) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLocaleState(getStoredLocale());
    setMounted(true);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem(STORAGE_KEY, l);
  }, []);

  // Evita hydration mismatch
  if (!mounted) return null;

  return (
    <LocaleProvider locale={locale}>
      {children(locale, setLocale)}
    </LocaleProvider>
  );
}
