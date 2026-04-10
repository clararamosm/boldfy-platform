// src/components/trilhas/player/trail-intro-screen.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, BookOpen, Clock, Rocket, Trophy } from 'lucide-react';
import { CoinIcon } from '@/components/coin-icon';
import { useT } from '@/lib/i18n/context';
import { interpolate } from '@/lib/i18n';
import type { Trilha } from '@/types/trilhas';

type Props = {
  trail: Trilha;
  sortedModulesCount: number;
  completedCount: number;
  totalModules: number;
  progressPercent: number;
  onStart: () => void;
  onBack: () => void;
};

export function TrailIntroScreen({ trail, sortedModulesCount, completedCount, totalModules, progressPercent, onStart, onBack }: Props) {
  const tp = useT().trailPlayer;
  const hasStarted = completedCount > 0;

  return (
    <div className="fixed inset-0 bg-background z-50 overflow-auto">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Button variant="ghost" onClick={onBack} className="mb-8">
          <ArrowLeft className="mr-2 h-4 w-4" /> {tp.backToTrails}
        </Button>

        <Card>
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">{trail.titulo}</CardTitle>
            {trail.descricao && (
              <CardDescription className="text-base mt-2">{trail.descricao}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1 text-2xl font-bold text-primary">
                  <CoinIcon className="h-5 w-5 text-yellow-500" />
                  {trail.pontuacaoTotal || 0}
                </div>
                <p className="text-xs text-muted-foreground">{tp.pointsAvailable}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1 text-2xl font-bold">
                  <BookOpen className="h-5 w-5" />
                  {sortedModulesCount}
                </div>
                <p className="text-xs text-muted-foreground">{tp.modulesLabel}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1 text-2xl font-bold">
                  <Clock className="h-5 w-5" />
                  {trail.tempoEstimadoMin || '?'}
                </div>
                <p className="text-xs text-muted-foreground">{tp.minutesLabel}</p>
              </div>
            </div>

            {hasStarted && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{tp.progress}</span>
                  <span>{interpolate(tp.modulesCount, { done: completedCount, total: totalModules })}</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>
            )}

            {trail.pontuacaoBonus > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                <p className="text-sm text-amber-800">
                  <Trophy className="inline h-4 w-4 mr-1" />
                  {interpolate(tp.completionBonus, { points: trail.pontuacaoBonus })}
                </p>
              </div>
            )}

            <Button className="w-full" size="lg" onClick={onStart}>
              {hasStarted ? (
                <><ArrowRight className="mr-2 h-5 w-5" /> {tp.continueTrail}</>
              ) : (
                <><Rocket className="mr-2 h-5 w-5" /> {tp.startTrail}</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
