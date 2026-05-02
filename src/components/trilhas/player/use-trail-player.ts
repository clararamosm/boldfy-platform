// src/components/trilhas/player/use-trail-player.ts
// Custom hook containing all state management and business logic for the trail player.
// Extracted from the original 1084-line god component.

'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { db, auth } from '@/lib/firebase';
import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc,
  Timestamp, addDoc, arrayUnion,
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { recalculatePoints } from '@/app/actions';
import { checkConquestsFromClient } from '@/app/actions/gamification';
import { getAuthToken } from '@/lib/auth-client';
import { useT } from '@/lib/i18n/context';
import { interpolate } from '@/lib/i18n';
import type {
  Trilha, Modulo, ModuloModo, ProgressoTrilha, QuestaoDesafio, MissaoGatilho
} from '@/types/trilhas';

const DESAFIO_FAIXA_MIN = 0.6;
const DESAFIO_FAIXA_BONUS = 0.8;

export type MappedModule = {
  id: string;
  titulo: string;
  tipo: ModuloModo;
  modo?: string;
  obrigatorio?: boolean;
  pontuacaoBase?: number;
  pontuacaoBonus?: number;
  missaoGatilho?: MissaoGatilho;
  conteudo: {
    texto?: string;
    videoUrl?: string;
    materialPdfUrl?: string;
    pontuacaoBase?: number;
    pontuacaoBonus?: number;
    questoes?: QuestaoDesafio[];
    instrucao?: string;
    exemplos?: string | string[];
  };
};

export type QuizScore = {
  correct: number;
  total: number;
  percent: number;
  points: number;
};

