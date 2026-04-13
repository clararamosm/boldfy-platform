// src/components/calendar/post-list-table.tsx
'use client';

import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Trash2, Search, ListFilter, Calendar as CalIcon, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { getStatusConfig, PIPELINE_STATUSES, FORMATO_OPTIONS } from '@/lib/pipeline-config';
import type { PipelineStatus } from '@/app/actions/content-pipeline';

// ─── Types ──────────────────────────────────────────────

type PostItem = {
  id: string;
  title: string;
  caption: string;
  status: PipelineStatus;
  scheduledFor: string | null;
  formato: string;
  etapa: string;
  contentPillar?: string;
  createdAt: string;
  /** Optional: TL user ID for profile filtering */
  _tlId?: string;
};

type PostListTableProps = {
  posts: PostItem[];
  getStatusLabel: (status: PipelineStatus) => string;
  onPostClick: (postId: string) => void;
  /** If provided, enables delete button on each row */
  onDeletePost?: (postId: string) => void;
  /** If provided, shows a TL/profile filter dropdown and TL name column */
  tlProfiles?: Array<{ id: string; name: string }>;
};

// ─── Filter types ──────────────────────────────────────

type ScheduleFilter = 'all' | 'scheduled' | 'unscheduled';

const VISIBLE_STATUSES = PIPELINE_STATUSES.filter(s => s !== 'arquivado');

// ─── Component ─────────────────────────────────────────

