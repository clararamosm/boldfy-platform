// src/hooks/use-onboarding.ts
// Real-time onboarding status hook.
// Reads/writes onboarding state from user doc in Firestore.
// Each role has its own tour steps (pages to visit) and checklist items (actions to take).

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, onSnapshot, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ─── Types ──────────────────────────────────────────────────

export type OnboardingRole = 'admin' | 'colaborador' | 'thoughtleader';

export type OnboardingChecklistItem = {
  id: string;
  label: string;
  description: string;
  href: string;           // Where to navigate when clicked
  completed: boolean;
};

// A single stop in the guided page tour
export type TourStep = {
  id: string;
  href: string;           // Route to navigate to
  menuLabel: string;      // Label shown in the menu (for "Clique aqui" balloon)
  pageDescription: string; // Short description shown in the page tooltip
};

export type OnboardingState = {
  welcomeSeen: boolean;           // Has the user seen the welcome popup?
  tourCompleted: boolean;         // Has the user completed the page tour? (session-only, not persisted)
  checklistCompleted: boolean;    // All action items done?
  completedItems: string[];       // IDs of completed action checklist items
  dismissedTooltips: string[];    // IDs of admin tooltips the user clicked "Entendi!" on
  tooltipStep: number;            // Current admin tooltip step (0 = not started)
  completedAt?: number;           // Timestamp when all items were completed
};

export type OnboardingData = {
  state: OnboardingState;
  checklist: OnboardingChecklistItem[];
  progress: number;               // 0-100
  completedCount: number;
  totalCount: number;
  loading: boolean;
  // Actions
  markWelcomeSeen: () => Promise<void>;
  markTourCompleted: () => void;  // Session-only — no Firestore write
  markItemCompleted: (itemId: string) => Promise<void>;
  dismissTooltipForItem: (itemId: string) => Promise<void>;
  advanceTooltip: () => Promise<void>;
  dismissTooltips: () => Promise<void>;
};

// ─── Tour step definitions per role ──────────────────────────
// These drive the guided page tour (chat → tour → checklist).

export const COLABORADOR_TOUR_STEPS: TourStep[] = [
  {
    id: 'tour-dashboard',
    href: '/colaborador/dashboard',
    menuLabel: 'Dashboard',
    pageDescription: 'Aqui você acompanha seus pontos, missões ativas, progresso nas trilhas e o ranking da empresa. Tudo num lugar só.',
  },
  {
    id: 'tour-trilhas',
    href: '/colaborador/trilhas',
    menuLabel: 'Trilhas',
    pageDescription: 'Conteúdos de aprendizado sobre LinkedIn, marca pessoal e posicionamento. Cada trilha concluída vale pontos!',
  },
  {
    id: 'tour-missoes',
    href: '/colaborador/missoes',
    menuLabel: 'Missões',
    pageDescription: 'Complete desafios, acumule pontos e suba no ranking. Cada missão concluída te aproxima das recompensas!',
  },
  {
    id: 'tour-recompensas',
    href: '/colaborador/recompensas',
    menuLabel: 'Recompensas',
    pageDescription: 'Troque seus pontos por prêmios reais. Quanto mais você publica e engaja, mais pontos acumula!',
  },
  {
    id: 'tour-biblioteca',
    href: '/colaborador/biblioteca',
    menuLabel: 'Biblioteca',
    pageDescription: 'Aqui ficam os conteúdos gerados pela IA e os assets de marca da empresa — imagens e materiais prontos pra usar nos seus posts.',
  },
  {
    id: 'tour-assistente',
    href: '/colaborador/assistente',
    menuLabel: 'Assistente',
    pageDescription: 'Sua IA que escreve posts com a sua voz. Não é template genérico — é conteúdo que parece você. Use os créditos pra gerar quantos quiser!',
  },
  {
    id: 'tour-calendario',
    href: '/colaborador/calendario',
    menuLabel: 'Calendário',
    pageDescription: 'Veja toda a sua pauta de posts organizada por data — fácil de acompanhar o que está agendado e quando vai publicar.',
  },
  {
    id: 'tour-linkedin-feed',
    href: '/colaborador/linkedin-feed',
    menuLabel: 'LinkedIn Feed',
    pageDescription: 'Veja o que seus colegas estão publicando — ótimo pra se inspirar, engajar e manter o time conectado.',
  },
  {
    id: 'tour-analytics',
    href: '/colaborador/analytics',
    menuLabel: 'Analytics',
    pageDescription: 'Acompanhe suas métricas de desempenho no LinkedIn. Faça o upload do extrato uma vez por mês — a gente te lembra por e-mail!',
  },
  {
    id: 'tour-marca-pessoal',
    href: '/colaborador/marca-pessoal',
    menuLabel: 'Marca Pessoal',
    pageDescription: 'Defina sua voz, seus pilares de conteúdo e sua proposta de valor. É daqui que a IA aprende a escrever do seu jeito.',
  },
];

