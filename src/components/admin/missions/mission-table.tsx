// src/components/admin/missions/mission-table.tsx
'use client';

import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ActionDialog } from '@/components/dashboard/action-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MoreHorizontal, Loader2, CheckCircle2, Clock, History, FileCheck, Trash2 } from 'lucide-react';
import { useT } from '@/lib/i18n/context';
import { useFormat } from '@/hooks/use-format-date';
import type { Mission, DerivedStatus, SubmissionUser } from './use-admin-missions';
import { deriveMissionStatus } from './use-admin-missions';
import { MissionForm } from './mission-form';
import { cn } from '@/lib/utils';

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

// ─── Avatar Stack ──────────────────────────────
// Shows up to MAX_VISIBLE stacked avatars with tooltips; overflow shows a "+N" pill
// that opens a dialog listing all users.

const MAX_VISIBLE = 5;

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

function SubmissionAvatarStack({
  users,
  missionName,
}: {
  users: SubmissionUser[];
  missionName: string;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const t = useT();

  if (users.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  const visible = users.slice(0, MAX_VISIBLE);
  const overflow = users.length - MAX_VISIBLE;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center">
        <div className="flex -space-x-2">
          {visible.map((user) => (
            <Tooltip key={user.userId}>
              <TooltipTrigger asChild>
                <Avatar className={cn(
                  'h-7 w-7 ring-2 ring-background cursor-default',
                  user.status === 'pending' && 'opacity-60',
                )}>
                  <AvatarImage src={user.avatarUrl} alt={user.userName} />
                  <AvatarFallback className="text-[10px] font-medium bg-muted">
                    {getInitials(user.userName)}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p className="font-medium">{user.userName}</p>
                {user.status === 'pending' && (
                  <p className="text-muted-foreground">{t.adminMissions?.pendingLabel || 'Pendente'}</p>
                )}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        {overflow > 0 && (
          <button
            onClick={() => setDialogOpen(true)}
            className="ml-1 flex items-center justify-center h-7 min-w-[28px] px-1.5 rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-background hover:bg-muted/80 transition-colors cursor-pointer"
          >
            +{overflow}
          </button>
        )}
      </div>

      {/* Full list dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-base">
              {(t.adminMissions?.submissionsFor || 'Envios — {mission}').replace('{mission}', missionName)}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[360px] overflow-y-auto -mx-1">
            <div className="space-y-1 px-1">
              {users.map((user) => (
                <div
                  key={user.userId}
                  className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Avatar className={cn('h-8 w-8', user.status === 'pending' && 'opacity-60')}>
                    <AvatarImage src={user.avatarUrl} alt={user.userName} />
                    <AvatarFallback className="text-xs font-medium bg-muted">
                      {getInitials(user.userName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.userName}</p>
                  </div>
                  {user.status === 'pending' ? (
                    <Badge variant="outline" className="text-[10px] bg-yellow-50 text-yellow-700 border-yellow-200">
                      {t.adminMissions?.pendingLabel || 'Pendente'}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                      <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                      {t.adminMissions?.approvedLabel || 'Aprovado'}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

// ─── Props ─────────────────────────────────────

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
  submissionsByMission?: Record<string, SubmissionUser[]>;
};

// ─── Component ─────────────────────────────────

export function MissionTable({
  missions, isLoading, status, companyId, isSubmitting,
  formRef, onEdit, onDelete, onOpenReview, cols, submissionsByMission = {},
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
          <TableHead>{t.adminMissions?.completedBy || 'Envios'}</TableHead>
          <TableHead><span className="sr-only">{t.common.actions}</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow>
            <TableCell colSpan={cols + 1} className="h-24 text-center">
              <div className="flex justify-center items-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t.common.loading}
              </div>
            </TableCell>
          </TableRow>
        ) : missions.length === 0 ? (
          <TableRow>
            <TableCell colSpan={cols + 1} className="text-center py-8 text-muted-foreground">
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
          const missionUsers = submissionsByMission[mission.id] || [];

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
              {/* Avatar stack — who completed this mission */}
              <TableCell>
                <SubmissionAvatarStack users={missionUsers} missionName={mission.name} />
              </TableCell>
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
