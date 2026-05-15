// src/app/admin/dashboard/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from '@/components/dashboard/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Link from 'next/link';
import {
  Users, Send, Eye, DollarSign,
  Layers, Mic, Trophy, BellRing, GitBranch,
  TrendingUp, Briefcase, Building, Maximize2,
  RefreshCw, Clock, Info, UserPlus, ArrowRight,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Minus,
  Loader2,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip,
} from 'recharts';
import { getAuthToken } from '@/lib/auth-client';
import {
  getAdminDashboardData,
  sendReactivationEmail,
  type DashboardData,
  type PushItem,
  type FunnelSteps,
  type MonthlyDataPoint,
  type AudienceItem,
} from '@/app/actions/dashboard';
import { useAuth } from '@/contexts/auth-context';
import { useResolvedCompanyId } from '@/hooks/use-resolved-company-id';
import { useToast } from '@/hooks/use-toast';

// ─── Period Filter (7/30/90 dias) ───────────────────────────────────

type PeriodKey = '7d' | '30d' | '90d';

const PERIOD_OPTIONS: { key: PeriodKey; label: string; days: number }[] = [
  { key: '7d', label: '7 dias', days: 7 },
  { key: '30d', label: '30 dias', days: 30 },
  { key: '90d', label: '90 dias', days: 90 },
];

function getPeriodRange(key: PeriodKey) {
  const opt = PERIOD_OPTIONS.find(o => o.key === key) ?? PERIOD_OPTIONS[1];
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);
  start.setDate(now.getDate() - opt.days);
  const prevEnd = new Date(start);
  prevEnd.setMilliseconds(-1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevEnd.getDate() - opt.days);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    prevStart: prevStart.toISOString(),
    prevEnd: prevEnd.toISOString(),
  };
}

// ─── Formatters ─────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1).replace('.', ',')}k`;
  return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}

function formatNumber(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace('.', ',')}k`;
  return value.toLocaleString('pt-BR');
}

function formatRelativeTime(isoTimestamp: string | null): string {
  if (!isoTimestamp) return 'sem dados';
  const ms = Date.now() - new Date(isoTimestamp).getTime();
  const minutes = Math.floor(ms / (60 * 1000));
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() || '')
    .join('') || '–';
}

// ─── Info Tooltip ───────────────────────────────────────────────────

function InfoTooltip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          aria-label="Mais informações"
        >
          <Info className="h-2.5 w-2.5" strokeWidth={2.5} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[280px] text-xs leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Delta Badge ────────────────────────────────────────────────────

function DeltaBadge({ current, previous, suffix = 'vs período anterior' }: {
  current: number;
  previous: number;
  suffix?: string;
}) {
  if (previous === 0 && current === 0) {
    return <span className="text-[11px] text-muted-foreground">Sem dados anteriores</span>;
  }
  if (previous === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-green-600 font-medium">
        <ChevronUp className="h-3 w-3" /> Novo
      </span>
    );
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Minus className="h-3 w-3" /> sem mudança
      </span>
    );
  }
  const positive = pct > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${positive ? 'text-green-600' : 'text-muted-foreground'}`}>
      {positive ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      {positive ? '+' : ''}{pct}% {suffix}
    </span>
  );
}

// ─── KPI Card (banner geral) ────────────────────────────────────────

function KPICard({
  icon: Icon, label, value, delta, tooltip,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  delta?: React.ReactNode;
  tooltip: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <InfoTooltip text={tooltip} />
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold text-foreground tracking-tight">{value}</div>
        {delta && <div className="pt-1">{delta}</div>}
      </CardContent>
    </Card>
  );
}

// ─── Stat Mini (dentro dos boxes) ───────────────────────────────────

function StatMini({ label, value, delta }: {
  label: string;
  value: React.ReactNode;
  delta?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-muted/40 p-3 space-y-1">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground leading-tight">{label}</div>
      <div className="text-xl font-bold text-foreground tracking-tight">{value}</div>
      {delta && <div>{delta}</div>}
    </div>
  );
}

