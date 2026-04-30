// src/hooks/use-onboarding.ts
// Real-time onboarding status hook.
// Reads/writes onboarding state from user doc in Firestore.
// Each role has its own checklist items that get tracked.

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

export type OnboardingState = {
  welcomeSeen: boolean;           // Has the user seen the welcome popup?
  checklistCompleted: boolean;    // All items done?
  completedItems: string[];       // IDs of completed items
  dismissedTooltips: string[];    // IDs of tooltips the user clicked "Entendi!" on
  tooltipStep: number;            // Current tooltip step (0 = not started)
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
  markItemCompleted: (itemId: string) => Promise<void>;
  dismissTooltipForItem: (itemId: string) => Promise<void>;
  advanceTooltip: () => Promise<void>;
  dismissTooltips: () => Promise<void>;
};

// ─── Checklist definitions per role ──────────────────────────

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
    id: 'visit-dashboard',
    label: 'Dashboard',
    description: 'Seu painel com pontos, missões, trilhas e ranking',
    href: '/colaborador/dashboard',
  },
  {
    id: 'visit-calendario',
    label: 'Calendário',
    description: 'Sua pauta de posts organizada por data',
    href: '/colaborador/calendario',
  },
  {
    id: 'visit-assistente',
    label: 'Assistente',
    description: 'IA que escreve posts com a sua voz',
    href: '/colaborador/assistente',
  },
  {
    id: 'visit-linkedin-feed',
    label: 'LinkedIn Feed',
    description: 'Feed dos seus colegas no LinkedIn',
    href: '/colaborador/linkedin-feed',
  },
  {
    id: 'visit-analytics',
    label: 'Analytics',
    description: 'Suas métricas de desempenho no LinkedIn',
    href: '/colaborador/analytics',
  },
  {
    id: 'visit-biblioteca',
    label: 'Biblioteca',
    description: 'Conteúdos gerados pela IA e assets de marca',
    href: '/colaborador/biblioteca',
  },
  {
    id: 'visit-marca-pessoal',
    label: 'Marca Pessoal',
    description: 'Sua voz, pilares e identidade de conteúdo',
    href: '/colaborador/marca-pessoal',
  },
  {
    id: 'visit-missoes',
    label: 'Missões',
    description: 'Desafios que geram pontos e recompensas',
    href: '/colaborador/missoes',
  },
  {
    id: 'visit-recompensas',
    label: 'Recompensas',
    description: 'Loja onde você troca pontos por prêmios reais',
    href: '/colaborador/recompensas',
  },
  {
    id: 'visit-trilhas',
    label: 'Trilhas',
    description: 'Conteúdos de aprendizado sobre LinkedIn e marca',
    href: '/colaborador/trilhas',
  },
];

const THOUGHTLEADER_CHECKLIST: Omit<OnboardingChecklistItem, 'completed'>[] = [
  {
    id: 'visit-backlog',
    label: 'Backlog',
    description: 'Onde você revisa e aprova os posts da equipe',
    href: '/thoughtleader/backlog',
  },
  {
    id: 'visit-calendario',
    label: 'Calendário',
    description: 'Visão da sua pauta em forma de calendário',
    href: '/thoughtleader/calendario',
  },
  {
    id: 'visit-linkedin-feed',
    label: 'LinkedIn Feed',
    description: 'Onde você acompanha o conteúdo dos seus colegas',
    href: '/thoughtleader/linkedin-feed',
  },
  {
    id: 'visit-analytics',
    label: 'Analytics',
    description: 'Seu dashboard de análise de desempenho',
    href: '/thoughtleader/analytics',
  },
  {
    id: 'visit-perfil',
    label: 'Perfil do LinkedIn',
    description: 'Veja o perfil conectado e gerencie a conexão',
    href: '/thoughtleader/perfil',
  },
  {
    id: 'visit-estrategia',
    label: 'Estratégia',
    description: 'Onde você vê sua estratégia de conteúdo',
    href: '/thoughtleader/estrategia',
  },
  {
    id: 'visit-manual',
    label: 'Manual de Marca',
    description: 'Seu guia de voz e identidade de marca',
    href: '/thoughtleader/manual',
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

      setState({
        welcomeSeen: ob.welcomeSeen ?? false,
        checklistCompleted: ob.checklistCompleted ?? false,
        completedItems: ob.completedItems ?? [],
        dismissedTooltips: (ob.dismissedTooltips as string[]) ?? [],
        tooltipStep: ob.tooltipStep ?? 0,
        completedAt: ob.completedAt as number | undefined,
      });
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
        'onboarding.tooltipStep': 1, // Start tooltips after welcome
      });
    } catch (err) {
      console.error('Failed to mark welcome as seen:', err);
    }
  }, [uid]);

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
    markItemCompleted,
    dismissTooltipForItem,
    advanceTooltip,
    dismissTooltips,
  };
}

// ─── Exported checklist definitions (for server-side or static use) ──
export { ADMIN_CHECKLIST, COLABORADOR_CHECKLIST, THOUGHTLEADER_CHECKLIST, getChecklistForRole };

// ─── Standalone helper (no hook needed) ─────────────────────
// Call this from any component after a successful action to auto-complete a checklist item.
// It reads the current onboarding state, checks if the item needs completing,
// and updates Firestore directly. Safe to call multiple times (idempotent).

export async function completeOnboardingItem(uid: string | undefined, itemId: string) {
  if (!uid) return;
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const ob = (data.onboarding as Partial<OnboardingState>) || {};
    const completedItems = ob.completedItems ?? [];

    // Already completed
    if (completedItems.includes(itemId)) return;

    // Determine total items for this user's role
    const role = data.role as string;
    let totalItems = 0;
    if (role === 'admin') totalItems = ADMIN_CHECKLIST.length;
    else if (role === 'colaborador') totalItems = COLABORADOR_CHECKLIST.length;
    else if (role === 'thoughtleader') totalItems = THOUGHTLEADER_CHECKLIST.length;
    else return; // Unknown role

    const newCompleted = [...completedItems, itemId];
    const allDone = newCompleted.length >= totalItems;

    await updateDoc(userRef, {
      'onboarding.completedItems': newCompleted,
      'onboarding.checklistCompleted': allDone,
      ...(allDone ? { 'onboarding.completedAt': Date.now() } : {}),
    });
  } catch (err) {
    // Silent fail — onboarding is non-critical
    console.error('Failed to complete onboarding item:', err);
  }
}
