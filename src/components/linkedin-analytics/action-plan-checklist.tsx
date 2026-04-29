'use client';

/**
 * ActionPlanChecklist — Usado pelo TL
 * Exibe a lista de itens do plano de ação e permite marcar/desmarcar cada um.
 * Modo read-only opcional (para estrategista visualizar sem editar).
 */

import { useState } from 'react';
import { CheckCircle2, Circle, Loader2, ClipboardList } from 'lucide-react';
import { getAuthToken } from '@/lib/auth-client';
import { toggleActionPlanItem } from '@/app/actions/linkedin-analytics';
import type { ActionPlan, ActionPlanItem } from '@/lib/linkedin-analytics-types';
import { cn } from '@/lib/utils';

interface ActionPlanChecklistProps {
  /** userId do TL dono do plano */
  tlUserId: string;
  mesAno: string;
  actionPlan: ActionPlan | undefined;
  /** Se true, não renderiza checkboxes interativos */
  readOnly?: boolean;
  /** Chamado após toggle bem-sucedido para atualizar o estado pai */
  onItemToggled?: (itemId: string, completed: boolean) => void;
}

export function ActionPlanChecklist({
  tlUserId,
  mesAno,
  actionPlan,
  readOnly = false,
  onItemToggled,
}: ActionPlanChecklistProps) {
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleToggle = async (item: ActionPlanItem) => {
    if (readOnly || togglingId) return;
    setTogglingId(item.id);
    try {
      const token = await getAuthToken();
      const result = await toggleActionPlanItem(token, tlUserId, mesAno, item.id, !item.completed);
      if (result.success) {
        onItemToggled?.(item.id, !item.completed);
      }
    } catch (e) {
      console.error('[ActionPlanChecklist] toggle error:', e);
    } finally {
      setTogglingId(null);
    }
  };

  if (!actionPlan || actionPlan.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2 text-center text-muted-foreground">
        <ClipboardList className="h-8 w-8 opacity-40" />
        <p className="text-sm">Nenhum item no plano de ação ainda.</p>
        {readOnly && (
          <p className="text-xs opacity-60">A estrategista adicionará os itens em breve.</p>
        )}
      </div>
    );
  }

  const completed = actionPlan.items.filter(i => i.completed).length;
  const total = actionPlan.items.length;

  return (
    <div className="space-y-3">
      {/* Progresso */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {completed}/{total}
        </span>
      </div>

      {/* Lista de itens */}
      <ul className="space-y-2">
        {actionPlan.items.map(item => (
          <li key={item.id}>
            <button
              type="button"
              disabled={readOnly || togglingId === item.id}
              onClick={() => handleToggle(item)}
              className={cn(
                'w-full flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                !readOnly && 'hover:bg-muted/50 cursor-pointer',
                readOnly && 'cursor-default',
                item.completed && 'bg-muted/30 border-muted',
              )}
            >
              {/* Ícone de status */}
              <span className="mt-0.5 shrink-0">
                {togglingId === item.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : item.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
              </span>

              {/* Texto */}
              <span
                className={cn(
                  'text-sm leading-snug',
                  item.completed && 'line-through text-muted-foreground',
                )}
              >
                {item.text}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* Última atualização */}
      {actionPlan.updatedAt && (
        <p className="text-xs text-muted-foreground text-right">
          Atualizado em{' '}
          {new Date(actionPlan.updatedAt).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </p>
      )}
    </div>
  );
}
