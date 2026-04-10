// src/components/admin/missions/mission-form.tsx
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarIcon } from 'lucide-react';
import { useT } from '@/lib/i18n/context';
import { useFormat } from '@/hooks/use-format-date';
import { getDateLocale } from '@/lib/i18n/date-utils';
import type { Mission } from './use-admin-missions';

type Props = {
  mission?: Mission;
  isSubmitting: boolean;
  formRef: React.RefObject<HTMLFormElement>;
  isFixed?: boolean;
};

export function MissionForm({ mission, isSubmitting, formRef, isFixed = false }: Props) {
  const t = useT();
  const { fmtDate, locale } = useFormat();
  const [startDate, setStartDate] = useState<Date | undefined>(
    mission?.startDate && typeof mission.startDate === 'object' && mission.startDate !== null && 'toDate' in mission.startDate && typeof mission.startDate.toDate === 'function' ? mission.startDate.toDate() : mission?.startDate ? new Date(mission.startDate as string) : undefined
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    mission?.endDate && typeof mission.endDate === 'object' && mission.endDate !== null && 'toDate' in mission.endDate && typeof mission.endDate.toDate === 'function' ? mission.endDate.toDate() : mission?.endDate ? new Date(mission.endDate as string) : undefined
  );
  const [completionMode, setCompletionMode] = useState<string>(mission?.completionMode || 'proof');

  return (
    <form id="mission-form" ref={formRef} className="space-y-4">
      <input type="hidden" name="startDate" value={startDate?.toISOString() || ''} />
      <input type="hidden" name="endDate" value={endDate?.toISOString() || ''} />
      <input type="hidden" name="completionMode" value={completionMode} />
      <div className="space-y-2">
        <Label htmlFor="mission-name">{t.adminMissions.missionName}</Label>
        <Input id="mission-name" name="name" placeholder={isFixed ? t.adminMissions.missionNamePlaceholderFixed : t.adminMissions.missionNamePlaceholderTimed} disabled={isSubmitting} defaultValue={mission?.name} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="mission-description">{t.adminMissions.description}</Label>
        <Textarea id="mission-description" name="description" placeholder={t.adminMissions.descriptionPlaceholder} disabled={isSubmitting} defaultValue={mission?.description} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="mission-points">{t.adminMissions.pointsLabel}</Label>
        <Input id="mission-points" name="points" type="number" placeholder={t.adminMissions.pointsPlaceholder} disabled={isSubmitting} defaultValue={mission?.points} required />
      </div>
      <div className="space-y-2">
        <Label>{t.adminMissions.completionMode}</Label>
        <Select value={completionMode} onValueChange={setCompletionMode}>
          <SelectTrigger>
            <SelectValue placeholder={t.adminMissions.completionModePlaceholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="proof">{t.adminMissions.completionProof}</SelectItem>
            <SelectItem value="auto">{t.adminMissions.completionAuto}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {completionMode === 'auto' ? t.adminMissions.completionAutoHelp : t.adminMissions.completionProofHelp}
        </p>
      </div>
      {!isFixed && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t.adminMissions.startDate}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal" disabled={isSubmitting}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? fmtDate(startDate, 'dd/MM/yyyy') : <span className="text-muted-foreground">{t.common.select}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} locale={getDateLocale(locale)} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label>{t.adminMissions.endDate}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal" disabled={isSubmitting}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? fmtDate(endDate, 'dd/MM/yyyy') : <span className="text-muted-foreground">{t.common.select}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={endDate} onSelect={setEndDate} locale={getDateLocale(locale)} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}
    </form>
  );
}
