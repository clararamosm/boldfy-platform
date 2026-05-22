// src/components/trilhas/player/trail-conclusion-screen.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen, Rocket, Trophy } from 'lucide-react';
import { useT } from '@/lib/i18n/context';
import { interpolate } from '@/lib/i18n';
import type { Trilha, ProgressoTrilha } from '@/types/trilhas';

type Props = {
  trail: Trilha;
  progress: ProgressoTrilha | null;
  onBack: () => void;
  onReview: () => void;
  onGoToMissions: () => void;
};

export function TrailConclusionScreen({ trail, progress, onBack, onReview, onGoToMissions }: Props) {
  const tp = useT().trailPlayer;
  // Bug fix maio/2026: o "bônus de conclusão" exibido aqui agora vem de
  // `pontuacaoBonusTrilha` (que é o REAL bônus configurado pelo Master por
  // completar a trilha inteira). Antes vinha de `pontuacaoBonus`, que na
  // verdade é a soma dos bônus dos módulos de quiz — label confundia o user.
  const completionBonus = trail.pontuacaoBonusTrilha || 0;
  const modulePoints = progress?.pontosGanhos ? progress.pontosGanhos - completionBonus : 0;

  return (
    <div className="fixed inset-0 bg-background z-50 overflow-auto">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <Trophy className="h-10 w-10 text-green-600" />
            </div>
            <CardTitle className="text-2xl text-green-800">{tp.trailCompleted}</CardTitle>
            <CardDescription className="text-green-700 text-base">
              {interpolate(tp.congratulations, { title: trail.titulo })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-white rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">{tp.modulePoints}</span>
                <span className="font-semibold">{modulePoints > 0 ? modulePoints : 0}</span>
              </div>
              {completionBonus > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{tp.completionBonusLabel}</span>
                  <span className="font-semibold text-amber-600">+{completionBonus}</span>
                </div>
              )}
              <hr />
              <div className="flex justify-between items-center text-lg">
                <span className="font-bold">{tp.total}</span>
                <span className="font-bold text-primary">
                  {interpolate(tp.pointsValue, { points: progress?.pontosGanhos || 0 })}
                </span>
              </div>
            </div>

            {trail.missaoGatilho && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <Rocket className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-blue-800">{tp.newMissionCreated}</p>
                <p className="text-xs text-blue-600 mt-1">
                  Complete em ate {trail.missaoGatilho.prazoDias || 14} dias para ganhar os pontos
                </p>
                <Button
                  variant="outline"
                  className="mt-2 border-blue-300 text-blue-700"
                  onClick={onGoToMissions}
                >
                  {tp.viewMissions}
                </Button>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={onBack}>
                <ArrowLeft className="mr-2 h-4 w-4" /> {tp.backToTrails}
              </Button>
              <Button className="flex-1" onClick={onReview}>
                <BookOpen className="mr-2 h-4 w-4" /> {tp.reviewTrail}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
