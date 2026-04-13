'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { CalendarCheck } from 'lucide-react';
import { getAuthToken } from '@/lib/auth-client';
import { getContentStrategy } from '@/app/actions/content-strategy';
import type { PipelinePost, PipelineStatus } from '@/app/actions/content-pipeline';
import { STATUS_CONFIG, PIPELINE_STATUSES, ETAPA_OPTIONS, FORMATO_OPTIONS } from '@/lib/pipeline-config';

type Props = {
  post: PipelinePost;
  canEdit: boolean;
  tlId: string;
  onPropertyChange: (field: string, value: unknown) => void;
  onForceSchedule?: () => void;
};

export function PostProperties({ post, canEdit, tlId, onPropertyChange, onForceSchedule }: Props) {
  const [contentPillars, setContentPillars] = useState<string[]>([]);

  // Load content pillars from strategy
  useEffect(() => {
    async function loadPillars() {
      try {
        const token = await getAuthToken();
        const result = await getContentStrategy(token, tlId);
        if (result.data?.pillars) {
          setContentPillars(result.data.pillars.map((p: { name: string }) => p.name));
        }
      } catch {
        // Silent — pillar select just won't have options
      }
    }
    loadPillars();
  }, [tlId]);

  const statusInfo = STATUS_CONFIG[post.status] || STATUS_CONFIG.backlog;

  // Read-only view for TL
  if (!canEdit) {
    return (
      <div className="flex flex-wrap gap-2 py-3 border-y">
        <Badge className={statusInfo.badge}>{statusInfo.label}</Badge>
        {post.etapa && <Badge variant="outline">{post.etapa}</Badge>}
        {post.formato && <Badge variant="outline">{post.formato}</Badge>}
        {post.contentPillar && <Badge variant="outline">{post.contentPillar}</Badge>}
        {post.scheduledFor && (
          <Badge variant="outline">
            {new Date(post.scheduledFor).toLocaleDateString('pt-BR')}
          </Badge>
        )}
        {post.leadMagnet && <Badge variant="outline">Lead Magnet</Badge>}
      </div>
    );
  }

  // Editable view for strategist
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4 border-y">
      {/* Status */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Status</Label>
        <Select value={post.status} onValueChange={(v) => onPropertyChange('status', v)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PIPELINE_STATUSES.map(s => (
              <SelectItem key={s} value={s} className="text-xs">
                {STATUS_CONFIG[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Etapa */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Etapa</Label>
        <Select value={post.etapa || ''} onValueChange={(v) => onPropertyChange('etapa', v)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {ETAPA_OPTIONS.map(opt => (
              <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Formato */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Formato</Label>
        <Select value={post.formato || ''} onValueChange={(v) => onPropertyChange('formato', v)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {FORMATO_OPTIONS.map(opt => (
              <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Pilar */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Pilar</Label>
        {contentPillars.length > 0 ? (
          <Select value={post.contentPillar || ''} onValueChange={(v) => onPropertyChange('contentPillar', v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {contentPillars.map(p => (
                <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={post.contentPillar || ''}
            onChange={(e) => onPropertyChange('contentPillar', e.target.value)}
            placeholder="Pilar de conteúdo"
            className="h-8 text-xs"
          />
        )}
      </div>

      {/* Data */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Data</Label>
        <Input
          type="date"
          value={post.scheduledFor ? (() => {
            const d = new Date(post.scheduledFor);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          })() : ''}
          onChange={(e) => {
            const dateVal = e.target.value;
            if (dateVal) {
              // Preserve existing time if any
              const existingTime = post.scheduledFor?.includes('T')
                ? post.scheduledFor.split('T')[1]?.replace(/Z$/, '').substring(0, 5)
                : null;
              const time = existingTime || '09:00';
              // Build as local date → convert to UTC ISO string
              const localDate = new Date(`${dateVal}T${time}:00`);
              onPropertyChange('scheduledFor', localDate.toISOString());
            } else {
              onPropertyChange('scheduledFor', null);
            }
          }}
          className="h-8 text-xs"
        />
      </div>

      {/* Horário */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Horário</Label>
        <Input
          type="time"
          value={
            post.scheduledFor?.includes('T')
              ? (() => {
                  // Convert stored UTC ISO back to local time for display
                  const d = new Date(post.scheduledFor!);
                  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                })()
              : ''
          }
          onChange={(e) => {
            const timeVal = e.target.value;
            const dateVal = post.scheduledFor ? post.scheduledFor.split('T')[0] : '';
            if (dateVal && timeVal) {
              // Build as local date → convert to UTC ISO string
              // Use the displayed local date, not the raw ISO date part
              const existingDate = new Date(post.scheduledFor!);
              const [hh, mm] = timeVal.split(':').map(Number);
              existingDate.setHours(hh, mm, 0, 0);
              onPropertyChange('scheduledFor', existingDate.toISOString());
            } else if (dateVal && !timeVal) {
              const existingDate = new Date(post.scheduledFor!);
              existingDate.setHours(0, 0, 0, 0);
              onPropertyChange('scheduledFor', existingDate.toISOString());
            }
          }}
          disabled={!post.scheduledFor}
          className="h-8 text-xs"
        />
      </div>

      {/* Lead Magnet */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Lead Magnet</Label>
        <div className="flex items-center h-8">
          <Switch
            checked={post.leadMagnet}
            onCheckedChange={(v) => onPropertyChange('leadMagnet', v)}
          />
        </div>
      </div>

      {/* Forçar Agendamento — only when status is pronto_pra_postar and has date */}
      {post.status === 'pronto_pra_postar' && post.scheduledFor && (
        <div className="space-y-1 col-span-2 sm:col-span-4">
          <Button
            size="sm"
            variant="default"
            className="w-full sm:w-auto"
            onClick={() => onForceSchedule?.()}
          >
            <CalendarCheck className="h-4 w-4 mr-1.5" />
            Forçar Agendamento
          </Button>
        </div>
      )}
    </div>
  );
}
