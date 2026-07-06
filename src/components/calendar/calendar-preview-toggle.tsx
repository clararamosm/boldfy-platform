'use client';

// Toggle "Preview de mídia" das views de calendário + hook da preferência.
//
// A preferência vive em localStorage (por dispositivo/browser, sem write no
// Firestore) e é compartilhada entre todas as views de calendário — quem
// desliga no calendário do colaborador também vê desligado no do estrategista.
//
// Default: ligado. Hidratação: o primeiro render SSR/client começa desligado
// e o valor real entra num useEffect — evita hydration mismatch do Next.

import { useState, useEffect, useCallback } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const STORAGE_KEY = 'boldfy:calendar-media-preview';

export function useCalendarMediaPreview(): [boolean, (value: boolean) => void] {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // Ausente = default ligado (feature visível; 1 clique pra desligar).
      setEnabled(raw === null ? true : raw === '1');
    } catch {
      // localStorage indisponível (Safari private mode etc) — fica desligado.
    }
  }, []);

  const update = useCallback((value: boolean) => {
    setEnabled(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
    } catch {
      // Sem persistência — o toggle ainda funciona na sessão atual.
    }
  }, []);

  return [enabled, update];
}

type Props = {
  enabled: boolean;
  onChange: (value: boolean) => void;
  className?: string;
};

export function CalendarPreviewToggle({ enabled, onChange, className }: Props) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
      <Label
        htmlFor="calendar-media-preview"
        className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap"
      >
        Preview de mídia
      </Label>
      <Switch
        id="calendar-media-preview"
        checked={enabled}
        onCheckedChange={onChange}
        aria-label="Mostrar preview de mídia nos cards do calendário"
      />
    </div>
  );
}
