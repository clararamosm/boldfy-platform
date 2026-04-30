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
import { getLinkedInAuthUrl } from '@/app/actions/linkedin';
import { getAuthToken } from '@/lib/auth-client';

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
    pathPattern: '/colaborador/dashboard',
    message: <><strong>Este é o seu Dashboard.</strong> Aqui você acompanha seus pontos, missões ativas, progresso nas trilhas e o ranking da empresa. Tudo num lugar só.</>,
    checklistItemId: 'visit-dashboard',
  },
  {
    pathPattern: '/colaborador/calendario',
    message: <><strong>Este é o seu Calendário.</strong> Veja toda a sua pauta de posts organizada por data — fácil de acompanhar o que está agendado e quando vai publicar.</>,
    checklistItemId: 'visit-calendario',
  },
  {
    pathPattern: '/colaborador/assistente',
    message: <><strong>Este é o Assistente.</strong> Sua IA que escreve posts com a sua voz. Não é template genérico — é conteúdo que parece você. Use os créditos pra gerar quantos quiser!</>,
    checklistItemId: 'visit-assistente',
  },
  {
    pathPattern: '/colaborador/linkedin-feed',
    message: <><strong>Este é o LinkedIn Feed.</strong> Veja o que seus colegas estão publicando — ótimo pra se inspirar, engajar e manter o time conectado.</>,
    checklistItemId: 'visit-linkedin-feed',
  },
  {
    pathPattern: '/colaborador/analytics',
    message: <><strong>Este é o seu Analytics.</strong> Acompanhe suas métricas de desempenho no LinkedIn. Pra manter os gráficos atualizados, faça o upload do extrato do LinkedIn Analytics uma vez por mês — fique tranquilo, a gente te manda um lembrete por e-mail!</>,
    checklistItemId: 'visit-analytics',
  },
  {
    pathPattern: '/colaborador/biblioteca',
    message: <><strong>Esta é a Biblioteca.</strong> Aqui ficam os conteúdos gerados pela IA e os assets de marca da empresa — imagens, templates e materiais prontos pra usar nos seus posts.</>,
    checklistItemId: 'visit-biblioteca',
  },
  {
    pathPattern: '/colaborador/marca-pessoal',
    message: <><strong>Esta é a sua Marca Pessoal.</strong> Defina sua voz, seus pilares de conteúdo e sua proposta de valor. É daqui que a IA aprende a escrever do seu jeito.</>,
    checklistItemId: 'visit-marca-pessoal',
  },
  {
    pathPattern: '/colaborador/missoes',
    message: <><strong>Estas são as Missões.</strong> Complete desafios, acumule pontos e suba no ranking. Cada missão concluída te aproxima das recompensas!</>,
    checklistItemId: 'visit-missoes',
  },
  {
    pathPattern: '/colaborador/recompensas',
    message: <><strong>Esta é a loja de Recompensas.</strong> Troque seus pontos por prêmios reais. Quanto mais você publica e engaja, mais pontos acumula!</>,
    checklistItemId: 'visit-recompensas',
  },
  {
    pathPattern: '/colaborador/trilhas',
    message: <><strong>Estas são as Trilhas.</strong> Conteúdos de aprendizado sobre LinkedIn, marca pessoal e posicionamento. Cada trilha concluída vale pontos!</>,
    checklistItemId: 'visit-trilhas',
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

  const handleLinkedInConnect = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const token = await getAuthToken();
      const result = await getLinkedInAuthUrl(token, user.uid);
      if (result.url) {
        window.location.href = result.url;
      }
    } catch {
      // Silent fail — user can connect later via settings
    }
  }, [user?.uid]);

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

  // Handler for "Entendi!" — for TL and colaborador: marks item as completed + dismisses tooltip
  // Visiting the page + reading the tooltip is enough — no further action required
  const handleTooltipDismiss = useCallback(async () => {
    if (!currentTooltip) return;
    if (role === 'thoughtleader' || role === 'colaborador') {
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
        onRequestLinkedInConnect={handleLinkedInConnect}
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
