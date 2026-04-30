// src/components/onboarding/onboarding-shell.tsx
// Orchestrator component that manages the entire onboarding flow.
// Wraps children and renders WelcomePopup, FaiWidget, and PageTooltip.
// Added to each role's layout, after subscription gate.

'use client';

import { useCallback, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useOnboarding, completeOnboardingItem, type OnboardingRole } from '@/hooks/use-onboarding';
import { WelcomePopup } from './welcome-popup';
import { FaiWidget } from './fai-widget';
import { PageTooltip } from './page-tooltip';
import { XlsxUploadModal } from '@/components/linkedin-analytics/xlsx-upload-modal';

type OnboardingShellProps = {
  role: OnboardingRole;
  companyName?: string;
  licensesCount?: number;
  children: React.ReactNode;
};

// ─── Tooltip definitions per route ────────────────────────────
// Maps pathname patterns to tooltip messages + the checklist item they relate to.

type TooltipDef = {
  pathPattern: string;     // Pathname to match (startsWith)
  message: React.ReactNode;
  checklistItemId: string; // The checklist item ID this tooltip relates to
};

const ADMIN_TOOLTIPS: TooltipDef[] = [
  {
    pathPattern: '/admin/brand-context',
    message: <><strong>Este é o Brand Context.</strong> Preencha com a identidade da marca — tom de voz, público, valores. A IA usa isso pra gerar conteúdo.</>,
    checklistItemId: 'brand-context',
  },
  {
    pathPattern: '/admin/colaboradores',
    message: <><strong>Aqui você gerencia o time.</strong> Existem dois tipos: <strong>Colaboradores</strong> escrevem posts com ajuda da IA; <strong>Thought Leaders</strong> recebem conteúdo pronto da equipe de estratégia. Pra liberar seats de TL, fale com o time Boldfy.</>,
    checklistItemId: 'invite-collaborator',
  },
  {
    pathPattern: '/admin/missoes',
    message: <><strong>Missões motivam o time.</strong> Crie desafios que geram pontos e engajamento!</>,
    checklistItemId: 'create-mission',
  },
  {
    pathPattern: '/admin/recompensas',
    message: <><strong>A loja de recompensas.</strong> Cadastre prêmios que o time pode trocar por pontos.</>,
    checklistItemId: 'add-reward',
  },
  {
    pathPattern: '/admin/trilhas',
    message: <><strong>Trilhas de aprendizado.</strong> Ative conteúdos educativos pro time evoluir.</>,
    checklistItemId: 'activate-trails',
  },
];

const COLAB_TOOLTIPS: TooltipDef[] = [
  {
    pathPattern: '/colaborador/configuracoes',
    message: <><strong>Suas configurações.</strong> Conecte seu LinkedIn aqui pra poder publicar posts!</>,
    checklistItemId: 'connect-linkedin',
  },
  {
    pathPattern: '/colaborador/trilhas',
    message: <><strong>Trilhas de aprendizado.</strong> Explore conteúdos pra melhorar seu posicionamento no LinkedIn.</>,
    checklistItemId: 'view-trail',
  },
  {
    pathPattern: '/colaborador/posts',
    message: <><strong>Seus posts.</strong> Crie conteúdo com ajuda da IA e publique direto no LinkedIn!</>,
    checklistItemId: 'create-post',
  },
  {
    pathPattern: '/colaborador/calendario',
    message: <><strong>Seus posts.</strong> Crie conteúdo com ajuda da IA e publique direto no LinkedIn!</>,
    checklistItemId: 'create-post',
  },
  {
    pathPattern: '/colaborador/missoes',
    message: <><strong>Missões do programa.</strong> Complete desafios pra ganhar pontos e recompensas!</>,
    checklistItemId: 'complete-mission',
  },
];

const TL_TOOLTIPS: TooltipDef[] = [
  {
    pathPattern: '/thoughtleader/backlog',
    message: <><strong>Este é o seu Backlog.</strong> Aqui você revisa e aprova os posts que a equipe de estratégia preparou pra você. Tudo organizado, pronto pra publicar com 1 clique.</>,
    checklistItemId: 'visit-backlog',
  },
  {
    pathPattern: '/thoughtleader/calendario',
    message: <><strong>Este é o seu Calendário.</strong> Visualize toda a sua pauta de conteúdo organizada por data — fica fácil ver o que está agendado e quando vai publicar.</>,
    checklistItemId: 'visit-calendario',
  },
  {
    pathPattern: '/thoughtleader/linkedin-feed',
    message: <><strong>Este é o LinkedIn Feed.</strong> Aqui você acompanha o que seus colegas estão publicando no LinkedIn — ótimo pra se inspirar e engajar com o time.</>,
    checklistItemId: 'visit-linkedin-feed',
  },
  {
    pathPattern: '/thoughtleader/analytics',
    message: <><strong>Este é o seu Analytics.</strong> Seu dashboard completo de análise de desempenho. Pra alimentá-lo, faça o upload do extrato do LinkedIn Analytics uma vez por mês.</>,
    checklistItemId: 'visit-analytics',
  },
  {
    pathPattern: '/thoughtleader/perfil',
    message: <><strong>Este é o Perfil do LinkedIn.</strong> Aqui você vê o perfil conectado e pode gerenciar a autorização de publicação.</>,
    checklistItemId: 'visit-perfil',
  },
  {
    pathPattern: '/thoughtleader/estrategia',
    message: <><strong>Esta é a sua Estratégia.</strong> Aqui fica documentada toda a sua estratégia de conteúdo — pilares, tópicos e posicionamento definidos pela equipe.</>,
    checklistItemId: 'visit-estrategia',
  },
  {
    pathPattern: '/thoughtleader/manual',
    message: <><strong>Este é o Manual de Marca.</strong> Seu guia completo de voz, personalidade e identidade de marca. A base de tudo que a equipe produz pra você.</>,
    checklistItemId: 'visit-manual',
  },
];