export const THOUGHTLEADER_TOUR_STEPS: TourStep[] = [
  {
    id: 'tour-backlog',
    href: '/thoughtleader/backlog',
    menuLabel: 'Backlog',
    pageDescription: 'Aqui você revisa e aprova os posts que a equipe de estratégia preparou pra você. Tudo organizado, pronto pra publicar com 1 clique.',
  },
  {
    id: 'tour-calendario',
    href: '/thoughtleader/calendario',
    menuLabel: 'Calendário',
    pageDescription: 'Visualize toda a sua pauta de conteúdo organizada por data — fica fácil ver o que está agendado e quando vai publicar.',
  },
  {
    id: 'tour-linkedin-feed',
    href: '/thoughtleader/linkedin-feed',
    menuLabel: 'LinkedIn Feed',
    pageDescription: 'Aqui você acompanha o que seus colegas estão publicando no LinkedIn — ótimo pra se inspirar e engajar com o time.',
  },
  {
    id: 'tour-analytics',
    href: '/thoughtleader/analytics',
    menuLabel: 'Analytics',
    pageDescription: 'Seu dashboard completo de análise de desempenho. Pra alimentá-lo, faça o upload do extrato do LinkedIn Analytics uma vez por mês.',
  },
  {
    id: 'tour-perfil',
    href: '/thoughtleader/perfil',
    menuLabel: 'Perfil LinkedIn',
    pageDescription: 'Aqui você vê o perfil conectado e pode gerenciar a autorização de publicação.',
  },
  {
    id: 'tour-estrategia',
    href: '/thoughtleader/estrategia',
    menuLabel: 'Estratégia',
    pageDescription: 'Aqui fica documentada toda a sua estratégia de conteúdo — pilares, tópicos e posicionamento definidos pela equipe.',
  },
  {
    id: 'tour-manual',
    href: '/thoughtleader/manual',
    menuLabel: 'Manual de Marca',
    pageDescription: 'Seu guia completo de voz, personalidade e identidade de marca. A base de tudo que a equipe produz pra você.',
  },
];

export function getTourStepsForRole(role: OnboardingRole): TourStep[] {
  switch (role) {
    case 'colaborador': return COLABORADOR_TOUR_STEPS;
    case 'thoughtleader': return THOUGHTLEADER_TOUR_STEPS;
    default: return [];
  }
}

// ─── Action checklist definitions per role ──────────────────
// Shown in the FaiWidget after the tour is completed.

const ADMIN_CHECKLIST: Omit<OnboardingChecklistItem, 'completed'>[] = [
  {
    id: 'brand-context',
    label: 'Preencher Brand Context',
    description: 'Configure a identidade da marca',
    href: '/admin/brand-context',
  },
  {
    id: 'invite-collaborator',
    label: 'Convidar um colaborador',
    description: 'Adicione alguém ao programa',
    href: '/admin/colaboradores',
  },
  {
    id: 'create-mission',
    label: 'Criar uma missão',
    description: 'Crie a primeira missão pro time',
    href: '/admin/missoes',
  },
  {
    id: 'add-reward',
    label: 'Adicionar uma recompensa',
    description: 'Cadastre algo na loja de pontos',
    href: '/admin/recompensas',
  },
  {
    id: 'activate-trails',
    label: 'Ativar as trilhas globais',
    description: 'Habilite trilhas de aprendizado',
    href: '/admin/trilhas',
  },
];

