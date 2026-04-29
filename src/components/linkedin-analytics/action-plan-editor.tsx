'use client';

/**
 * ActionPlanEditor — Usado pela Estrategista
 * Permite criar, editar, reordenar e deletar itens do plano de ação para um TL.
 * Salva no Firestore via server action updateActionPlan.
 */

import { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  GripVertical,
  Loader2,
  Save,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAuthToken } from '@/lib/auth-client';
import { updateActionPlan } from '@/app/actions/linkedin-analytics';
import type { ActionPlan, ActionPlanItem } from '@/lib/linkedin-analytics-types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ActionPlanEditorProps {
  /** userId do TL */
  tlUserId: string;
  mesAno: string;
  actionPlan: ActionPlan | undefined;
  /** Chamado após salvar com sucesso, passando o plano atualizado */
  onSaved?: (plan: ActionPlan) => void;
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export function ActionPlanEditor({
  tlUserId,
  mesAno,
  actionPlan,
  onSaved,
}: ActionPlanEditorProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<ActionPlanItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Inicializar com o plano existente ou lista vazia
  useEffect(() => {
    setItems(actionPlan?.items ? [...actionPlan.items] : []);
  }, [actionPlan]);

  // ─── Handlers ──────────────────────────────────────────────

  const addItem = () => {
    setItems(prev => [
      ...prev,
      { id: generateId(), text: '', completed: false },
    ]);
  };

  const updateText = (idx: number, text: string) => {
    setItems(prev => prev.map((item, i) => (i === idx ? { ...item, text } : item)));
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const toggleCompleted = (idx: number) => {
    setItems(prev =>
      prev.map((item, i) =>
        i === idx
          ? {
              ...item,
              completed: !item.completed,
              completedAt: !item.completed ? new Date().toISOString() : undefined,
            }
          : item,
      ),
    );
  };

  // Drag-and-drop reordering
  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };
  const handleDrop = (targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) return;
    setItems(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
    setDragIdx(null);
    setDragOverIdx(null);
  };
  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  // ─── Save ──────────────────────────────────────────────────

  const handleSave = async () => {
    // Remover itens sem texto antes de salvar
    const validItems = items.filter(i => i.text.trim().length > 0);
    setIsSaving(true);
    try {
      const token = await getAuthToken();
      const result = await updateActionPlan(token, tlUserId, mesAno, validItems);
      if (result.success) {
        toast({ title: 'Plano de ação salvo!' });
        setItems(validItems);
        onSaved?.({
          updatedAt: new Date().toISOString(),
          updatedBy: '', // será preenchido pelo server
          items: validItems,
        });
      } else {
        toast({ variant: 'destructive', title: 'Erro ao salvar', description: result.error });
      }
    } catch (e) {
      console.error('[ActionPlanEditor] save error:', e);
      toast({ variant: 'destructive', title: 'Erro inesperado ao salvar.' });
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Lista de itens */}
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-muted-foreground/30 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum item ainda. Clique em "Adicionar item" para começar.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item, idx) => (
            <li
              key={item.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              onDragEnd={handleDragEnd}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-2 py-1.5 bg-background transition-colors',
                dragIdx === idx && 'opacity-50',
                dragOverIdx === idx && dragIdx !== idx && 'border-primary bg-primary/5',
              )}
            >
              {/* Drag handle */}
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground cursor-grab active:cursor-grabbing" />

              {/* Toggle completado */}
              <button
                type="button"
                onClick={() => toggleCompleted(idx)}
                className="shrink-0"
                title={item.completed ? 'Marcar como pendente' : 'Marcar como concluído'}
              >
                {item.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                )}
              </button>

              {/* Input de texto */}
              <Input
                value={item.text}
                onChange={(e) => updateText(idx, e.target.value)}
                placeholder="Descreva a ação..."
                className={cn(
                  'flex-1 h-8 text-sm border-0 bg-transparent shadow-none focus-visible:ring-0 px-0',
                  item.completed && 'line-through text-muted-foreground',
                )}
                disabled={isSaving}
              />

              {/* Remover */}
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => removeItem(idx)}
                disabled={isSaving}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* Adicionar item */}
      <Button
        variant="ghost"
        size="sm"
        className="text-xs w-full justify-start gap-1.5 text-muted-foreground hover:text-foreground"
        onClick={addItem}
        disabled={isSaving}
      >
        <Plus className="h-3.5 w-3.5" />
        Adicionar item
      </Button>

      {/* Salvar */}
      <div className="flex justify-end pt-1">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving || items.every(i => !i.text.trim())}
        >
          {isSaving ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="mr-2 h-3.5 w-3.5" />
          )}
          Salvar plano
        </Button>
      </div>
    </div>
  );
}
