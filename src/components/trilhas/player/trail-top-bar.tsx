// src/components/trilhas/player/trail-top-bar.tsx
'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Play, BookOpen, HelpCircle, Wrench, Target,
  X, Star, Loader2, Menu, CheckCircle2, Lock,
} from 'lucide-react';
import { useT } from '@/lib/i18n/context';
import type { ModuloModo } from '@/types/trilhas';
import type { MappedModule } from './use-trail-player';

const MODO_ICONS: Record<ModuloModo, React.ComponentType<{ className?: string }>> = {
  aula: Play,
  leitura: BookOpen,
  desafio: HelpCircle,
  faca_voce_mesmo: Wrench,
  missao_conteudo: Target,
};

type Props = {
  trailTitle: string;
  currentModule: MappedModule;
  progressPercent: number;
  reviewMode: boolean;
  sidebarOpen: boolean;
  saving: boolean;
  sortedModules: MappedModule[];
  activeModuleIndex: number | null;
  isModuleCompleted: (id: string) => boolean;
  canAccessModule: (idx: number) => boolean;
  onToggleSidebar: () => void;
  onClose: () => void;
  onGoToModule: (idx: number) => void;
};

export function TrailTopBar({
  trailTitle, currentModule, progressPercent, reviewMode,
  sidebarOpen, saving, sortedModules, activeModuleIndex,
  isModuleCompleted, canAccessModule,
  onToggleSidebar, onClose, onGoToModule,
}: Props) {
  const tp = useT().trailPlayer;
  const MODO_LABELS: Record<ModuloModo, string> = {
    aula: tp.modoAula,
    leitura: tp.modoLeitura,
    desafio: tp.modoDesafio,
    faca_voce_mesmo: tp.modoPratica,
    missao_conteudo: tp.modoMissao,
  };

  const ModoIcon = MODO_ICONS[currentModule.tipo] || BookOpen;

  return (
    <>
      {/* Top bar */}
      <div className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onToggleSidebar}>
            <Menu className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
          <span className="text-sm font-medium hidden sm:inline">{trailTitle}</span>
          {reviewMode && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">
              {tp.reviewMode}
            </Badge>
          )}
        </div>

        <div className="flex-1 max-w-md mx-4">
          <Progress value={progressPercent} className="h-2" />
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Badge variant="outline">
            <ModoIcon className="h-3 w-3 mr-1" />
            {MODO_LABELS[currentModule.tipo]}
          </Badge>
          {currentModule.tipo !== 'faca_voce_mesmo' && currentModule.tipo !== 'missao_conteudo' && (
            <Badge variant="secondary">
              <Star className="h-3 w-3 mr-1" />
              {currentModule.tipo === 'desafio'
                ? (currentModule.conteudo?.pontuacaoBase || 0) + ' ' + tp.points
                : (currentModule.pontuacaoBase || 0) + ' ' + tp.points}
            </Badge>
          )}
          {currentModule.tipo === 'missao_conteudo' && (currentModule.missaoGatilho?.pontosRecompensa || 0) > 0 && (
            <Badge variant="outline" className="border-blue-300 text-blue-700">
              <Star className="h-3 w-3 mr-1" />
              {currentModule.missaoGatilho?.pontosRecompensa} pts na missao
            </Badge>
          )}
          {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div className="w-72 border-r bg-card overflow-y-auto shrink-0 absolute left-0 top-14 bottom-0 z-20">
          <div className="p-4 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">{tp.modulesLabel}</p>
            {sortedModules.map((mod, idx) => {
              const Icon = MODO_ICONS[mod.tipo] || BookOpen;
              const completed = isModuleCompleted(mod.id);
              const active = idx === activeModuleIndex;
              const locked = !canAccessModule(idx);
              return (
                <button
                  key={mod.id}
                  onClick={() => onGoToModule(idx)}
                  disabled={locked}
                  className={`flex items-center gap-3 w-full text-left p-2.5 rounded-lg text-sm transition-colors ${
                    active ? 'bg-primary/10 text-primary font-medium' :
                    completed ? 'text-green-700 hover:bg-green-50' :
                    locked ? 'text-muted-foreground/50 cursor-not-allowed' :
                    'hover:bg-muted'
                  }`}
                >
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full shrink-0 ${
                    completed ? 'bg-green-100 text-green-700' :
                    active ? 'bg-primary/20 text-primary' :
                    locked ? 'bg-muted text-muted-foreground/50' :
                    'bg-muted'
                  }`}>
                    {completed ? <CheckCircle2 className="h-4 w-4" /> :
                     locked ? <Lock className="h-3 w-3" /> :
                     <Icon className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{mod.titulo}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {!mod.obrigatorio && (
                        <span className="text-xs text-muted-foreground">{tp.optional}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