const COLABORADOR_CHECKLIST: Omit<OnboardingChecklistItem, 'completed'>[] = [
  {
    id: 'start-trail',
    label: 'Começar uma trilha',
    description: 'Acesse e inicie sua primeira trilha de aprendizado',
    href: '/colaborador/trilhas',
  },
  {
    id: 'use-content-idea',
    label: 'Usar uma ideia de conteúdo',
    description: 'Gere seu primeiro post com o Assistente',
    href: '/colaborador/assistente',
  },
  {
    id: 'schedule-content',
    label: 'Agendar um conteúdo',
    description: 'Agende um post no seu calendário',
    href: '/colaborador/calendario',
  },
  {
    id: 'first-publication',
    label: 'Fazer sua primeira publicação',
    description: 'Publique no LinkedIn e ganhe +30 pts + Conquista',
    href: '/colaborador/calendario',
  },
  {
    id: 'buy-reward',
    label: 'Fazer uma compra na loja',
    description: 'Troque seus pontos por uma recompensa',
    href: '/colaborador/recompensas',
  },
  {
    id: 'complete-mission',
    label: 'Completar uma missão',
    description: 'Conclua sua primeira missão',
    href: '/colaborador/missoes',
  },
];

const THOUGHTLEADER_CHECKLIST: Omit<OnboardingChecklistItem, 'completed'>[] = [
  {
    id: 'approve-content',
    label: 'Aprovar um conteúdo',
    description: 'Revise e aprove um post no Backlog',
    href: '/thoughtleader/backlog',
  },
  {
    id: 'publish-post',
    label: 'Publicar seu primeiro post',
    description: 'Publique um post diretamente pela plataforma',
    href: '/thoughtleader/backlog',
  },
  {
    id: 'comment-post',
    label: 'Comentar em um post',
    description: 'Engaje com o conteúdo dos seus colegas no Feed',
    href: '/thoughtleader/linkedin-feed',
  },
];

function getChecklistForRole(role: OnboardingRole) {
  switch (role) {
    case 'admin': return ADMIN_CHECKLIST;
    case 'colaborador': return COLABORADOR_CHECKLIST;
    case 'thoughtleader': return THOUGHTLEADER_CHECKLIST;
  }
}

// ─── Default state ───────────────────────────────────────────

const DEFAULT_STATE: OnboardingState = {
  welcomeSeen: false,
  tourCompleted: false,   // session-only, always starts false
  checklistCompleted: false,
  completedItems: [],
  dismissedTooltips: [],
  tooltipStep: 0,
};

// ─── Hook ────────────────────────────────────────────────────