export function PostListTable({
  posts,
  getStatusLabel,
  onPostClick,
  onDeletePost,
  tlProfiles,
}: PostListTableProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PipelineStatus | 'all'>('all');
  const [formatFilter, setFormatFilter] = useState<string>('all');
  const [scheduleFilter, setScheduleFilter] = useState<ScheduleFilter>('all');
  const [pillarFilter, setPillarFilter] = useState<string>('all');
  const [tlFilter, setTlFilter] = useState<string>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const showTlColumn = !!tlProfiles && tlProfiles.length > 0;

  // Build TL name lookup
  const tlNameMap = useMemo(() => {
    if (!tlProfiles) return new Map<string, string>();
    const map = new Map<string, string>();
    tlProfiles.forEach(tl => map.set(tl.id, tl.name));
    return map;
  }, [tlProfiles]);

  // ─── Derived data ──────────────────────────────────────

  const uniqueFormats = useMemo(() => {
    const fmts = new Set<string>();
    posts.forEach(p => { if (p.formato) fmts.add(p.formato); });
    return Array.from(fmts).sort();
  }, [posts]);

  const uniquePillars = useMemo(() => {
    const pls = new Set<string>();
    posts.forEach(p => { if (p.contentPillar) pls.add(p.contentPillar); });
    return Array.from(pls).sort();
  }, [posts]);

  const filtered = useMemo(() => {
    return posts.filter(p => {
      // Exclude archived
      if (p.status === 'arquivado') return false;
      // TL/profile
      if (tlFilter !== 'all' && p._tlId !== tlFilter) return false;
      // Status
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      // Format
      if (formatFilter !== 'all' && p.formato !== formatFilter) return false;
      // Pillar
      if (pillarFilter !== 'all' && p.contentPillar !== pillarFilter) return false;
      // Schedule
      if (scheduleFilter === 'scheduled' && !p.scheduledFor) return false;
      if (scheduleFilter === 'unscheduled' && p.scheduledFor) return false;
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !p.title.toLowerCase().includes(q) &&
          !p.caption.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [posts, tlFilter, statusFilter, formatFilter, pillarFilter, scheduleFilter, search]);

  // Sort: unscheduled first, then by scheduledFor or createdAt
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      // Unscheduled posts first
      if (!a.scheduledFor && b.scheduledFor) return -1;
      if (a.scheduledFor && !b.scheduledFor) return 1;
      // Then by date (newest first)
      const dateA = a.scheduledFor || a.createdAt;
      const dateB = b.scheduledFor || b.createdAt;
      return dateB.localeCompare(dateA);
    });
  }, [filtered]);

  const activeFilters = [
    tlFilter !== 'all',
    statusFilter !== 'all',
    formatFilter !== 'all',
    pillarFilter !== 'all',
    scheduleFilter !== 'all',
    search.trim().length > 0,
  ].filter(Boolean).length;

  // Grid columns: with or without TL name column
  const gridCols = showTlColumn
    ? 'grid-cols-[1fr_100px_110px_100px_100px_120px_36px]'
    : 'grid-cols-[1fr_110px_100px_100px_120px_36px]';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ListFilter className="h-4 w-4" />
            Todos os Posts ({filtered.length})
          </CardTitle>
          {activeFilters > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => {
                setTlFilter('all');
                setStatusFilter('all');
                setFormatFilter('all');
                setPillarFilter('all');
                setScheduleFilter('all');
                setSearch('');
              }}
            >
              Limpar filtros ({activeFilters})
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Search + Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por título ou conteúdo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>

          {/* TL/Profile filter (only when multiple profiles) */}
          {showTlColumn && (
            <select
              value={tlFilter}
              onChange={e => setTlFilter(e.target.value)}
              className="h-9 px-3 rounded-md border bg-background text-sm"
            >
              <option value="all">Todos perfis</option>
              {tlProfiles!.map(tl => (
                <option key={tl.id} value={tl.id}>{tl.name}</option>
              ))}
            </select>
          )}

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as PipelineStatus | 'all')}
            className="h-9 px-3 rounded-md border bg-background text-sm"
          >
            <option value="all">Todos status</option>
            {VISIBLE_STATUSES.map(s => (
              <option key={s} value={s}>{getStatusLabel(s)}</option>
            ))}
          </select>

          {/* Format filter */}
          {uniqueFormats.length > 0 && (
            <select
              value={formatFilter}
              onChange={e => setFormatFilter(e.target.value)}
              className="h-9 px-3 rounded-md border bg-background text-sm"
            >
              <option value="all">Todos formatos</option>
              {uniqueFormats.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          )}

          {/* Pillar filter */}
          {uniquePillars.length > 0 && (
            <select
              value={pillarFilter}
              onChange={e => setPillarFilter(e.target.value)}
              className="h-9 px-3 rounded-md border bg-background text-sm"
            >
              <option value="all">Todos pilares</option>
              {uniquePillars.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          )}

          {/* Schedule filter */}
          <select
            value={scheduleFilter}
            onChange={e => setScheduleFilter(e.target.value as ScheduleFilter)}
            className="h-9 px-3 rounded-md border bg-background text-sm"
          >
            <option value="all">Agendamento</option>
            <option value="scheduled">Com data</option>
            <option value="unscheduled">Sem data</option>
          </select>
        </div>

        {/* Table */}
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              {posts.length === 0 ? 'Nenhum post criado ainda.' : 'Nenhum post encontrado com esses filtros.'}
            </p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            {/* Header */}
            <div className={cn('grid gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground', gridCols)}>
              <span>Título</span>
              {showTlColumn && <span>Perfil</span>}
              <span>Status</span>
              <span>Formato</span>
              <span>Pilar</span>
              <span>Data</span>
              <span />
            </div>

            {/* Rows */}
            <div className="divide-y">
              {sorted.map(post => {
                const cfg = getStatusConfig(post.status);
                const isConfirming = confirmDeleteId === post.id;
                return (
                  <div
                    key={post.id}
                    className={cn('w-full grid gap-2 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors items-center', gridCols)}
                  >
                    <button
                      type="button"
                      onClick={() => onPostClick(post.id)}
                      className="text-sm font-medium line-clamp-1 text-left hover:underline"
                    >
                      {post.title || 'Sem título'}
                    </button>
                    {showTlColumn && (
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {tlNameMap.get(post._tlId || '') || '—'}
                      </span>
                    )}
                    <span>
                      <Badge className={cn('text-[10px] h-5 font-medium', cfg.badge)}>
                        {getStatusLabel(post.status)}
                      </Badge>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {post.formato || '—'}
                    </span>
                    <span className="text-xs text-muted-foreground line-clamp-1">
                      {post.contentPillar || '—'}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      {post.scheduledFor ? (
                        <>
                          <CalIcon className="h-3 w-3 shrink-0" />
                          {format(parseISO(post.scheduledFor), 'dd/MM HH:mm')}
                        </>
                      ) : (
                        <span className="text-amber-500">Sem data</span>
                      )}
                    </span>
                    <span className="flex justify-center">
                      {onDeletePost && (
                        isConfirming ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="destructive"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeletePost(post.id);
                                setConfirmDeleteId(null);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(null);
                              }}
                            >
                              ✕
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(post.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
