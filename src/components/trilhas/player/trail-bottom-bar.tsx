// src/components/trilhas/player/trail-bottom-bar.tsx
'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Eye, Rocket, Loader2, SkipForward, ChevronLeft, ChevronRight, BookOpenCheck } from 'lucide-react';
import { useT } from '@/lib/i18n/context';
import type { MappedModule } from './use-trail-player';

type Props = {
  currentModule: MappedModule;
  moduleCompleted: boolean;
  quizSubmitted: boolean;
  saving: boolean;
  videoCompleted: boolean;
  hasRealTracking: boolean;
  playerLoadError: boolean;
  activeModuleIndex: number | null;
  totalModules: number;
  isWorkbook?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onCompleteModule: (moduleId: string, points: number) => void;
  onUnlockMission: () => void;
};

export function TrailBottomBar({
  currentModule, moduleCompleted, quizSubmitted, saving,
  videoCompleted, hasRealTracking, playerLoadError,
  activeModuleIndex, totalModules, isWorkbook,
  onPrev, onNext, onCompleteModule, onUnlockMission,
}: Props) {
  const tp = useT().trailPlayer;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t p-4 z-10">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={onPrev} disabled={activeModuleIndex === 0}>
          <ChevronLeft className="mr-1 h-4 w-4" /> {tp.previous}
        </Button>

        <div className="flex items-center gap-2">
          {!moduleCompleted && !quizSubmitted && (
            <>
              {currentModule.tipo === 'aula' && (
                <Button
                  onClick={() => onCompleteModule(currentModule.id, currentModule.pontuacaoBase || 0)}
                  disabled={hasRealTracking && !videoCompleted && !playerLoadError}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" /> {tp.moduleCompleted}
                </Button>
              )}
              {currentModule.tipo === 'leitura' && (
                <Button onClick={() => onCompleteModule(currentModule.id, currentModule.pontuacaoBase || 0)}>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> {tp.readingCompleted}
                </Button>
              )}
              {currentModule.tipo === 'faca_voce_mesmo' && !isWorkbook && (
                <Button onClick={() => onCompleteModule(currentModule.id, 0)}>
                  <Eye className="mr-2 h-4 w-4" /> {tp.viewed}
                </Button>
              )}
              {currentModule.tipo === 'faca_voce_mesmo' && isWorkbook && (
                <Badge variant="outline" className="text-purple-700 border-purple-300">
                  <BookOpenCheck className="h-3 w-3 mr-1" /> Workbook
                </Badge>
              )}
              {currentModule.tipo === 'missao_conteudo' && (
                <Button onClick={onUnlockMission} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
                  {tp.unlockMission}
                </Button>
              )}
              {!currentModule.obrigatorio && currentModule.tipo !== 'desafio' && (
                <Button variant="ghost" size="sm" onClick={onNext}>
                  <SkipForward className="mr-1 h-4 w-4" /> {tp.skip}
                </Button>
              )}
            </>
          )}

          {moduleCompleted && (
            <Badge variant="outline" className="text-green-700 border-green-300">
              <CheckCircle2 className="h-3 w-3 mr-1" /> {tp.completed}
            </Badge>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={activeModuleIndex === null || activeModuleIndex >= totalModules - 1}
        >
          {tp.next} <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