function getTooltipsForRole(role: OnboardingRole): TooltipDef[] {
  switch (role) {
    case 'admin': return ADMIN_TOOLTIPS;
    case 'colaborador': return COLAB_TOOLTIPS;
    case 'thoughtleader': return TL_TOOLTIPS;
  }
}

function getSettingsHref(role: OnboardingRole): string {
  switch (role) {
    case 'admin': return '/admin/configuracoes';
    case 'colaborador': return '/colaborador/configuracoes';
    case 'thoughtleader': return '/thoughtleader/configuracoes';
  }
}

// ─── Component ───────────────────────────────────────────────

export function OnboardingShell({
  role,
  companyName = '',
  licensesCount = 5,
  children,
}: OnboardingShellProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const ob = useOnboarding(user?.uid, role);

  // Modal de upload histórico (aberto pelo WelcomePopup)
  const [historicalUploadOpen, setHistoricalUploadOpen] = useState(false);

  // Upload histórico concluído = item 'upload-linkedin-history' no checklist
  const historyUploaded = ob.state.completedItems.includes('upload-linkedin-history');

  const handleRequestUpload = useCallback(() => {
    setHistoricalUploadOpen(true);
  }, []);

  const handleHistoricalUploadSuccess = useCallback(async () => {
    setHistoricalUploadOpen(false);
    // Marcar item de onboarding como concluído
    await completeOnboardingItem(user?.uid, 'upload-linkedin-history');
  }, [user?.uid]);

  const tooltipDefs = useMemo(() => getTooltipsForRole(role), [role]);
  const settingsHref = getSettingsHref(role);

  // Find tooltip for current page — only if not already dismissed and not completed
  const currentTooltip = useMemo(() => {
    if (ob.state.checklistCompleted) return null; // All done

    const match = tooltipDefs.find((t) => pathname.startsWith(t.pathPattern));
    if (!match) return null;

    // Don't show if the user already clicked "Entendi!" for this tooltip
    if (ob.state.dismissedTooltips.includes(match.checklistItemId)) return null;

    // Don't show if the checklist item is already completed (action was done)
    if (ob.state.completedItems.includes(match.checklistItemId)) return null;

    return match;
  }, [ob.state.checklistCompleted, ob.state.dismissedTooltips, ob.state.completedItems, tooltipDefs, pathname]);

  // Handler for "Entendi!" — for TL: marks item as completed + dismisses tooltip
  // For other roles: only dismisses (item is completed by performing the actual action)
  const handleTooltipDismiss = useCallback(async () => {
    if (!currentTooltip) return;
    if (role === 'thoughtleader') {
      // Visiting the page + reading the tooltip is enough — complete on "Entendi!"
      await ob.markItemCompleted(currentTooltip.checklistItemId);
    }
    await ob.dismissTooltipForItem(currentTooltip.checklistItemId);
  }, [currentTooltip, ob, role]);

  // Find the single checklist item for this page
  const currentChecklistItem = useMemo(() => {
    if (!currentTooltip) return undefined;
    return ob.checklist.find(c => c.id === currentTooltip.checklistItemId);
  }, [currentTooltip, ob.checklist]);

  // Current step is the index+1 of completed items (for progress display)
  const completedStepCount = ob.completedCount;
  const totalTooltipSteps = ob.totalCount;

  // Don't show anything while loading
  if (ob.loading) return <>{children}</>;

  // If onboarding is fully completed, just render children
  if (ob.state.checklistCompleted && ob.state.welcomeSeen) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Welcome Popup — shown once on first login */}
      <WelcomePopup
        open={!ob.state.welcomeSeen}
        role={role}
        userName={user?.name || ''}
        companyName={companyName}
        licensesCount={licensesCount}
        onRequestUpload={handleRequestUpload}
        historyUploaded={historyUploaded}
        onComplete={ob.markWelcomeSeen}
      />

      {/* Modal de upload histórico — disparado pelo WelcomePopup */}
      {(role === 'thoughtleader' || role === 'colaborador') && user?.uid && (
        <XlsxUploadModal
          open={historicalUploadOpen}
          onOpenChange={setHistoricalUploadOpen}
          userId={user.uid}
          uploadType="historical"
          onSuccess={handleHistoricalUploadSuccess}
        />
      )}

      {/* Page content (for admin, block unless welcome is seen) */}
      {role === 'admin' && !ob.state.welcomeSeen ? (
        <div className="min-h-[60vh]" /> // Empty space behind popup
      ) : (
        children
      )}

      {/* Floating Fai Widget — visible while checklist is incomplete */}
      <FaiWidget
        checklist={ob.checklist}
        progress={ob.progress}
        completedCount={ob.completedCount}
        totalCount={ob.totalCount}
        visible={ob.state.welcomeSeen && !ob.state.checklistCompleted}
        settingsHref={settingsHref}
      />

      {/* Page Tooltip — shows contextual help per page (only the relevant item) */}
      {currentTooltip && (
        <PageTooltip
          message={currentTooltip.message}
          checklistItem={currentChecklistItem}
          currentStep={completedStepCount + 1}
          totalSteps={totalTooltipSteps}
          onDismiss={handleTooltipDismiss}
          visible={ob.state.welcomeSeen && !ob.state.checklistCompleted}
        />
      )}
    </>
  );
}
