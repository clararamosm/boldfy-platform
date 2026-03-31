// src/app/influencer/trilhas/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection, getDocs, doc, getDoc, setDoc, updateDoc, Timestamp, increment
} from 'firebase/firestore';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen, Video, HelpCircle, Loader2, ChevronDown, ChevronUp,
  CheckCircle2, Circle, Play, ArrowLeft, Trophy
} from 'lucide-react';

// ---- Types ----
interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
}

interface Phase {
  title: string;
  type: 'texto' | 'video' | 'quiz';
  content: string;
  quiz?: QuizQuestion[];
  order: number;
}

interface Trail {
  id: string;
  title: string;
  description: string;
  phases: Phase[];
  pointsReward: number;
  active: boolean;
  order: number;
}

interface TrailProgress {
  completedPhases: number[];
  startedAt: any;
  completedAt?: any;
}

// ---- Component ----
export default function TrilhasPage() {
  const [trails, setTrails] = useState<Trail[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, TrailProgress>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // View states
  const [selectedTrail, setSelectedTrail] = useState<Trail | null>(null);
  const [activePhaseIndex, setActivePhaseIndex] = useState<number | null>(null);

  // Quiz state
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);

  const { toast } = useToast();

  // ---- Auth + Load ----
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user: User | null) => {
      if (!user) return;
      setUserId(user.uid);
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        if (userData?.companyId) {
          setCompanyId(userData.companyId);
        }
      } catch (err) {
        console.error('Error loading user:', err);
      }
    });
    return () => unsub();
  }, []);

  const loadData = useCallback(async () => {
    if (!companyId || !userId) return;
    setIsLoading(true);
    try {
      const trailsRef = collection(db, 'companies', companyId, 'trails');
      const trailsSnap = await getDocs(trailsRef);
      const trailsData = trailsSnap.docs
        .map(d => ({ id: d.id, ...d.data(), phases: d.data().phases || [] }) as Trail)
        .filter(t => t.active)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      setTrails(trailsData);

      const progressRef = collection(db, 'users', userId, 'trailProgress');
      const progressSnap = await getDocs(progressRef);
      const pMap: Record<string, TrailProgress> = {};
      progressSnap.docs.forEach(d => {
        pMap[d.id] = d.data() as TrailProgress;
      });
      setProgressMap(pMap);
    } catch (err) {
      console.error('Error loading data:', err);
      toast({ title: 'Erro', description: 'Erro ao carregar trilhas', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [companyId, userId, toast]);

  useEffect(() => {
    if (companyId && userId) loadData();
  }, [companyId, userId, loadData]);

  // ---- Progress helpers ----
  const getProgress = (trailId: string, totalPhases: number) => {
    const prog = progressMap[trailId];
    if (!prog || totalPhases === 0) return 0;
    return Math.round((prog.completedPhases.length / totalPhases) * 100);
  };

  const isPhaseCompleted = (trailId: string, phaseIndex: number) => {
    return progressMap[trailId]?.completedPhases?.includes(phaseIndex) || false;
  };

  const isTrailCompleted = (trail: Trail) => {
    const prog = progressMap[trail.id];
    return prog?.completedPhases?.length === trail.phases.length && trail.phases.length > 0;
  };

  // ---- Complete phase ----
  const completePhase = async (trail: Trail, phaseIndex: number) => {
    if (!userId || !companyId) return;
    const progressRef = doc(db, 'users', userId, 'trailProgress', trail.id);
    const existing = progressMap[trail.id];

    try {
      if (existing) {
        if (existing.completedPhases.includes(phaseIndex)) return;
        const newCompleted = [...existing.completedPhases, phaseIndex];
        const isFullyComplete = newCompleted.length === trail.phases.length;

        await updateDoc(progressRef, {
          completedPhases: newCompleted,
          ...(isFullyComplete ? { completedAt: Timestamp.now() } : {}),
        });

        if (isFullyComplete && trail.pointsReward > 0) {
          const userRef = doc(db, 'users', userId);
          await updateDoc(userRef, { points: increment(trail.pointsReward) });
          toast({ title: 'Trilha Completa!', description: `Voce ganhou ${trail.pointsReward} pontos!` });
        }
      } else {
        const newCompleted = [phaseIndex];
        const isFullyComplete = newCompleted.length === trail.phases.length;

        await setDoc(progressRef, {
          completedPhases: newCompleted,
          startedAt: Timestamp.now(),
          ...(isFullyComplete ? { completedAt: Timestamp.now() } : {}),
        });

        if (isFullyComplete && trail.pointsReward > 0) {
          const userRef = doc(db, 'users', userId);
          await updateDoc(userRef, { points: increment(trail.pointsReward) });
          toast({ title: 'Trilha Completa!', description: `Voce ganhou ${trail.pointsReward} pontos!` });
        }
      }
      loadData();
    } catch (err) {
      console.error('Error completing phase:', err);
      toast({ title: 'Erro', description: 'Erro ao salvar progresso', variant: 'destructive' });
    }
  };

  // ---- Quiz submit ----
  const handleQuizSubmit = (trail: Trail, phaseIndex: number) => {
    const phase = trail.phases[phaseIndex];
    if (!phase.quiz) return;
    let correct = 0;
    phase.quiz.forEach((q, i) => {
      if (quizAnswers[i] === q.correctAnswer) correct++;
    });
    setQuizScore(correct);
    setQuizSubmitted(true);
    const passingScore = Math.ceil(phase.quiz.length * 0.7);
    if (correct >= passingScore) {
      completePhase(trail, phaseIndex);
      toast({ title: 'Aprovado!', description: `${correct}/${phase.quiz.length} corretas` });
    } else {
      toast({
        title: 'Tente novamente',
        description: `${correct}/${phase.quiz.length} corretas. Precisa de ${passingScore} para passar.`,
        variant: 'destructive',
      });
    }
  };

  // ---- Phase type icon ----
  const phaseIcon = (type: string) => {
    switch (type) {
      case 'texto': return <BookOpen className="h-4 w-4" />;
      case 'video': return <Video className="h-4 w-4" />;
      case 'quiz': return <HelpCircle className="h-4 w-4" />;
      default: return <Circle className="h-4 w-4" />;
    }
  };

  // ---- Loading ----
  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Header title="Trilhas de Aprendizado" subtitle="Continue aprendendo e ganhando pontos" />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // ---- Phase detail view ----
  if (selectedTrail && activePhaseIndex !== null) {
    const phase = selectedTrail.phases[activePhaseIndex];
    const completed = isPhaseCompleted(selectedTrail.id, activePhaseIndex);

    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { setActivePhaseIndex(null); setQuizAnswers({}); setQuizSubmitted(false); }}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div>
            <h2 className="text-lg font-semibold">{phase.title || `Fase ${activePhaseIndex + 1}`}</h2>
            <p className="text-sm text-muted-foreground">{selectedTrail.title}</p>
          </div>
          {completed && <Badge className="bg-green-100 text-green-800">Concluida</Badge>}
        </div>

        <Card>
          <CardContent className="pt-6">
            {phase.type === 'texto' && (
              <div className="space-y-4">
                <div className="prose max-w-none whitespace-pre-wrap">{phase.content}</div>
                {!completed && (
                  <Button onClick={() => completePhase(selectedTrail, activePhaseIndex)} className="w-full">
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Marcar como concluida
                  </Button>
                )}
              </div>
            )}

            {phase.type === 'video' && (
              <div className="space-y-4">
                {phase.content && (
                  <div className="aspect-video rounded-lg overflow-hidden bg-black">
                    <iframe
                      src={phase.content.replace('watch?v=', 'embed/')}
                      className="w-full h-full"
                      allowFullScreen
                    />
                  </div>
                )}
                {!completed && (
                  <Button onClick={() => completePhase(selectedTrail, activePhaseIndex)} className="w-full">
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Marcar como concluida
                  </Button>
                )}
              </div>
            )}

            {phase.type === 'quiz' && phase.quiz && (
              <div className="space-y-6">
                {phase.quiz.map((q, qIdx) => (
                  <div key={qIdx} className="space-y-3">
                    <p className="font-medium">{qIdx + 1}. {q.question}</p>
                    <div className="space-y-2">
                      {q.options.map((opt, oIdx) => {
                        const isSelected = quizAnswers[qIdx] === oIdx;
                        const isCorrect = quizSubmitted && oIdx === q.correctAnswer;
                        const isWrong = quizSubmitted && isSelected && oIdx !== q.correctAnswer;
                        return (
                          <div
                            key={oIdx}
                            onClick={() => { if (!quizSubmitted) setQuizAnswers({ ...quizAnswers, [qIdx]: oIdx }); }}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                              isCorrect ? 'border-green-500 bg-green-50' :
                              isWrong ? 'border-red-500 bg-red-50' :
                              isSelected ? 'border-primary bg-primary/5' :
                              'border-border hover:border-primary/50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                                isSelected ? 'border-primary' : 'border-muted-foreground'
                              }`}>
                                {isSelected && <div className="h-2 w-2 rounded-full bg-primary" />}
                              </div>
                              <span className="text-sm">{opt}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {!quizSubmitted ? (
                  <Button
                    onClick={() => handleQuizSubmit(selectedTrail, activePhaseIndex)}
                    disabled={Object.keys(quizAnswers).length < (phase.quiz?.length || 0)}
                    className="w-full"
                  >
                    Enviar Respostas
                  </Button>
                ) : (
                  <div className="text-center space-y-2">
                    <p className="font-medium">
                      Resultado: {quizScore}/{phase.quiz.length} corretas
                    </p>
                    {!isPhaseCompleted(selectedTrail.id, activePhaseIndex) && (
                      <Button onClick={() => { setQuizAnswers({}); setQuizSubmitted(false); }} variant="outline">
                        Tentar Novamente
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Trail detail view (phases list) ----
  if (selectedTrail) {
    const progress = getProgress(selectedTrail.id, selectedTrail.phases.length);
    const completed = isTrailCompleted(selectedTrail);

    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedTrail(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">{selectedTrail.title}</h2>
            <p className="text-sm text-muted-foreground">{selectedTrail.description}</p>
          </div>
          {completed && (
            <Badge className="bg-green-100 text-green-800">
              <Trophy className="h-3 w-3 mr-1" /> Completa
            </Badge>
          )}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Progresso da Trilha</CardDescription>
              <span className="text-sm font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </CardHeader>
        </Card>

        <div className="space-y-2">
          {selectedTrail.phases.map((phase, idx) => {
            const phaseCompleted = isPhaseCompleted(selectedTrail.id, idx);
            return (
              <Card
                key={idx}
                className={`cursor-pointer transition-colors hover:bg-muted/50 ${phaseCompleted ? 'opacity-75' : ''}`}
                onClick={() => { setActivePhaseIndex(idx); setQuizAnswers({}); setQuizSubmitted(false); }}
              >
                <CardContent className="flex items-center gap-4 py-4">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                    phaseCompleted ? 'bg-green-100 text-green-600' : 'bg-muted text-muted-foreground'
                  }`}>
                    {phaseCompleted ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-sm font-medium">{idx + 1}</span>}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{phase.title || `Fase ${idx + 1}`}</p>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      {phaseIcon(phase.type)}
                      <span className="capitalize">{phase.type}</span>
                      {phase.type === 'quiz' && phase.quiz && <span> - {phase.quiz.length} pergunta(s)</span>}
                    </div>
                  </div>
                  <Play className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            );
          })}
        </div>

        {completed && selectedTrail.pointsReward > 0 && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="flex items-center gap-3 py-4">
              <Trophy className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-medium text-green-800">Trilha Concluida!</p>
                <p className="text-sm text-green-600">Voce ganhou {selectedTrail.pointsReward} pontos</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ---- Main trails list ----
  return (
    <div className="flex flex-col gap-6 p-6">
      <Header title="Trilhas de Aprendizado" subtitle="Continue aprendendo e ganhando pontos" />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Trilhas Disponiveis</CardDescription>
            <CardTitle className="text-2xl">{trails.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Concluidas</CardDescription>
            <CardTitle className="text-2xl">{trails.filter(t => isTrailCompleted(t)).length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Em Andamento</CardDescription>
            <CardTitle className="text-2xl">
              {trails.filter(t => progressMap[t.id] && !isTrailCompleted(t)).length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Trail cards */}
      {trails.length === 0 ? (
        <Card>
          <CardContent className="text-center py-10 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma trilha disponivel no momento.</p>
            <p className="text-sm">Aguarde novas trilhas serem criadas pela equipe.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {trails.map((trail) => {
            const progress = getProgress(trail.id, trail.phases.length);
            const completed = isTrailCompleted(trail);
            const started = !!progressMap[trail.id];

            return (
              <Card
                key={trail.id}
                className={`cursor-pointer transition-all hover:shadow-md ${completed ? 'border-green-200' : ''}`}
                onClick={() => setSelectedTrail(trail)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{trail.title}</CardTitle>
                    {completed ? (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Concluida
                      </Badge>
                    ) : started ? (
                      <Badge variant="outline">Em andamento</Badge>
                    ) : (
                      <Badge variant="secondary">Nova</Badge>
                    )}
                  </div>
                  <CardDescription>{trail.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{trail.phases.length} fases</span>
                    <span className="font-medium">{trail.pointsReward} pts</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progresso</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
