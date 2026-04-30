'use client';

import { cn } from '@/lib/utils';
import type { ProfileSemanticAlignment } from '@/lib/linkedin-analytics-types';
import { CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface AlignmentScoreBadgeProps {
  alignment: ProfileSemanticAlignment;
  showIssues?: boolean;
  compact?: boolean;
}

export function AlignmentScoreBadge({
  alignment,
  showIssues = true,
  compact = false,
}: AlignmentScoreBadgeProps) {
  const [expanded, setExpanded] = useState(false);

  const { score, passesAudit, issues } = alignment;

  const colorClass =
    score >= 70
      ? 'bg-green-50 border-green-200 text-green-700'
      : score >= 40
        ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
        : 'bg-red-50 border-red-200 text-red-700';

  const Icon = passesAudit ? CheckCircle2 : XCircle;
  const iconClass = score >= 70 ? 'text-green-600' : score >= 40 ? 'text-yellow-600' : 'text-red-600';

  if (compact) {
    return (
      <div className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium border', colorClass)}>
        <Icon className={cn('h-4 w-4', iconClass)} />
        <span>Score 360Brew: {score}</span>
        <span className="text-xs opacity-70">{passesAudit ? '✓ Passa' : '✗ Não passa'}</span>
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border p-4', colorClass)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('text-3xl font-bold tabular-nums', iconClass)}>{score}</div>
          <div>
            <div className="flex items-center gap-1.5">
              <Icon className={cn('h-4 w-4', iconClass)} />
              <span className="font-semibold text-sm">
                {passesAudit ? 'Passa na auditoria 360Brew' : 'Não passa na auditoria 360Brew'}
              </span>
            </div>
            <p className="text-xs opacity-75 mt-0.5">
              {passesAudit
                ? 'Perfil otimizado — distribuição desbloqueada'
                : 'Perfil otimizado — alcance ainda limitado'}
            </p>
          </div>
        </div>
        {showIssues && issues.length > 0 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs opacity-75 hover:opacity-100 transition-opacity"
          >
            {issues.length} {issues.length === 1 ? 'issue' : 'issues'}
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        )}
      </div>

      {/* Barra de progresso */}
      <div className="mt-3 h-2 rounded-full bg-black/10 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500',
          )}
          style={{ width: `${score}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs opacity-60">
        <span>0</span>
        <span className="font-medium">Threshold: 40</span>
        <span>100</span>
      </div>

      {/* Lista de issues */}
      {showIssues && expanded && issues.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-current/20 pt-3">
          {issues.map((issue, i) => (
            <div key={i} className="flex gap-2 text-sm">
              <AlertTriangle
                className={cn(
                  'h-4 w-4 shrink-0 mt-0.5',
                  issue.severity === 'high'
                    ? 'text-red-500'
                    : issue.severity === 'medium'
                      ? 'text-yellow-500'
                      : 'text-blue-500',
                )}
              />
              <div>
                <p className="font-medium">{issue.description}</p>
                <p className="opacity-75">{issue.fix}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