export function useTrailPlayer(trailId: string) {
  const t = useT();
  const tp = t.trailPlayer;

  // Auth & data
  const [user, setUser] = useState<User | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [trail, setTrail] = useState<Trilha | null>(null);
  const [progress, setProgress] = useState<ProgressoTrilha | null>(null);
  const [loading, setLoading] = useState(true);

  // Navigation
  const [activeModuleIndex, setActiveModuleIndex] = useState<number | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [showConclusion, setShowConclusion] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);

  // Quiz state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set());
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<QuizScore | null>(null);
  const [alreadyAttempted, setAlreadyAttempted] = useState(false);

  // Video state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoCompleted, setVideoCompleted] = useState(false);

  // ─── Auth ───────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const loadUser = async () => {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) setCompanyId(snap.data().companyId);
    };
    loadUser();
  }, [user]);

  // ─── Load trail + progress ──────────────────────────────
  useEffect(() => {
    if (!user || !companyId || !trailId) return;
    const load = async () => {
      setLoading(true);
      try {
        let trailData: Trilha | null = null;

        // 1. Try activated global trail
        const actDoc = await getDoc(doc(db, `companies/${companyId}/activatedGlobalTrails`, trailId));
        if (actDoc.exists()) {
          const sessionId = actDoc.data().sessionId;
          if (sessionId) {
            const globalSnap = await getDoc(doc(db, `globalSessions/${sessionId}/trails`, trailId));
            if (globalSnap.exists()) {
              trailData = { id: globalSnap.id, ...globalSnap.data() } as Trilha;
            }
          }
        }

        // 2. Try company custom trail (search through sessions)
        if (!trailData) {
          const sessSnap = await getDocs(collection(db, `companies/${companyId}/sessions`));
          for (const sessDoc of sessSnap.docs) {
            const tDoc = await getDoc(doc(db, `companies/${companyId}/sessions/${sessDoc.id}/trails`, trailId));
            if (tDoc.exists()) {
              trailData = { id: tDoc.id, ...tDoc.data() } as Trilha;
              break;
            }
          }
        }

        // 3. Flat company trail
        if (!trailData) {
          const customSnap = await getDoc(doc(db, 'companies', companyId, 'trails', trailId));
          if (customSnap.exists()) {
            trailData = { id: customSnap.id, ...customSnap.data() } as Trilha;
          }
        }

        if (!trailData) { setLoading(false); return; }

        if (trailData.modulos) {
          trailData.modulos.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
        }
        setTrail(trailData);

        // Load progress
        const progSnap = await getDoc(doc(db, 'users', user.uid, 'trailProgress', trailId));
        if (progSnap.exists()) {
          const p = progSnap.data() as ProgressoTrilha;
          setProgress(p);
          if (p.concluida) { setShowConclusion(true); setShowIntro(false); }
        } else {
          const initial: ProgressoTrilha = {
            modulosCompletos: [],
            pontuacaoFixadaPorModulo: {},
            primeirasTentativasDesafio: {},
            concluida: false,
            percentual: 0,
            pontosGanhos: 0,
            iniciadaEm: Timestamp.now(),
          };
          await setDoc(doc(db, 'users', user.uid, 'trailProgress', trailId), initial);
          setProgress(initial);
        }
      } catch (err) {
        console.error('Error loading trail:', err);
      }
      setLoading(false);
    };
    load();
  }, [user, companyId, trailId]);

  // ─── Computed ──────────────────────────────────────────
  const sortedModules: MappedModule[] = useMemo(() => {
    return (trail?.modulos || []).map((m: Modulo) => ({
      ...m,
      id: m.id as string,
      tipo: (m.modo || 'leitura') as ModuloModo,
      conteudo: {
        texto: m.conteudoHtml,
        videoUrl: m.videoUrl,
        materialPdfUrl: m.materialPdfUrl,
        pontuacaoBase: m.pontuacaoBase,
        pontuacaoBonus: m.pontuacaoBonus,
        questoes: m.questoes,
        instrucao: m.instrucaoCard || m.missaoGatilho?.instrucoes,
        exemplos: m.missaoGatilho?.exemplos,
      },
    }));
  }, [trail]);

  const completedCount = useMemo(() => progress?.modulosCompletos?.length || 0, [progress]);
  const totalModules = sortedModules.length;
  const progressPercent = totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;
  const currentModule = activeModuleIndex !== null ? sortedModules[activeModuleIndex] : null;

  const isModuleCompleted = useCallback((moduleId: string) => {
    return progress?.modulosCompletos?.includes(moduleId) || false;
  }, [progress]);

  const canAccessModule = useCallback((index: number) => {
    if (reviewMode) return true;
    if (index === 0) return true;
    const prevModule = sortedModules[index - 1];
    if (!prevModule) return true;
    return isModuleCompleted(prevModule.id);
  }, [sortedModules, isModuleCompleted, reviewMode]);

  // ─── Progress persistence ─────────────────────────────
  const saveProgress = useCallback(async (updatedProgress: ProgressoTrilha) => {
    if (!user || !companyId || !trailId) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'users', user.uid, 'trailProgress', trailId), updatedProgress, { merge: true });
      setProgress(updatedProgress);
    } catch (err) {
      console.error('Error saving progress:', err);
    }
    setSaving(false);
  }, [user, companyId, trailId]);

  // ─── Complete module ──────────────────────────────────
  const completeModule = useCallback(async (moduleId: string, points: number) => {
    if (!progress || !trail) return;
    if (progress.modulosCompletos?.includes(moduleId)) return;

    const newCompleted = [...(progress.modulosCompletos || []), moduleId];
    const newPointsMap = { ...progress.pontuacaoFixadaPorModulo, [moduleId]: points };
    const totalPoints = Object.values(newPointsMap).reduce((a, b) => a + b, 0);
    const newPercent = Math.round((newCompleted.length / sortedModules.length) * 100);
    const allModulesDone = sortedModules.length > 0 && sortedModules.every(m => newCompleted.includes(m.id));

    const updatedProgress: ProgressoTrilha = {
      ...progress,
      modulosCompletos: newCompleted,
      pontuacaoFixadaPorModulo: newPointsMap,
      pontosGanhos: totalPoints,
      percentual: newPercent,
    };

    if (allModulesDone && !progress.concluida) {
      updatedProgress.concluida = true;
      updatedProgress.concluidaEm = Timestamp.now();
      updatedProgress.pontosGanhos = totalPoints + (trail.pontuacaoBonus || 0);

      // Register in pointsHistory + toast notification
      try {
        const trailDesc = interpolate(tp.trailCompletedHistory, { title: trail.titulo });
        await addDoc(collection(db, 'users', user!.uid, 'pointsHistory'), {
          description: trailDesc,
          date: Timestamp.now(),
          points: updatedProgress.pontosGanhos,
          type: 'gain',
          source: 'trilha',
        });
        // Write pending notification for toast
        await updateDoc(doc(db, 'users', user!.uid), {
          pendingNotifications: arrayUnion({
            type: 'points',
            source: 'trilha',
            points: updatedProgress.pontosGanhos,
            description: trailDesc,
            createdAt: Date.now(),
            onboardingItemId: 'start-trail',
          }),
        });
      } catch (err) { console.error('Error adding trail to pointsHistory:', err); }

      // Create trigger mission if exists
      if (trail.missaoGatilho) {
        try {
          const triggerNow = Timestamp.now();
          const triggerDeadlineDays = trail.missaoGatilho.prazoDias || 14;
          const triggerEndDate = new Date();
          triggerEndDate.setDate(triggerEndDate.getDate() + triggerDeadlineDays);

          await addDoc(collection(db, 'companies', companyId!, 'missions'), {
            name: trail.missaoGatilho.titulo,
            description: trail.missaoGatilho.descricao,
            points: trail.missaoGatilho.pontos || 0,
            type: 'trail_trigger',
            status: 'active',
            tag: 'Missao de Trilha',
            trailId,
            assignedTo: user!.uid,
            requiresProof: trail.missaoGatilho.requerComprovante || false,
            completionMode: trail.missaoGatilho.requerComprovante ? 'proof' : 'auto',
            deadlineDays: triggerDeadlineDays,
            startDate: triggerNow,
            endDate: Timestamp.fromDate(triggerEndDate),
            createdAt: triggerNow,
          });
        } catch (err) { console.error('Error creating trigger mission:', err); }
      }
    }

    await saveProgress(updatedProgress);

    // Recalculate points server-side
    if (user) {
      getAuthToken().then(token => recalculatePoints(token, user.uid)).catch(err => console.error('Error recalculating points:', err));
    }

    // Check trail conquests after completion (fire-and-forget)
    if (allModulesDone && user) {
      getAuthToken()
        .then(token => checkConquestsFromClient(token, user.uid, 'trail'))
        .catch(err => console.error('[Gamification] Trail conquest check failed:', err));
    }

    if (allModulesDone && updatedProgress.concluida) {
      setShowConclusion(true);
    }
  }, [progress, trail, sortedModules, companyId, trailId, user, saveProgress, tp]);

  // ─── Quiz handlers ────────────────────────────────────
  const handleAnswerSelect = (questionIndex: number, optionIndex: number) => {
    if (answeredQuestions.has(questionIndex)) return;
    setSelectedAnswers(prev => ({ ...prev, [questionIndex]: optionIndex }));
  };

  const handleConfirmAnswer = () => {
    if (!currentModule || currentModule.tipo !== 'desafio') return;
    const questions = currentModule.conteudo?.questoes || [];
    if (!questions[currentQuestionIndex]) return;
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
    if (percent >= DESAFIO_FAIXA_BONUS) points = basePoints + bonusPoints;
    else if (percent >= DESAFIO_FAIXA_MIN) points = basePoints;

    setQuizScore({ correct, total, percent: Math.round(percent * 100), points });
    setQuizSubmitted(true);

    const newAttempts = {
      ...progress.primeirasTentativasDesafio,
      [currentModule.id]: { percentual: Math.round(percent * 100), pontos: points }
    };
    setProgress({ ...progress, primeirasTentativasDesafio: newAttempts });
    await completeModule(currentModule.id, points);
  };

  // ─── Unlock mission (missao_conteudo) ─────────────────
  const handleUnlockMission = async () => {
    if (!currentModule || !user || !companyId) return;
    setSaving(true);
    try {
      const now = Timestamp.now();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 14);

      const missionPoints = currentModule.missaoGatilho?.pontosRecompensa
        || currentModule.conteudo?.pontuacaoBase || 0;

      await addDoc(collection(db, 'companies', companyId, 'missions'), {
        name: currentModule.titulo || 'Missao de Trilha',
        description: currentModule.conteudo?.instrucao || '',
        points: missionPoints,
        type: 'trail_content',
        status: 'active',
        tag: 'Missao de Trilha',
        trailId,
        moduleId: currentModule.id,
        assignedTo: user.uid,
        completionMode: 'proof',
        startDate: now,
        endDate: Timestamp.fromDate(endDate),
        deadlineDays: 14,
        createdAt: now,
      });
      await completeModule(currentModule.id, 0);
    } catch (err) { console.error('Error creating mission:', err); }
    setSaving(false);
  };

  // ─── Navigation ───────────────────────────────────────
  const resetModuleState = useCallback(() => {
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setAnsweredQuestions(new Set());
    setQuizSubmitted(false);
    setQuizScore(null);
    setAlreadyAttempted(false);
    setVideoProgress(0);
    setVideoCompleted(false);
  }, []);

  const startTrail = useCallback(() => {
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
  }, [progress, sortedModules, resetModuleState]);

  const goToModule = useCallback((index: number) => {
    if (!canAccessModule(index)) return;
    setActiveModuleIndex(index);
    resetModuleState();
    setSidebarOpen(false);
  }, [canAccessModule, resetModuleState]);

  const goNext = useCallback(() => {
    if (activeModuleIndex === null) return;
    const next = activeModuleIndex + 1;
    if (next < sortedModules.length && canAccessModule(next)) {
      setActiveModuleIndex(next);
      resetModuleState();
    } else if (reviewMode && next >= sortedModules.length) {
      setReviewMode(false);
      setShowConclusion(true);
    }
  }, [activeModuleIndex, sortedModules, canAccessModule, reviewMode, resetModuleState]);

  const goPrev = useCallback(() => {
    if (activeModuleIndex === null || activeModuleIndex === 0) return;
    setActiveModuleIndex(activeModuleIndex - 1);
    resetModuleState();
  }, [activeModuleIndex, resetModuleState]);

  const enterReviewMode = useCallback(() => {
    setReviewMode(true);
    setShowConclusion(false);
    setShowIntro(false);
    setActiveModuleIndex(0);
    resetModuleState();
  }, [resetModuleState]);

  // ─── Side effects ─────────────────────────────────────
  useEffect(() => {
    if (!currentModule || !progress) return;
    if (currentModule.tipo === 'desafio' && progress.primeirasTentativasDesafio?.[currentModule.id]) {
      setAlreadyAttempted(true);
      const attempt = progress.primeirasTentativasDesafio[currentModule.id];
      setQuizScore({
        correct: 0, total: 0,
        percent: attempt.percentual || attempt.percentualAcerto || 0,
        points: attempt.pontos || attempt.pontosGanhos || 0,
      });
    }
  }, [currentModule, progress]);

  const handleVideoTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const percent = video.duration > 0 ? (video.currentTime / video.duration) * 100 : 0;
    setVideoProgress(percent);
    if (percent >= 80) setVideoCompleted(true);
  }, []);

  return {
    // Data
    trail, progress, loading, user, companyId,
    sortedModules, currentModule, activeModuleIndex,
    completedCount, totalModules, progressPercent,

    // UI state
    showIntro, showConclusion, sidebarOpen, saving, reviewMode,
    setSidebarOpen,

    // Quiz state
    currentQuestionIndex, selectedAnswers, answeredQuestions,
    quizSubmitted, quizScore, alreadyAttempted,

    // Video state
    videoRef, videoProgress, videoCompleted,

    // Module helpers
    isModuleCompleted, canAccessModule,

    // Actions
    startTrail, goToModule, goNext, goPrev, enterReviewMode,
    completeModule, handleAnswerSelect, handleConfirmAnswer,
    handleNextQuestion, handleSubmitDesafio, handleUnlockMission,
    handleVideoTimeUpdate,
  };
}
