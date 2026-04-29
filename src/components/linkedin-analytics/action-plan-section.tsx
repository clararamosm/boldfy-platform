'use client';

/**
 * ActionPlanSection — Wrapper do plano de ação.
 * Decide se renderiza o editor (estrategista) ou o checklist (TL/read-only).
 */

import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import type { ActionPlan, ActionPlanItem } from '@/lib/linkedin-analytics-types';
import { ActionPlanChecklist } from './action-plan-checklist';
import { ActionPlanEditor } from './action-plan-editor';

interface ActionPlanSectionProps {
  tlUserId: string;
  mesAno: string;
  actionPlan: ActionPlan | undefined;
  /** false = TL (checklist interativo), true = estrategista (editor completo) */
  canEdit?: boolean;
}

export function ActionPlanSection({
  tlUserId,
  mesAno,
  actionPlan: initialPlan,
  canEdit = false,
}: ActionPlanSectionProps) {
  const [actionPlan, setActionPlan] = useState<ActionPlan | undefined>(initialPlan);

  // Callback do checklist (TL togglea item)
  const handleItemToggled = (itemId: string, completed: boolean) => {
    setActionPlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map(item =>
          item.id === itemId
            ? { ...item, completed, completedAt: completed ? new Date().toISOString() : undefined }
            : item,
        ),
      };
    });
  };

  // Callback do editor (estrategista salvou)
  const handleSaved = (plan: ActionPlan) => {
    setActionPlan(plan);
  };

  return (
    <div className="rounded-xl border bg-card p-5">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 mb-4">
        <ClipboardList className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Plano de Ação</h3>
        {actionPlan && actionPlan.items.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            {actionPlan.items.filter(i => i.completed).length}/{actionPlan.items.length} concluídos
          </span>
        )}
      </div>

      {canEdit ? (
        <ActionPlanEditor
          tlUserId={tlUserId}
          mesAno={mesAno}
          actionPlan={actionPlan}
          onSaved={handleSaved}
        />
      ) : (
        <ActionPlanChecklist
          tlUserId={tlUserId}
          mesAno={mesAno}
          actionPlan={actionPlan}
          readOnly={false}
          onItemToggled={handleItemToggled}
        />
      )}
    </div>
  );
}