// ─── Funnel Pipeline ────────────────────────────────────────────────

const FUNNEL_COLORS = ['#BC9EE0', '#A471D1', '#CD50F1', '#9840AD', '#5E2A67', '#10B981', '#F59E0B'];
const FUNNEL_LABELS = ['Convidado', 'Ativado', 'LinkedIn', 'Brand Context', '1ª Trilha', '1º Post', 'Consistente'];

function FunnelPipeline({ steps, total }: { steps: FunnelSteps; total: number }) {
  const counts = [
    steps.invited, steps.activated, steps.linkedin, steps.brandContext,
    steps.firstTrail, steps.firstPost, steps.consistent,
  ];
  const safeTotal = total > 0 ? total : 1;

  return (
    <div className="rounded-xl bg-muted/40 p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
          Funil de Engajamento da Equipe · {total} colaborador{total === 1 ? '' : 'es'}
        </span>
        <InfoTooltip text="Onde cada colaborador está agora na jornada — NÃO é cumulativo. Concentração nos primeiros steps indica onboarding travado. Pouca gente em Consistente sinaliza perda de engajamento a longo prazo." />
      </div>
      <div className="flex h-2.5 rounded-full overflow-hidden bg-muted">
        {counts.map((count, i) => (
          <div
            key={i}
            style={{
              width: `${(count / safeTotal) * 100}%`,
              backgroundColor: FUNNEL_COLORS[i],
            }}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {FUNNEL_LABELS.map((lbl, i) => (
          <span key={lbl} className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: FUNNEL_COLORS[i] }} />
            {lbl} <span className="font-semibold text-foreground">{counts[i]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Section Title (dentro de bento blocks) ─────────────────────────

function SectionTitle({
  icon: Icon, children, badge, tooltip, pagination,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
  badge?: React.ReactNode;
  tooltip: string;
  pagination?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground flex-1">
        {children}
        {badge && <span className="ml-1.5">{badge}</span>}
      </span>
      <InfoTooltip text={tooltip} />
      {pagination}
    </div>
  );
}

// ─── Push Needed Block (com paginação 4 em 4) ──────────────────────

function PushNeededBlock({
  items, companyId, idToken, onSent,
}: {
  items: PushItem[];
  companyId: string;
  idToken: string;
  onSent: () => void;
}) {
  const PAGE_SIZE = 4;
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const [page, setPage] = useState(0);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const { toast } = useToast();
  const start = page * PAGE_SIZE;
  const slice = items.slice(start, start + PAGE_SIZE);

  async function handleSend(userId: string) {
    if (!idToken) return;
    setSendingId(userId);
    try {
      const res = await sendReactivationEmail(idToken, companyId, userId);
      if (res.error) {
        toast({ variant: 'destructive', title: 'Erro ao enviar', description: res.error });
        return;
      }
      toast({ title: 'Email enviado', description: 'Aviso de reativação foi disparado.' });
      onSent();
    } finally {
      setSendingId(null);
    }
  }

  const pagination = totalPages > 1 ? (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        className="h-6 w-6 p-0"
        disabled={page === 0}
        onClick={() => setPage(p => Math.max(0, p - 1))}
        aria-label="Página anterior"
      >
        <ChevronLeft className="h-3 w-3" />
      </Button>
      <span className="text-[10.5px] text-muted-foreground font-medium min-w-[28px] text-center">
        {page + 1} / {totalPages}
      </span>
      <Button
        variant="outline"
        size="icon"
        className="h-6 w-6 p-0"
        disabled={page >= totalPages - 1}
        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
        aria-label="Próxima página"
      >
        <ChevronRight className="h-3 w-3" />
      </Button>
    </div>
  ) : null;

  return (
    <div className="rounded-xl bg-muted/40 p-3 flex flex-col min-h-[280px]">
      <SectionTitle
        icon={BellRing}
        badge={items.length > 0 ? (
          <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full font-medium">{items.length}</span>
        ) : null}
        tooltip="Colaboradores ativos há mais de 14 dias sem postar nada. Botão Avisar envia email lembrete urgente — diferente do convite inicial, com tom de FOMO ('Você está perdendo pontos enquanto sua equipe avança')."
        pagination={pagination}
      >
        Precisam de Empurrão
      </SectionTitle>
      <div className="flex-1 space-y-0">
        {slice.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground py-6">
            Ninguém precisa de empurrão agora. 🎉
          </div>
        ) : (
          slice.map(item => (
            <div key={item.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-border last:border-b-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="text-[10px]">{getInitials(item.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-foreground truncate">{item.name}</div>
                  <div className="text-[10.5px] text-muted-foreground">
                    {item.daysSinceLastPost < 0
                      ? 'Sem primeiro post'
                      : `${item.daysSinceLastPost} dias sem postar`}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleSend(item.id)}
                disabled={sendingId === item.id}
                className="text-[10.5px] font-semibold uppercase tracking-wider text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-full transition-colors disabled:opacity-50"
              >
                {sendingId === item.id ? '...' : 'Avisar'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Top 5 Block ─────────────────────────────────────────────────────

function Top5Block({ data }: { data: DashboardData }) {
  const items = data.topCollaborators.slice(0, 5);

  return (
    <div className="rounded-xl bg-muted/40 p-3 flex flex-col min-h-[280px]">
      <SectionTitle
        icon={Trophy}
        tooltip="Colaboradores com mais pontos ganhos no período selecionado. Use pra reconhecer publicamente — gera competição saudável e modela comportamento desejado pro resto da equipe."
      >
        Top 5 do período
      </SectionTitle>
      <div className="flex-1 space-y-0">
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground py-6">
            Sem dados no período.
          </div>
        ) : (
          items.map((collab, i) => {
            const rankClass = i === 0
              ? 'bg-amber-100 text-amber-700'
              : i === 1
                ? 'bg-zinc-200 text-zinc-700'
                : i === 2
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-muted text-muted-foreground';
            return (
              <div key={collab.id} className="flex items-center gap-2.5 py-1.5 border-b border-border last:border-b-0">
                <span className={`flex items-center justify-center h-6 w-6 rounded-full text-[11px] font-bold shrink-0 ${rankClass}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-foreground truncate">
                    {collab.name}
                    {collab.missionsCompleted > 0 && (
                      <span className="text-[10.5px] text-muted-foreground font-normal ml-1.5">
                        · {collab.missionsCompleted} {collab.missionsCompleted === 1 ? 'missão' : 'missões'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-xs font-bold text-foreground shrink-0">
                  {collab.points.toLocaleString('pt-BR')} pts
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Pipeline TL ────────────────────────────────────────────────────

function PipelineTL({ pipeline }: { pipeline: DashboardData['tlPipeline'] }) {
  const totalKnown = pipeline.backlog + pipeline.em_producao + pipeline.aprovar + pipeline.agendado + pipeline.postado;
  const safeTotal = totalKnown > 0 ? totalKnown : 1;
  const segs = [
    { key: 'backlog', label: 'Backlog', count: pipeline.backlog, color: '#BC9EE0' },
    { key: 'em_producao', label: 'Produção', count: pipeline.em_producao, color: '#A471D1' },
    { key: 'aprovar', label: 'Aprovar', count: pipeline.aprovar, color: '#CD50F1' },
    { key: 'agendado', label: 'Agendado', count: pipeline.agendado, color: '#9840AD' },
    { key: 'postado', label: 'Postado', count: pipeline.postado, color: '#10B981' },
  ];

  return (
    <div className="rounded-xl bg-muted/40 p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground flex-1">
          Pipeline de Conteúdo
        </span>
        <InfoTooltip text="Posts dos TLs em cada etapa de produção. Concentração em 'Aprovar' indica gargalo na revisão (TL não aprovou os ideias/posts). Backlog grande significa que a estrategista produz mais rápido do que o TL consome." />
      </div>
      <div className="flex h-2.5 rounded-full overflow-hidden bg-muted">
        {segs.map(s => (
          <div key={s.key} style={{ width: `${(s.count / safeTotal) * 100}%`, backgroundColor: s.color }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] text-muted-foreground">
        {segs.map(s => (
          <span key={s.key} className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label} <span className="font-semibold text-foreground">{s.count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Chart Card (linha temporal) ────────────────────────────────────

function ChartCard({
  icon: Icon, title, subtitle, currentValue, currentLabel, tooltip,
  data, dataKey, color, valueFormatter,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  currentValue: string;
  currentLabel: string;
  tooltip: string;
  data: MonthlyDataPoint[];
  dataKey: 'impressions' | 'earnedMedia';
  color: string;
  valueFormatter: (v: number) => string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <CardTitle className="text-base flex items-center gap-1.5">
              <Icon className="h-4 w-4 text-primary" />
              {title}
              <InfoTooltip text={tooltip} />
            </CardTitle>
            <CardDescription className="text-xs">{subtitle}</CardDescription>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xl font-bold text-foreground">{currentValue}</div>
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-medium">{currentLabel}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 4" stroke="#E4D8ED" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#9D85B3' }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#9D85B3' }} tickFormatter={valueFormatter} width={48} />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: '#2D1445',
                  border: 'none',
                  borderRadius: 8,
                  color: 'white',
                  fontSize: 12,
                  padding: '8px 12px',
                }}
                labelStyle={{ color: '#E4D8ED', marginBottom: 4 }}
                formatter={(v: number) => [valueFormatter(v), title]}
              />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={2.5}
                fill={`url(#grad-${dataKey})`}
                dot={{ fill: '#fff', stroke: color, strokeWidth: 2.5, r: 4 }}
                activeDot={{ r: 5, fill: color }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Audience Card ──────────────────────────────────────────────────

function AudienceCard({
  icon: Icon, title, items, tooltip,
}: {
  icon: React.ElementType;
  title: string;
  items: AudienceItem[];
  tooltip: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Icon className="h-4 w-4 text-primary" />
          {title}
          <span className="ml-auto">
            <InfoTooltip text={tooltip} />
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {items.length === 0 ? (
          <div className="text-xs text-muted-foreground py-2">Sem dados de audiência ainda. Faça upload do extract do LinkedIn pra ver demografia.</div>
        ) : (
          items.map(item => (
            <div key={item.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-foreground truncate pr-2">{item.label}</span>
                <span className="font-bold text-primary shrink-0">{item.percentage.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, item.percentage)}%`,
                    background: 'linear-gradient(90deg, #CD50F1, #E875FF)',
                  }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// ─── Skeleton ───────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2"><Skeleton className="h-10 w-10 rounded-xl" /></CardHeader>
            <CardContent><Skeleton className="h-3 w-20 mb-2" /><Skeleton className="h-7 w-24" /></CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-[1.6fr_1fr]">
        <Card><CardContent className="pt-6"><Skeleton className="h-96 w-full" /></CardContent></Card>
        <Card><CardContent className="pt-6"><Skeleton className="h-96 w-full" /></CardContent></Card>
      </div>
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const companyId = useResolvedCompanyId();
  const { toast } = useToast();

  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [token, setToken] = useState<string>('');

  const loadData = useCallback(async (isRefresh: boolean = false) => {
    if (!companyId) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const idToken = await getAuthToken();
      setToken(idToken);
      const range = getPeriodRange(period);
      const res = await getAdminDashboardData(idToken, companyId, range);
      if (res.error) {
        toast({ variant: 'destructive', title: 'Erro ao carregar', description: res.error });
        return;
      }
      if (res.data) setData(res.data);
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Erro inesperado', description: 'Não foi possível carregar o dashboard.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId, period, toast]);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  const lastUpdateLabel = useMemo(() => {
    if (!data) return null;
    return formatRelativeTime(data.lastSnapshotAt);
  }, [data]);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-col h-screen">
        <Header />
        <main className="flex-1 overflow-auto p-4 md:p-6">

          {/* Toolbar */}
          <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
              <p className="text-sm text-muted-foreground">Visão geral do programa de employee advocacy</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {lastUpdateLabel && (
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Última atualização: {lastUpdateLabel}
                </span>
              )}
              <div className="inline-flex bg-card border border-border rounded-xl p-1 gap-0.5">
                {PERIOD_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setPeriod(opt.key)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      period === opt.key
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-primary hover:bg-muted'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <Button
                onClick={() => loadData(true)}
                disabled={refreshing || loading}
                size="sm"
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Atualizar dados
              </Button>
            </div>
          </div>

          {loading || !data ? (
            <DashboardSkeleton />
          ) : (
            <div className="space-y-4">

              {/* KPI Banner geral */}
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <KPICard
                  icon={Users}
                  label="Equipe Ativa"
                  value={
                    <>
                      {data.combinedActiveUsers}
                      <span className="text-muted-foreground text-base font-normal"> / {data.combinedTotalUsers}</span>
                    </>
                  }
                  tooltip="Colaboradores e thought leaders que já ativaram a conta (excluindo convites pendentes). O denominador é o total cadastrado, somando Platform e TL."
                />
                <KPICard
                  icon={Send}
                  label="Posts Publicados"
                  value={formatNumber(data.combinedPostsPublished)}
                  delta={<DeltaBadge current={data.combinedPostsPublished} previous={data.prevCombinedPostsPublished} />}
                  tooltip="Total de posts efetivamente publicados no LinkedIn no período, somando Platform e TL. Inclui posts via pipeline da estrategista e posts diretos."
                />
                <KPICard
                  icon={Eye}
                  label="Impressões"
                  value={formatNumber(data.combinedImpressionsInPeriod)}
                  delta={<DeltaBadge current={data.combinedImpressionsInPeriod} previous={data.prevCombinedImpressionsInPeriod} />}
                  tooltip="Quantas vezes os posts da sua equipe apareceram no feed de outras pessoas no LinkedIn. Coletado dos extracts mensais — atualize quando puxar novo arquivo."
                />
                <KPICard
                  icon={DollarSign}
                  label="Earned Media"
                  value={formatCurrency(data.combinedEarnedMediaInPeriod)}
                  delta={<DeltaBadge current={data.combinedEarnedMediaInPeriod} previous={data.prevCombinedEarnedMediaInPeriod} />}
                  tooltip="Valor estimado de mídia ganha — quanto você gastaria em LinkedIn Ads pra atingir as mesmas impressões. Calculado com CPM de R$ 300 a cada mil impressões."
                />
              </div>

              {/* Boxes Platform e TL */}
              <div className="grid gap-4 grid-cols-1 lg:grid-cols-[1.6fr_1fr] items-start">

                {/* Box Platform */}
                <Card>
                  <CardHeader className="pb-3 border-b border-border">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Layers className="h-4 w-4 text-primary" />
                        </div>
                        Programa Platform
                        <InfoTooltip text="Visão consolidada do programa de employee advocacy: engajamento da equipe, jornada de ativação, ranking e quem precisa de atenção. Cobre apenas colaboradores comuns — TLs aparecem no box ao lado." />
                      </CardTitle>
                      <Badge variant="secondary" className="bg-green-500/10 text-green-700 hover:bg-green-500/10">Ativo</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">

                    {/* Stats 3x2 */}
                    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                      <StatMini
                        label="Colaboradores Ativos"
                        value={
                          <>
                            {data.activeCollaborators}
                            <span className="text-muted-foreground text-sm font-normal"> / {data.platformTotalUsers}</span>
                          </>
                        }
                      />
                      <StatMini
                        label="Posts Publicados"
                        value={formatNumber(data.platformPostsPublished)}
                      />
                      <StatMini
                        label="Impressões Geradas"
                        value={formatNumber(data.platformImpressionsInPeriod)}
                      />
                      <StatMini
                        label="Trilhas Concluídas"
                        value={data.trailsCompleted}
                      />
                      <StatMini
                        label="Pontos Distribuídos"
                        value={data.totalPointsDistributed.toLocaleString('pt-BR')}
                        delta={<DeltaBadge current={data.totalPointsDistributed} previous={data.prevPointsDistributed} suffix="vs anterior" />}
                      />
                      <StatMini
                        label="Recompensas Resgatadas"
                        value={data.rewardsRedeemed}
                      />
                    </div>

                    {/* Funil de engajamento */}
                    <FunnelPipeline steps={data.funnelSteps} total={data.platformTotalUsers} />

                    {/* Bento bottom: Top 5 + Empurrão */}
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                      <Top5Block data={data} />
                      <PushNeededBlock
                        items={data.pushNeeded}
                        companyId={companyId || ''}
                        idToken={token}
                        onSent={() => loadData(true)}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Box Thought Leader */}
                <Card className="relative overflow-hidden">
                  <CardHeader className="pb-3 border-b border-border">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                          <Mic className="h-4 w-4 text-amber-500" />
                        </div>
                        Thought Leader
                        <InfoTooltip text="Métricas do plano TL — executivos com produção de conteúdo via pipeline da estrategista. Cada TL tem investimento maior em produção, então as métricas individuais valem mais que as do Platform." />
                      </CardTitle>
                      {data.tlTotalUsers > 0 ? (
                        <Badge variant="secondary" className="bg-green-500/10 text-green-700 hover:bg-green-500/10">Ativo</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Sem TLs</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    {/* Empty state overlay: aparece blur quando nenhum TL cadastrado */}
                    {data.tlTotalUsers === 0 && (
                      <div className="absolute inset-0 top-[60px] z-10 flex items-center justify-center bg-card/60 backdrop-blur-sm rounded-b-xl">
                        <div className="text-center px-6 py-8 max-w-[260px]">
                          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                            <UserPlus className="h-6 w-6 text-amber-500" />
                          </div>
                          <h3 className="text-sm font-bold text-foreground mb-1">
                            Cadastre seu primeiro Thought Leader
                          </h3>
                          <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                            Convide um executivo da sua empresa pra ter um TL produzindo conteúdo com apoio da estrategista.
                          </p>
                          <Link
                            href="/admin/colaboradores"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                          >
                            Gerenciar assentos
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </div>
                    )}


                    {/* Stats 2x2 */}
                    <div className="grid gap-3 grid-cols-2">
                      <StatMini
                        label="TLs Ativos"
                        value={
                          <>
                            {data.tlActiveUsers}
                            <span className="text-muted-foreground text-sm font-normal"> / {data.tlTotalUsers}</span>
                          </>
                        }
                      />
                      <StatMini
                        label="Posts Publicados"
                        value={formatNumber(data.tlPostsPublished)}
                      />
                      <StatMini
                        label="Impressões Geradas"
                        value={formatNumber(data.tlImpressionsInPeriod)}
                      />
                      <StatMini
                        label="Engajamento Total"
                        value={formatNumber(data.tlEngagement)}
                      />
                    </div>

                    {/* Pipeline */}
                    <PipelineTL pipeline={data.tlPipeline} />

                    {/* Top 3 TLs */}
                    <div className="rounded-xl bg-muted/40 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Trophy className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground flex-1">
                          Top 3 TLs no período
                        </span>
                        <InfoTooltip text="Thought Leaders ordenados por impressões geradas no período. Como TL tem investimento alto por pessoa, vale acompanhar quem está dando retorno proporcional." />
                      </div>
                      {data.topThoughtLeaders.length === 0 ? (
                        <div className="text-xs text-muted-foreground py-2">Sem dados de TL no período.</div>
                      ) : (
                        <div className="space-y-0">
                          {data.topThoughtLeaders.map((tl, i) => {
                            const rankClass = i === 0
                              ? 'bg-amber-100 text-amber-700'
                              : i === 1
                                ? 'bg-zinc-200 text-zinc-700'
                                : 'bg-orange-100 text-orange-700';
                            return (
                              <div key={tl.id} className="flex items-center gap-2.5 py-1.5 border-b border-border last:border-b-0">
                                <span className={`flex items-center justify-center h-6 w-6 rounded-full text-[11px] font-bold shrink-0 ${rankClass}`}>
                                  {i + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-semibold text-foreground truncate">{tl.name}</div>
                                </div>
                                <div className="text-xs font-bold text-foreground shrink-0">
                                  {formatNumber(tl.impressions)} impr.
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts row: Earned Media + Impressions */}
              <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                <ChartCard
                  icon={TrendingUp}
                  title="Evolução de Earned Media"
                  subtitle="Últimos 6 meses · valor mensal"
                  currentValue={formatCurrency(data.monthlySeries.at(-1)?.earnedMedia ?? 0)}
                  currentLabel={`${data.monthlySeries.at(-1)?.label ?? '–'} · este mês`}
                  tooltip="Acompanhe se o investimento no programa está se traduzindo em mais valor de mídia ao longo do tempo. Tendência ascendente é o que você quer ver. Quedas indicam queda no volume ou alcance dos posts."
                  data={data.monthlySeries}
                  dataKey="earnedMedia"
                  color="#CD50F1"
                  valueFormatter={(v) => formatCurrency(v)}
                />
                <ChartCard
                  icon={Eye}
                  title="Impressões do Programa"
                  subtitle="Últimos 6 meses · total mensal"
                  currentValue={formatNumber(data.monthlySeries.at(-1)?.impressions ?? 0)}
                  currentLabel={`${data.monthlySeries.at(-1)?.label ?? '–'} · este mês`}
                  tooltip="Crescimento do alcance da sua equipe no LinkedIn. Cresce quando você tem mais posts E mais consistência. Tendência forte mês após mês indica que o efeito composto do programa está funcionando."
                  data={data.monthlySeries}
                  dataKey="impressions"
                  color="#10B981"
                  valueFormatter={(v) => formatNumber(v)}
                />
              </div>

              {/* Audiência */}
              <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                <AudienceCard
                  icon={Briefcase}
                  title="Cargos"
                  items={data.audience.cargos}
                  tooltip="Distribuição dos cargos que estão consumindo o conteúdo da equipe. Compare com seu ICP — se Diretor/VP é maioria mas seu produto vende pra Especialista, repensa a estratégia de conteúdo."
                />
                <AudienceCard
                  icon={Building}
                  title="Indústrias"
                  items={data.audience.industrias}
                  tooltip="Setores que mais consomem o conteúdo. Forte concentração num setor pode indicar nicho dominado — bom pra estratégia de account-based marketing."
                />
                <AudienceCard
                  icon={Maximize2}
                  title="Tamanho da empresa"
                  items={data.audience.tamanhoEmpresa}
                  tooltip="Porte das empresas que mais consomem o conteúdo. Útil pra validar se o programa está atingindo o ICP em tamanho de empresa-alvo (ex: enterprise vs mid-market)."
                />
              </div>

            </div>
          )}

          {/* Loading overlay durante refresh */}
          {refreshing && data && (
            <div className="fixed bottom-6 right-6 bg-card border border-border rounded-xl shadow-lg p-3 flex items-center gap-2 text-xs text-muted-foreground z-50">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Atualizando dados...
            </div>
          )}
        </main>
      </div>
    </TooltipProvider>
  );
}
