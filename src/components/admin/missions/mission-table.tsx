// src/components/admin/missions/mission-table.tsx
'use client';

import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ActionDialog } from '@/components/dashboard/action-dialog';
import { MoreHorizontal, Loader2, CheckCircle2, Clock, History, FileCheck, Trash2 } from 'lucide-react';
import { useT } from '@/lib/i18n/context';
import { useFormat } from '@/hooks/use-format-date';
import type { Mission, DerivedStatus } from './use-admin-missions';
import { deriveMissionStatus } from './use-admin-missions';
import { MissionForm } from './mission-form';

const getStatusBadge = (status: DerivedStatus, labels: { active: string; scheduled: string; ended: string }) => {
  switch (status) {
    case 'ativa':
      return <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />{labels.active}</Badge>;
    case 'agendada':
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200"><Clock className="h-3 w-3 mr-1" />{labels.scheduled}</Badge>;
    case 'encerrada':
      return <Badge variant="outline" className="text-muted-foreground"><History className="h-3 w-3 mr-1" />{labels.ended}</Badge>;
  }
};

type Props = {
  missions: Mission[];
  isLoading: boolean;
  status: DerivedStatus;
  companyId: string | null;
  isSubmitting: boolean;
  formRef: React.RefObject<HTMLFormElement>;
  onEdit: (missionId: string, isFixed: boolean) => void;
  onDelete: (missionId: string) => void;
  onOpenReview: () => void;
  cols: number;
};

export function MissionTable({
  missions, isLoading, status, companyId, isSubmitting,
  formRef, onEdit, onDelete, onOpenReview, cols,
}: Props) {
  const t = useT();
  const { fmtDate } = useFormat();
  const showPeriod = status !== 'ativa' || missions.some(m => m.type === 'timed');

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t.adminMissions.missionName}</TableHead>
          <TableHead>{t.adminMissions.fixed}/{t.adminMissions.timed}</TableHead>
          <TableHead>{t.adminMissions.completionMode}</TableHead>
          {showPeriod && <TableHead>{t.adminMissions.startDate}</TableHead>}
          <TableHead>{t.adminMissions.pointsLabel}</TableHead>
          <TableHead>{t.common.status}</TableHead>
          {status === 'ativa' && <TableHead>{t.adminMissions.submissions}</TableHead>}
          <TableHead><span className="sr-only">{t.common.actions}</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow>
            <TableCell colSpan={cols} className="h-24 text-center">
              <div className="flex justify-center items-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t.common.loading}
              </div>
            </TableCell>
          </TableRow>
        ) : missions.length === 0 ? (
          <TableRow>
            <TableCell colSpan={cols} className="text-center py-8 text-muted-foreground">
              {status === 'ativa' ? t.adminMissions.noActiveMissions :
               status === 'agendada' ? t.adminMissions.noScheduledMissions :
               t.adminMissions.noHistoryMissions}
            </TableCell>
          </TableRow>
        ) : missions.map((mission) => {
          const derivedStatus = deriveMissionStatus(mission, new Date());
          const formatDate = (d: { toDate?: () => Date } | string | null | undefined) => {
            if (!d) return '';
            const date = typeof d === 'object' && d !== null && 'toDate' in d && typeof d.toDate === 'function' ? d.toDate() : new Date(d as string);
            return fmtDate(date, 'dd/MM/yyyy');
          };

          return (
            <TableRow key={mission.id} className={status === 'encerrada' ? 'text-muted-foreground' : ''}>
              <TableCell className="font-medium">{mission.name}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {mission.type === 'fixed' ? t.adminMissions.fixed : t.adminMissions.timed}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={`text-xs ${mission.completionMode === 'auto' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                  {mission.completionMode === 'auto' ? t.adminMissions.auto : t.adminMissions.proof}
                </Badge>
              </TableCell>
              {showPeriod && (
                <TableCell className="text-sm">
                  {mission.type === 'fixed' ? (
                    <span className="text-muted-foreground">{t.adminMissions.alwaysActive}</span>
                  ) : (
                    `${formatDate(mission.startDate)} — ${formatDate(mission.endDate)}`
                  )}
                </TableCell>
              )}
              <TableCell>{mission.points}</TableCell>
              <TableCell>{getStatusBadge(derivedStatus, { active: t.adminMissions.statusActive, scheduled: t.adminMissions.statusScheduled, ended: t.adminMissions.statusEnded })}</TableCell>
              {status === 'ativa' && (
                <TableCell>
                  {(mission.pendingSubmissions || 0) > 0 ? (
                    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 cursor-pointer hover:bg-yellow-200 transition-colors" onClick={onOpenReview}>
                      <FileCheck className="h-3 w-3 mr-1" />
                      {t.adminMissions.pendingProofs.replace('{count}', String(mission.pendingSubmissions))}
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
              )}
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {status !== 'encerrada' && (
                      <ActionDialog
                        title={t.adminMissions.editMission}
                        description={t.adminMissions.editMissionDescription}
                        trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>{t.common.edit}</DropdownMenuItem>}
                        actionText={t.common.saveChanges}
                        onAction={() => onEdit(mission.id, mission.type === 'fixed')}
                        formId="mission-form"
                      >
                        <MissionForm isSubmitting={isSubmitting} formRef={formRef} mission={mission} isFixed={mission.type === 'fixed'} />
                      </ActionDialog>
                    )}
                    <DropdownMenuItem className="text-destructive" onClick={() => onDelete(mission.id)}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t.common.delete}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
