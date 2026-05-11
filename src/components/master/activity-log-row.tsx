// src/components/master/activity-log-row.tsx
// Render helper de uma linha do Activity Log na pagina master.
// Mapeia kind -> icone + label + cor da badge. Tudo client-side
// (sem fetch, sem state) — apenas formata uma entry recebida.

'use client';

import {
  Building2,
  UserPlus,
  LogIn,
  Users,
  Settings2,
  CreditCard,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  BookOpen,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type {
  ActivityLogEntry,
  ActivityLogKind,
} from '@/lib/billing/activity-log-types';

interface KindMeta {
  label: string;
  icon: LucideIcon;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
}

const KIND_META: Record<ActivityLogKind, KindMeta> = {
  'company.created': { label: 'Empresa criada', icon: Building2, variant: 'secondary' },
  'company.identity_changed': { label: 'Identidade', icon: Settings2, variant: 'outline' },
  'admin.invited': { label: 'Admin convidado', icon: UserPlus, variant: 'secondary' },
  'admin.first_login': { label: 'Admin entrou', icon: LogIn, variant: 'default' },
  'collaborator.invited': { label: 'Colaborador convidado', icon: Users, variant: 'outline' },
  'collaborator.activated': { label: 'Colaborador ativado', icon: Users, variant: 'default' },
  'billing.status_changed': { label: 'Status do modulo', icon: RefreshCw, variant: 'default' },
  'billing.config_changed': { label: 'Config billing', icon: Settings2, variant: 'outline' },
  'seats.changed': { label: 'Seats alterados', icon: Users, variant: 'outline' },
  'payment.received': { label: 'Pagamento recebido', icon: CreditCard, variant: 'default' },
  'payment.failed': { label: 'Pagamento falhou', icon: AlertTriangle, variant: 'destructive' },
  'subscription.updated': { label: 'Assinatura', icon: RefreshCw, variant: 'outline' },
  'template_personalizado.seeded': { label: 'Trilhas template criadas', icon: BookOpen, variant: 'secondary' },
  'system.log_started': { label: 'Inicio', icon: Sparkles, variant: 'outline' },
};

function formatActor(entry: ActivityLogEntry): string {
  switch (entry.actorRole) {
    case 'master':
      // Mostra ultimos 4 chars do uid pra dar pista sem expor identidade.
      if (entry.actorUid) {
        const last4 = entry.actorUid.slice(-4);
        return `Master (••••${last4})`;
      }
      return 'Master';
    case 'admin':
      if (entry.actorUid) {
        const last4 = entry.actorUid.slice(-4);
        return `Admin (••••${last4})`;
      }
      return 'Admin';
    case 'webhook':
      return 'Sistema (Stripe)';
    case 'system':
    default:
      return 'Sistema';
  }
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface ActivityLogRowProps {
  entry: ActivityLogEntry;
}

export function ActivityLogRow({ entry }: ActivityLogRowProps) {
  const meta = KIND_META[entry.kind] ?? {
    label: entry.kind,
    icon: Sparkles,
    variant: 'outline' as const,
  };
  const Icon = meta.icon;

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30 transition-colors">
      <td className="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap align-top">
        {formatTimestamp(entry.ts)}
      </td>
      <td className="py-2.5 px-3 align-top">
        <Badge variant={meta.variant} className="gap-1 text-[11px] font-normal">
          <Icon className="h-3 w-3" />
          {meta.label}
        </Badge>
      </td>
      <td className="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap align-top">
        {formatActor(entry)}
      </td>
      <td className="py-2.5 px-3 text-sm align-top">{entry.summary}</td>
    </tr>
  );
}
