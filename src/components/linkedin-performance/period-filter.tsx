// src/components/linkedin-performance/period-filter.tsx
'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  startOfWeek,
  startOfMonth,
  subMonths,
  endOfMonth,
} from 'date-fns';

// ─── Period helpers ──────────────────────────────────────────

export type PeriodKey = 'this_week' | 'this_month' | 'last_month' | 'last_3_months';

export const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: 'this_week', label: 'Esta semana' },
  { value: 'this_month', label: 'Este mes' },
  { value: 'last_month', label: 'Ultimo mes' },
  { value: 'last_3_months', label: 'Ultimos 3 meses' },
];

export function getPeriodRange(key: PeriodKey): { start: string; end: string } {
  const now = new Date();
  switch (key) {
    case 'this_week': {
      const start = startOfWeek(now, { weekStartsOn: 1 });
      return { start: start.toISOString(), end: now.toISOString() };
    }
    case 'this_month': {
      const start = startOfMonth(now);
      return { start: start.toISOString(), end: now.toISOString() };
    }
    case 'last_month': {
      const lastMonth = subMonths(now, 1);
      return {
        start: startOfMonth(lastMonth).toISOString(),
        end: endOfMonth(lastMonth).toISOString(),
      };
    }
    case 'last_3_months': {
      const threeMonthsAgo = subMonths(now, 3);
      return { start: startOfMonth(threeMonthsAgo).toISOString(), end: now.toISOString() };
    }
  }
}

// ─── Profile type ────────────────────────────────────────────

export type ProfileOption = {
  id: string;
  name: string;
  picture?: string;
};

// ─── Component ───────────────────────────────────────────────

type PeriodFilterProps = {
  period: PeriodKey;
  onPeriodChange: (key: PeriodKey) => void;
  showProfileFilter?: boolean;
  profiles?: ProfileOption[];
  selectedProfileId?: string;
  onProfileChange?: (id: string) => void;
};

export function PeriodFilter({
  period,
  onPeriodChange,
  showProfileFilter,
  profiles,
  selectedProfileId,
  onProfileChange,
}: PeriodFilterProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {showProfileFilter && profiles && profiles.length > 0 && (
        <Select value={selectedProfileId || ''} onValueChange={onProfileChange}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue placeholder="Selecionar perfil" />
          </SelectTrigger>
          <SelectContent>
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <div className="flex items-center gap-2">
                  <Avatar className="h-4 w-4">
                    {p.picture && <AvatarImage src={p.picture} />}
                    <AvatarFallback className="text-[8px]">
                      {p.name?.[0]?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{p.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select value={period} onValueChange={(v) => onPeriodChange(v as PeriodKey)}>
        <SelectTrigger className="w-[160px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERIOD_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
