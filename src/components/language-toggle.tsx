'use client';

import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/lib/i18n/types';

interface LanguageToggleProps {
  locale: Locale;
  onChange: (locale: Locale) => void;
  className?: string;
}

/** Botão compacto PT | EN pra páginas públicas */
export function LanguageToggle({ locale, onChange, className }: LanguageToggleProps) {
  const next: Locale = locale === 'pt-BR' ? 'en' : 'pt-BR';

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onChange(next)}
      className={`gap-1.5 text-xs font-medium ${className ?? ''}`}
      aria-label={locale === 'pt-BR' ? 'Switch to English' : 'Mudar para Português'}
    >
      <Globe className="h-3.5 w-3.5" />
      {locale === 'pt-BR' ? 'EN' : 'PT'}
    </Button>
  );
}
