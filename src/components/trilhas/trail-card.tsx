'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Pencil, Trash2, BarChart3, Loader2, Zap } from 'lucide-react';
import type { Trilha } from '@/types/trilhas';

export type TrailCardProps = {
  trail: Trilha;
  /** Show edit button (builder) */
  onEdit?: () => void;
  /** Show delete button */
  onDelete?: () => void;
  /** Show analytics button */
  onAnalytics?: () => void;
  /** Show toggle switch for ativa/desativada */
  onToggle?: () => void;
  /** For global trails in admin view — uses Switch with custom active state */
  isActive?: boolean;
  /** Loading state for toggle */
  isToggling?: boolean;
};

export function TrailCard({
  trail, onEdit, onDelete, onAnalytics, onToggle,
  isActive, isToggling,
}: TrailCardProps) {
  const active = isActive !== undefined ? isActive : trail.ativa;

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${active ? 'bg-purple-50 border-purple-200' : 'bg-gray-50'}`}>
      <div className="flex items-center gap-3 flex-1">
        <div className={`w-2.5 h-2.5 rounded-full ${active ? 'bg-green-500' : 'bg-gray-300'}`} />
        <div>
          <p className="font-medium text-sm">{trail.titulo}</p>
          <p className="text-xs text-muted-foreground line-clamp-1">{trail.descricao}</p>
          <div className="flex gap-2 mt-1">
            <Badge variant="secondary" className="text-xs">{(trail.modulos || []).length} modulos</Badge>
            <Badge variant="secondary" className="text-xs"><Zap className="w-3 h-3 mr-1 text-yellow-500" />{trail.pontuacaoTotal || 0} pontos</Badge>
            {trail.pontuacaoBonus > 0 && (
              <Badge variant="outline" className="text-xs text-yellow-600">+{trail.pontuacaoBonus} bonus</Badge>
            )}
            <Badge variant="outline" className="text-xs">{trail.tempoEstimadoMin || 0} min</Badge>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onAnalytics && (
          <Button variant="ghost" size="icon" onClick={onAnalytics}>
            <BarChart3 className="w-4 h-4 text-blue-500" />
          </Button>
        )}
        {onEdit && (
          <Button variant="ghost" size="icon" onClick={onEdit}>
            <Pencil className="w-4 h-4" />
          </Button>
        )}
        {onDelete && (
          <Button variant="ghost" size="icon" onClick={onDelete}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        )}
        {onToggle && (
          <div className="flex items-center gap-2">
            {isToggling ? <Loader2 className="w-4 h-4 animate-spin" /> : (
              <Switch checked={active} onCheckedChange={onToggle} />
            )}
            <span className="text-xs text-muted-foreground w-16">{active ? 'Ativada' : 'Desativada'}</span>
          </div>
        )}
      </div>
    </div>
  );
}