export function useOnboarding(
  uid: string | undefined,
  role: OnboardingRole,
): OnboardingData {
  const [state, setState] = useState<OnboardingState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const stateRef = useRef(state);
  stateRef.current = state;

  const checklistDef = getChecklistForRole(role);

  // Real-time listener on user doc
  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(doc(db, 'users', uid), (snap) => {
      if (!snap.exists()) {
        setLoading(false);
        return;
      }

      const data = snap.data();
      const ob = (data.onboarding as Partial<OnboardingState>) || {};

      setState((prev) => ({
        welcomeSeen: ob.welcomeSeen ?? false,
        tourCompleted: prev.tourCompleted, // session-only — keep in-memory value
        checklistCompleted: ob.checklistCompleted ?? false,
        completedItems: ob.completedItems ?? [],
        dismissedTooltips: (ob.dismissedTooltips as string[]) ?? [],
        tooltipStep: ob.tooltipStep ?? 0,
        completedAt: ob.completedAt as number | undefined,
      }));
      setLoading(false);
    }, () => {
      setLoading(false);
    });

    return () => unsub();
  }, [uid]);

  // Build checklist with completion status
  const checklist: OnboardingChecklistItem[] = checklistDef.map((item) => ({
    ...item,
    completed: state.completedItems.includes(item.id),
  }));

  const completedCount = checklist.filter((i) => i.completed).length;
  const totalCount = checklist.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // ─── Actions ─────────────────────────────────────────────

  const markWelcomeSeen = useCallback(async () => {
    if (!uid) return;
    try {
      await updateDoc(doc(db, 'users', uid), {
        'onboarding.welcomeSeen': true,
        'onboarding.tooltipStep': 1,
      });
    } catch (err) {
      console.error('Failed to mark welcome as seen:', err);
    }
  }, [uid]);

  // Tour is session-only — no Firestore write. If user closes browser, tour restarts.
  const markTourCompleted = useCallback(() => {
    setState((prev) => ({ ...prev, tourCompleted: true }));
  }, []);

  const markItemCompleted = useCallback(async (itemId: string) => {
    if (!uid) return;
    const current = stateRef.current;
    if (current.completedItems.includes(itemId)) return; // Already done

    const newCompleted = [...current.completedItems, itemId];
    const allDone = newCompleted.length >= checklistDef.length;

    try {
      await updateDoc(doc(db, 'users', uid), {
        'onboarding.completedItems': newCompleted,
        'onboarding.checklistCompleted': allDone,
        ...(allDone ? { 'onboarding.completedAt': Date.now() } : {}),
      });
    } catch (err) {
      console.error('Failed to mark item completed:', err);
    }
  }, [uid, checklistDef.length]);

  const dismissTooltipForItem = useCallback(async (itemId: string) => {
    if (!uid) return;
    const current = stateRef.current;
    if (current.dismissedTooltips.includes(itemId)) return; // Already dismissed

    const newDismissed = [...current.dismissedTooltips, itemId];
    try {
      await updateDoc(doc(db, 'users', uid), {
        'onboarding.dismissedTooltips': newDismissed,
      });
    } catch (err) {
      console.error('Failed to dismiss tooltip:', err);
    }
  }, [uid]);

  const advanceTooltip = useCallback(async () => {
    if (!uid) return;
    const next = stateRef.current.tooltipStep + 1;
    try {
      await updateDoc(doc(db, 'users', uid), {
        'onboarding.tooltipStep': next,
      });
    } catch (err) {
      console.error('Failed to advance tooltip:', err);
    }
  }, [uid]);

  const dismissTooltips = useCallback(async () => {
    if (!uid) return;
    try {
      await updateDoc(doc(db, 'users', uid), {
        'onboarding.tooltipStep': -1, // -1 = dismissed
      });
    } catch (err) {
      console.error('Failed to dismiss tooltips:', err);
    }
  }, [uid]);

  return {
    state,
    checklist,
    progress,
    completedCount,
    totalCount,
    loading,
    markWelcomeSeen,
    markTourCompleted,
    markItemCompleted,
    dismissTooltipForItem,
    advanceTooltip,
    dismissTooltips,
  };
}

// ─── Exported definitions (for static/server use) ──
export {
  ADMIN_CHECKLIST,
  COLABORADOR_CHECKLIST,
  THOUGHTLEADER_CHECKLIST,
  getChecklistForRole,
};

// ─── Standalone helper (no hook needed) ─────────────────────
// Call this from any component after a successful action to auto-complete a checklist item.

export async function completeOnboardingItem(uid: string | undefined, itemId: string) {
  if (!uid) return;
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const ob = (data.onboarding as Partial<OnboardingState>) || {};
    const completedItems = ob.completedItems ?? [];

    if (completedItems.includes(itemId)) return; // Already completed

    const role = data.role as string;
    let totalItems = 0;
    if (role === 'admin') totalItems = ADMIN_CHECKLIST.length;
    else if (role === 'colaborador') totalItems = COLABORADOR_CHECKLIST.length;
    else if (role === 'thoughtleader') totalItems = THOUGHTLEADER_CHECKLIST.length;
    else return;

    const newCompleted = [...completedItems, itemId];
    const allDone = newCompleted.length >= totalItems;

    await updateDoc(userRef, {
      'onboarding.completedItems': newCompleted,
      'onboarding.checklistCompleted': allDone,
      ...(allDone ? { 'onboarding.completedAt': Date.now() } : {}),
    });
  } catch (err) {
    console.error('Failed to complete onboarding item:', err);
  }
}
