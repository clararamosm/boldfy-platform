'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { db, auth } from '@/lib/firebase';
import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc,
  query, orderBy, Timestamp, where, addDoc
} from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Play, BookOpen, HelpCircle, Wrench, Target,
  ArrowLeft, ArrowRight, Loader2, CheckCircle2,
  Trophy, X, Eye, Rocket, Clock, Star, AlertCircle,
  ChevronLeft, ChevronRight, Menu, Lock, SkipForward
} from 'lucide-react';
import type {
  Trilha, Modulo, ModuloModo, ProgressoTrilha, QuestaoDesafio
} from '@/types/trilhas';

const MODO_ICONS: Record<ModuloModo, any> = {
  aula: Play,
  leitura: BookOpen,
  desafio: HelpCircle,
  faca_voce_mesmo: Wrench,
  missao_conteudo: Target,
};

const MODO_LABELS: Record<ModuloModo, string> = {
  aula: 'Aula',
  leitura: 'Leitura',
  desafio: 'Desafio',
  faca_voce_mesmo: 'Pratica',
  missao_conteudo: 'Missao',
};

const DESAFIO_FAIXA_MIN = 0.6;
const DESAFIO_FAIXA_BONUS = 0.8;

export default function TrilhaFullscreenPage() {
  const { id } = useParams();
  const router = useRouter();
  const [user] = useAuthState(auth);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [trail, setTrail] = useState<Trilha | null>(null);
  const [progress, setProgress] = useState<ProgressoTrilha | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeModuleIndex, setActiveModuleIndex] = useState<number | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [showConclusion, setShowConclusion] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Desafio state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set());
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<{correct: number; total: number; percent: number; points: number} | null>(null);
  const [alreadyAttempted, setAlreadyAttempted] = useState(false);

  // Video state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoCompleted, setVideoCompleted] = useState(false);

  // Load user company
  useEffect(() => {
    if (!user) return;
    const loadUser = async () => {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) setCompanyId(snap.data().companyId);
    };
    loadUser();
  }, [user]);

  // Load trail and progress
  useEffect(() => {
    if (!user || !companyId || !id) return;
    const load = async () => {
      setLoading(true);
      try {
        let trailData: Trilha | null = null;

        // Try global trail first
        const globalSnap = await getDoc(doc(db, 'globalSessions_trails', id as string));
        if (globalSnap.exists()) {
          trailData = { id: globalSnap.id, ...globalSnap.data() } as Trilha;
        }

        // Try company custom trail
        if (!trailData) {
          const customSnap = await getDoc(doc(db, 'companies', companyId, 'trails', id as string));
          if (customSnap.exists()) {
            trailData = { id: customSnap.id, ...customSnap.data() } as Trilha;
          }
        }

        if (!trailData) {
          setLoading(false);
          return;
        }

        // Sort modules by ordem
        if (trailData.modulos) {
          trailData.modulos.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
        }
        setTrail(trailData);

        // Load progress
        const progSnap = await getDoc(
          doc(db, 'companies', companyId, 'collaborators', user.uid, 'trailProgress', id as string)
        );
        if (progSnap.exists()) {
          const p = progSnap.data() as ProgressoTrilha;
          setProgress(p);
          if (p.concluida) {
            setShowConclusion(true);
            setShowIntro(false);
          }
        } else {
          // Create initial progress
          const initial: ProgressoTrilha = {
            modulosCompletos: [],
            pontuacaoFixadaPorModulo: {},
            primeirasTentativasDesafio: {},
            concluida: false,
            percentual: 0,
            pontosGanhos: 0,
            iniciadaEm: Timestamp.now(),
          };
          await setDoc(
            doc(db, 'companies', companyId, 'collaborators', user.uid, 'trailProgress', id as string),
            initial
          );
          setProgress(initial);
        }
      } catch (err) {
        console.error('Error loading trail:', err);
      }
      setLoading(false);
    };
    load();
  }, [user, companyId, id]);

  // Computed values
  const sortedModules = useMemo(() => trail?.modulos || [], [trail]);
  const completedCount = useMemo(() => progress?.modulosCompletos?.length || 0, [progress]);
  const totalModules = sortedModules.length;
  const progressPercent = totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;
  const currentModule = activeModuleIndex !== null ? sortedModules[activeModuleIndex] : null;

  const isModuleCompleted = useCallback((moduleId: string) => {
    return progress?.modulosCompletos?.includes(moduleId) || false;
  }, [progress]);

  const canAccessModule = useCallback((index: number) => {
    if (index === 0) return true;
    const prevModule = sortedModules[index - 1];
    if (!prevModule) return true;
    if (!prevModule.obrigatorio) return true;
    return isModuleCompleted(prevModule.id);
  }, [sortedModules, isModuleCompleted]);

  // Save progress to Firestore
  const saveProgress = useCallback(async (updatedProgress: ProgressoTrilha) => {
    if (!user || !companyId || !id) return;
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'companies', companyId, 'collaborators', user.uid, 'trailProgress', id as string),
        updatedProgress,
        { merge: true }
      );
      setProgress(updatedProgress);
    } catch (err) {
      console.error('Error saving progress:', err);
    }
    setSaving(false);
  }, [user, companyId, id]);

  // Complete a module
  const completeModule = useCallback(async (moduleId: string, points: number) => {
    if (!progress || !trail) return;
    const alreadyDone = progress.modulosCompletos?.includes(moduleId);
    if (alreadyDone) return;

    const newCompleted = [...(progress.modulosCompletos || []), moduleId];
    const newPointsMap = { ...progress.pontuacaoFixadaPorModulo, [moduleId]: points };
    const totalPoints = Object.values(newPointsMap).reduce((a, b) => a + b, 0);
    const newPercent = Math.round((newCompleted.length / sortedModules.length) * 100);

    // Check if all mandatory modules are done
    const mandatoryModules = sortedModules.filter(m => m.obrigatorio);
    const allMandatoryDone = mandatoryModules.every(m => newCompleted.includes(m.id));

    const updatedProgress: ProgressoTrilha = {
      ...progress,
      modulosCompletos: newCompleted,
      pontuacaoFixadaPorModulo: newPointsMap,
      pontosGanhos: totalPoints,
      percentual: newPercent,
    };

    if (allMandatoryDone && !progress.concluida) {
      updatedProgress.concluida = true;
      updatedProgress.concluidaEm = Timestamp.now();
      updatedProgress.pontosGanhos = totalPoints + (trail.pontuacaoBonus || 0);

      // Create trigger mission if exists
      if (trail.missaoGatilho) {
        try {
          await addDoc(collection(db, 'companies', companyId!, 'missions'), {
            name: trail.missaoGatilho.titulo,
            description: trail.missaoGatilho.descricao,
            points: trail.missaoGatilho.pontos || 0,
            type: 'trail_trigger',
            status: 'active',
            tag: 'Missao de Trilha',
            trailId: id,
            assignedTo: user!.uid,
            requiresProof: trail.missaoGatilho.requerComprovante || false,
            deadlineDays: trail.missaoGatilho.prazoDias || 7,
            createdAt: Timestamp.now(),
          });
        } catch (err) {
          console.error('Error creating trigger mission:', err);
        }
      }
    }

    await saveProgress(updatedProgress);

    // Auto-advance or show conclusion
    if (allMandatoryDone && updatedProgress.concluida) {
      setShowConclusion(true);
    }
  }, [progress, trail, sortedModules, companyId, id, user, saveProgress]);

  // Desafio logic
  const handleAnswerSelect = (questionIndex: number, optionIndex: number) => {
    if (answeredQuestions.has(questionIndex)) return;
    setSelectedAnswers(prev => ({ ...prev, [questionIndex]: optionIndex }));
  };

  const handleConfirmAnswer = () => {
    if (!currentModule || currentModule.tipo !== 'desafio') return;
    const questions = currentModule.conteudo?.questoes || [];
    const q = questions[currentQuestionIndex];
    if (!q) return;
    setAnsweredQuestions(prev => new Set(prev).add(currentQuestionIndex));
  };

  const handleNextQuestion = () => {
    if (!currentModule) return;
    const questions = currentModule.conteudo?.questoes || [];
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handleSubmitDesafio = async () => {
    if (!currentModule || !progress) return;
    const questions = currentModule.conteudo?.questoes || [];
    const total = questions.length;
    let correct = 0;
    questions.forEach((q: QuestaoDesafio, i: number) => {
      if (selectedAnswers[i] === q.respostaCorreta) correct++;
    });
    const percent = total > 0 ? correct / total : 0;

    let points = 0;
    const basePoints = currentModule.conteudo?.pontuacaoBase || 0;
    const bonusPoints = currentModule.conteudo?.pontuacaoBonus || 0;
    if (percent >= DESAFIO_FAIXA_BONUS) {
      points = basePoints + bonusPoints;
    } else if (percent >= DESAFIO_FAIXA_MIN) {
      points = basePoints;
    }

    setQuizScore({ correct, total, percent: Math.round(percent * 100), points });
    setQuizSubmitted(true);

    // Save first attempt
    const newAttempts = {
      ...progress.primeirasTentativasDesafio,
      [currentModule.id]: { percentual: Math.round(percent * 100), pontos: points }
    };
    const updatedProgress = { ...progress, primeirasTentativasDesafio: newAttempts };
    setProgress(updatedProgress);

    await completeModule(currentModule.id, points);
  };

  // Unlock mission (missao_conteudo)
  const handleUnlockMission = async () => {
    if (!currentModule || !user || !companyId) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'companies', companyId, 'missions'), {
        name: currentModule.titulo || 'Missao de Trilha',
        description: currentModule.conteudo?.instrucao || '',
        points: 0,
        type: 'trail_content',
        status: 'active',
        tag: 'Missao de Trilha',
        trailId: id,
        moduleId: currentModule.id,
        assignedTo: user.uid,
        createdAt: Timestamp.now(),
      });
      await completeModule(currentModule.id, 0);
    } catch (err) {
      console.error('Error creating mission:', err);
    }
    setSaving(false);
  };

  // Navigation
  const startTrail = () => {
    setShowIntro(false);
    if (progress && progress.modulosCompletos?.length > 0) {
      const lastCompleted = progress.modulosCompletos[progress.modulosCompletos.length - 1];
      const lastIndex = sortedModules.findIndex(m => m.id === lastCompleted);
      const nextIndex = lastIndex + 1 < sortedModules.length ? lastIndex + 1 : lastIndex;
      setActiveModuleIndex(nextIndex);
    } else {
      setActiveModuleIndex(0);
    }
    resetModuleState();
  };

  const goToModule = (index: number) => {
    if (!canAccessModule(index)) return;
    setActiveModuleIndex(index);
    resetModuleState();
    setSidebarOpen(false);
  };

  const goNext = () => {
    if (activeModuleIndex === null) return;
    const next = activeModuleIndex + 1;
    if (next < sortedModules.length && canAccessModule(next)) {
      setActiveModuleIndex(next);
      resetModuleState();
    }
  };

  const goPrev = () => {
    if (activeModuleIndex === null || activeModuleIndex === 0) return;
    setActiveModuleIndex(activeModuleIndex - 1);
    resetModuleState();
  };

  const resetModuleState = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setAnsweredQuestions(new Set());
    setQuizSubmitted(false);
    setQuizScore(null);
    setAlreadyAttempted(false);
    setVideoProgress(0);
    setVideoCompleted(false);
  };

  // Check if desafio already attempted
  useEffect(() => {
    if (!currentModule || !progress) return;
    if (currentModule.tipo === 'desafio' && progress.primeirasTentativasDesafio?.[currentModule.id]) {
      setAlreadyAttempted(true);
      const attempt = progress.primeirasTentativasDesafio[currentModule.id];
      setQuizScore({ correct: 0, total: 0, percent: attempt.percentual, points: attempt.pontos });
    }
  }, [currentModule, progress]);

  // Video progress tracking
  const handleVideoTimeUpdate = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const percent = video.duration > 0 ? (video.currentTime / video.duration) * 100 : 0;
    setVideoProgress(percent);
    if (percent >= 80) setVideoCompleted(true);
  };

  // RENDER
  if (loading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Carregando trilha...</p>
        </div>
      </div>
    );
  }

  if (!trail) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <p className="text-lg font-semibold">Trilha nao encontrada</p>
          <Button onClick={() => router.push('/influencer/trilhas')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Trilhas
          </Button>
        </div>
      </div>
    );
  }

  // INTRO SCREEN
  if (showIntro && !showConclusion) {
    const hasStarted = (progress?.modulosCompletos?.length || 0) > 0;
    return (
      <div className="fixed inset-0 bg-background z-50 overflow-auto">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <Button variant="ghost" onClick={() => router.push('/influencer/trilhas')} className="mb-8">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Trilhas
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
                    <Star className="h-5 w-5" />
                    {trail.pontuacaoTotal || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Pontos disponiveis</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-1 text-2xl font-bold">
                    <BookOpen className="h-5 w-5" />
                    {sortedModules.length}
                  </div>
                  <p className="text-xs text-muted-foreground">Modulos</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-1 text-2xl font-bold">
                    <Clock className="h-5 w-5" />
                    {trail.tempoEstimadoMin || '?'}
                  </div>
                  <p className="text-xs text-muted-foreground">Minutos</p>
                </div>
              </div>

              {hasStarted && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progresso</span>
                    <span>{completedCount}/{totalModules} modulos</span>
                  </div>
                  <Progress value={progressPercent} className="h-2" />
                </div>
              )}

              {trail.pontuacaoBonus > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                  <p className="text-sm text-amber-800">
                    <Trophy className="inline h-4 w-4 mr-1" />
                    Bonus de conclusao: <strong>+{trail.pontuacaoBonus} pontos</strong>
                  </p>
                </div>
              )}

              <Button className="w-full" size="lg" onClick={startTrail}>
                {hasStarted ? (
                  <><ArrowRight className="mr-2 h-5 w-5" /> Continuar de onde parei</>
                ) : (
                  <><Rocket className="mr-2 h-5 w-5" /> Comecar trilha</>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // CONCLUSION SCREEN
  if (showConclusion && trail) {
    const modulePoints = progress?.pontosGanhos ? progress.pontosGanhos - (trail.pontuacaoBonus || 0) : 0;
    return (
      <div className="fixed inset-0 bg-background z-50 overflow-auto">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <Card className="border-green-200 bg-green-50/50">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <Trophy className="h-10 w-10 text-green-600" />
              </div>
              <CardTitle className="text-2xl text-green-800">Trilha Concluida!</CardTitle>
              <CardDescription className="text-green-700 text-base">
                Parabens! Voce completou a trilha "{trail.titulo}"
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-white rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Pontos dos modulos</span>
                  <span className="font-semibold">{modulePoints > 0 ? modulePoints : 0}</span>
                </div>
                {trail.pontuacaoBonus > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Bonus de conclusao</span>
                    <span className="font-semibold text-amber-600">+{trail.pontuacaoBonus}</span>
                  </div>
                )}
                <hr />
                <div className="flex justify-between items-center text-lg">
                  <span className="font-bold">Total</span>
                  <span className="font-bold text-primary">{progress?.pontosGanhos || 0} pontos</span>
                </div>
              </div>

              {trail.missaoGatilho && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                  <Rocket className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-blue-800">Uma nova missao foi criada para voce!</p>
                  <Button
                    variant="outline"
                    className="mt-2 border-blue-300 text-blue-700"
                    onClick={() => router.push('/influencer/missoes')}
                  >
                    Ver Missoes
                  </Button>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.push('/influencer/trilhas')}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Trilhas
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // FULLSCREEN MODULE VIEW
  if (!currentModule) return null;
  const ModoIcon = MODO_ICONS[currentModule.tipo] || BookOpen;
  const moduleCompleted = isModuleCompleted(currentModule.id);

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Top bar */}
      <div className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <Menu className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => router.push('/influencer/trilhas')}>
            <X className="h-5 w-5" />
          </Button>
          <span className="text-sm font-medium hidden sm:inline">{trail.titulo}</span>
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
                ? (currentModule.conteudo?.pontuacaoBase || 0) + ' pts'
                : (currentModule.pontuacao || 0) + ' pts'}
            </Badge>
          )}
          {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {sidebarOpen && (
          <div className="w-72 border-r bg-card overflow-y-auto shrink-0">
            <div className="p-4 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Modulos</p>
              {sortedModules.map((mod, idx) => {
                const Icon = MODO_ICONS[mod.tipo] || BookOpen;
                const completed = isModuleCompleted(mod.id);
                const active = idx === activeModuleIndex;
                const locked = !canAccessModule(idx);
                return (
                  <button
                    key={mod.id}
                    onClick={() => goToModule(idx)}
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
                          <span className="text-xs text-muted-foreground">Opcional</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Main content area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-6 pb-32">

            {/* MODULE: AULA (video) */}
            {currentModule.tipo === 'aula' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">{currentModule.titulo}</h2>
                  {moduleCompleted && (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Concluido
                    </Badge>
                  )}
                </div>

                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                  {currentModule.conteudo?.videoUrl ? (
                    currentModule.conteudo.videoUrl.includes('youtube') || currentModule.conteudo.videoUrl.includes('youtu.be') || currentModule.conteudo.videoUrl.includes('vimeo') ? (
                      <iframe
                        src={currentModule.conteudo.videoUrl}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <video
                        ref={videoRef}
                        src={currentModule.conteudo.videoUrl}
                        controls
                        className="w-full h-full"
                        onTimeUpdate={handleVideoTimeUpdate}
                      />
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/50">
                      <Play className="h-16 w-16" />
                    </div>
                  )}
                </div>

                {!moduleCompleted && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Progresso do video</span>
                      <span>{Math.round(videoProgress)}%</span>
                    </div>
                    <Progress value={videoProgress} className="h-2" />
                    <p className="text-xs text-muted-foreground">Assista pelo menos 80% do video para liberar a conclusao</p>
                  </div>
                )}
              </div>
            )}

            {/* MODULE: LEITURA */}
            {currentModule.tipo === 'leitura' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">{currentModule.titulo}</h2>
                  {moduleCompleted && (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Concluido
                    </Badge>
                  )}
                </div>
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: currentModule.conteudo?.texto || '<p>Conteudo nao disponivel.</p>' }}
                />
              </div>
            )}

            {/* MODULE: DESAFIO */}
            {currentModule.tipo === 'desafio' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">{currentModule.titulo}</h2>
                  {moduleCompleted && (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Concluido
                    </Badge>
                  )}
                </div>

                {alreadyAttempted && !quizSubmitted ? (
                  <Card className="border-amber-200 bg-amber-50">
                    <CardContent className="p-6 text-center space-y-3">
                      <AlertCircle className="h-8 w-8 text-amber-600 mx-auto" />
                      <p className="font-semibold text-amber-800">Pontuacao ja fixada</p>
                      <p className="text-sm text-amber-700">
                        Voce ja fez este desafio. Sua pontuacao foi fixada na primeira tentativa:
                        {quizScore && <strong> {quizScore.percent}% = {quizScore.points} pontos</strong>}
                      </p>
                      <p className="text-xs text-amber-600">Voce pode refazer para estudar, mas a pontuacao nao sera alterada.</p>
                    </CardContent>
                  </Card>
                ) : quizSubmitted && quizScore ? (
                  <Card className="border-green-200 bg-green-50">
                    <CardContent className="p-6 text-center space-y-4">
                      <Trophy className="h-10 w-10 text-green-600 mx-auto" />
                      <p className="text-xl font-bold text-green-800">Resultado do Desafio</p>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-2xl font-bold">{quizScore.correct}/{quizScore.total}</p>
                          <p className="text-xs text-muted-foreground">Acertos</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{quizScore.percent}%</p>
                          <p className="text-xs text-muted-foreground">Percentual</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-primary">{quizScore.points}</p>
                          <p className="text-xs text-muted-foreground">Pontos</p>
                        </div>
                      </div>
                      {quizScore.percent < 60 && (
                        <p className="text-sm text-red-600">Abaixo de 60% = 0 pontos. Pontuacao fixada na primeira tentativa.</p>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {/* Question by question */}
                    {(() => {
                      const questions = currentModule.conteudo?.questoes || [];
                      const q = questions[currentQuestionIndex];
                      if (!q) return <p>Nenhuma questao encontrada.</p>;
                      const isAnswered = answeredQuestions.has(currentQuestionIndex);
                      const selectedIdx = selectedAnswers[currentQuestionIndex];
                      const isCorrect = selectedIdx === q.respostaCorreta;

                      return (
                        <div className="space-y-4">
                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>Questao {currentQuestionIndex + 1} de {questions.length}</span>
                            <Progress value={((currentQuestionIndex + 1) / questions.length) * 100} className="w-24 h-2" />
                          </div>

                          <Card>
                            <CardContent className="p-6">
                              <p className="text-lg font-semibold mb-4">{q.enunciado}</p>
                              <div className="space-y-2">
                                {q.opcoes?.map((opt: string, oi: number) => {
                                  let style = 'border-border hover:bg-muted cursor-pointer';
                                  if (isAnswered) {
                                    if (oi === q.respostaCorreta) style = 'border-green-500 bg-green-50';
                                    else if (oi === selectedIdx && oi !== q.respostaCorreta) style = 'border-red-500 bg-red-50';
                                    else style = 'border-border opacity-50';
                                  } else if (selectedIdx === oi) {
                                    style = 'border-primary bg-primary/5';
                                  }
                                  return (
                                    <button
                                      key={oi}
                                      onClick={() => handleAnswerSelect(currentQuestionIndex, oi)}
                                      disabled={isAnswered}
                                      className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${style}`}
                                    >
                                      <span className="text-sm">{opt}</span>
                                    </button>
                                  );
                                })}
                              </div>

                              {isAnswered && (
                                <div className={`mt-4 p-3 rounded-lg ${isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                  <p className={`text-sm font-semibold ${isCorrect ? 'text-green-800' : 'text-red-800'}`}>
                                    {isCorrect ? 'Correto!' : 'Incorreto'}
                                  </p>
                                  {q.explicacao && (
                                    <p className="text-sm text-muted-foreground mt-1">{q.explicacao}</p>
                                  )}
                                </div>
                              )}
                            </CardContent>
                          </Card>

                          <div className="flex justify-between">
                            {!isAnswered ? (
                              <Button
                                onClick={handleConfirmAnswer}
                                disabled={selectedIdx === undefined}
                              >
                                Confirmar resposta
                              </Button>
                            ) : currentQuestionIndex < questions.length - 1 ? (
                              <Button onClick={handleNextQuestion}>
                                Proxima questao <ChevronRight className="ml-2 h-4 w-4" />
                              </Button>
                            ) : (
                              <Button onClick={handleSubmitDesafio}>
                                <Trophy className="mr-2 h-4 w-4" /> Ver resultado
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            )}

            {/* MODULE: FACA VOCE MESMO */}
            {currentModule.tipo === 'faca_voce_mesmo' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">{currentModule.titulo}</h2>
                  {moduleCompleted && (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Concluido
                    </Badge>
                  )}
                </div>
                <Card className="border-amber-200">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-3">
                      <Wrench className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-amber-800 mb-2">Pratica</p>
                        <p className="text-sm whitespace-pre-wrap">{currentModule.conteudo?.instrucao || 'Siga as instrucoes.'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <p className="text-xs text-muted-foreground text-center">
                  Modulo sem pontuacao. Necessario visualizar para concluir a trilha.
                </p>
              </div>
            )}

            {/* MODULE: MISSAO CONTEUDO */}
            {currentModule.tipo === 'missao_conteudo' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">{currentModule.titulo}</h2>
                  {moduleCompleted && (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Missao desbloqueada
                    </Badge>
                  )}
                </div>
                <Card className="border-blue-200">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-start gap-3">
                      <Target className="h-6 w-6 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-blue-800 mb-2">Missao de Conteudo</p>
                        <p className="text-sm whitespace-pre-wrap">{currentModule.conteudo?.instrucao || ''}</p>
                      </div>
                    </div>
                    {currentModule.conteudo?.exemplos && (
                      <div className="bg-blue-50 rounded-lg p-4">
                        <p className="text-xs font-semibold text-blue-700 uppercase mb-2">Exemplos</p>
                        <p className="text-sm whitespace-pre-wrap">{currentModule.conteudo.exemplos}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
                <p className="text-xs text-muted-foreground text-center">
                  Modulo sem pontuacao. Desbloquear a missao e necessario para concluir a trilha.
                </p>
              </div>
            )}

          </div>

          {/* Bottom action bar */}
          <div className="fixed bottom-0 left-0 right-0 bg-card border-t p-4 z-10">
            <div className="max-w-3xl mx-auto flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={goPrev} disabled={activeModuleIndex === 0}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
              </Button>

              <div className="flex items-center gap-2">
                {!moduleCompleted && !quizSubmitted && (
                  <>
                    {/* Action button per mode */}
                    {currentModule.tipo === 'aula' && (
                      <Button
                        onClick={() => completeModule(currentModule.id, currentModule.pontuacao || 0)}
                        disabled={!videoCompleted && !(currentModule.conteudo?.videoUrl?.includes('youtube') || currentModule.conteudo?.videoUrl?.includes('vimeo'))}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Modulo concluido
                      </Button>
                    )}
                    {currentModule.tipo === 'leitura' && (
                      <Button onClick={() => completeModule(currentModule.id, currentModule.pontuacao || 0)}>
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Conclui a leitura
                      </Button>
                    )}
                    {currentModule.tipo === 'faca_voce_mesmo' && (
                      <Button onClick={() => completeModule(currentModule.id, 0)}>
                        <Eye className="mr-2 h-4 w-4" /> Visualizei
                      </Button>
                    )}
                    {currentModule.tipo === 'missao_conteudo' && (
                      <Button onClick={handleUnlockMission} disabled={saving}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
                        Desbloquear Missao
                      </Button>
                    )}
                    {/* Skip button for optional modules */}
                    {!currentModule.obrigatorio && currentModule.tipo !== 'desafio' && (
                      <Button variant="ghost" size="sm" onClick={goNext}>
                        <SkipForward className="mr-1 h-4 w-4" /> Pular
                      </Button>
                    )}
                  </>
                )}

                {moduleCompleted && (
                  <Badge variant="outline" className="text-green-700 border-green-300">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Concluido
                  </Badge>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={goNext}
                disabled={activeModuleIndex === null || activeModuleIndex >= sortedModules.length - 1}
              >
                Proximo <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
