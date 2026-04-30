// src/components/onboarding/onboarding-shell.tsx
// Orchestrator component that manages the entire onboarding flow.
// Wraps children and renders WelcomePopup, PageTour, FaiWidget, and PageTooltip.
// Added to each role's layout, after subscription gate.
//
// Flow:
//   [1] WelcomePopup  — shown on first login (all roles)
//   [2] PageTour      — guided tour of the platform pages (TL + Colaborador only)
//   [3] FaiWidget     — action checklist widget (all roles; TL+Colab only after tour)

'use client';

import { useCallback, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useOnboarding, completeOnboardingItem, getTourStepsForRole, type OnboardingRole } from '@/hooks/use-onboarding';
import { WelcomePopup } from './welcome-popup';
import { FaiWidget } from './fai-widget';
import { PageTooltip } from './page-tooltip';
import { PageTour } from './page-tour';
import { XlsxUploadModal } from '@/components/linkedin-analytics/xlsx-upload-modal';
import { getLinkedInAuthUrl } from '@/app/actions/linkedin';
import { getAuthToken } from '@/lib/auth-client';

type OnboardingShellProps = {
  role: OnboardingRole;
  companyName?: string;
  licensesCount?: number;
  children: React.ReactNode;
};

// ─── Tooltip definitions (Admin only) ────────────────────────
// TL and Colaborador use the PageTour instead.

type TooltipDef = {
  pathPattern: string;
  message: React.ReactNode;
  checklistItemId: string;
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
    await completeOnboardingItem(user?.uid, 'upload-linkedin-history');
  }, [user?.uid]);

  const settingsHref = getSettingsHref(role);
  const tourSteps = useMemo(() => getTourStepsForRole(role), [role]);
  const hasTour = tourSteps.length > 0; // true for TL and Colaborador

  // Tour visibility: shown after welcome, before checklist, session-only
  const showTour = ob.state.welcomeSeen && !ob.state.tourCompleted && !ob.state.checklistCompleted && hasTour;

  // FaiWidget: shown after tour (or immediately for admin), while checklist is incomplete
  const showFaiWidget = ob.state.welcomeSeen &&
    (!hasTour || ob.state.tourCompleted) &&
    !ob.state.checklistCompleted;

  // ─── Admin page tooltip logic (unchanged) ─────────────────
  const currentTooltip = useMemo(() => {
    if (role !== 'admin') return null;
    if (ob.state.checklistCompleted) return null;

    const match = ADMIN_TOOLTIPS.find((t) => pathname.startsWith(t.pathPattern));
    if (!match) return null;
    if (ob.state.dismissedTooltips.includes(match.checklistItemId)) return null;
    if (ob.state.completedItems.includes(match.checklistItemId)) return null;

    return match;
  }, [role, ob.state.checklistCompleted, ob.state.dismissedTooltips, ob.state.completedItems, pathname]);

  const handleTooltipDismiss = useCallback(async () => {
    if (!currentTooltip) return;
    await ob.dismissTooltipForItem(currentTooltip.checklistItemId);
  }, [currentTooltip, ob]);

  const currentChecklistItem = useMemo(() => {
    if (!currentTooltip) return undefined;
    return ob.checklist.find(c => c.id === currentTooltip.checklistItemId);
  }, [currentTooltip, ob.checklist]);

  // Don't show anything while loading
  if (ob.loading) return <>{children}</>;

  // If fully completed (and welcome seen), just render children
  if (ob.state.checklistCompleted && ob.state.welcomeSeen) {
    return <>{children}</>;
  }

  return (
    <>
      {/* [1] Welcome Popup — shown once on first login */}
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
        <div className="min-h-[60vh]" />
      ) : (
        children
      )}

      {/* [2] Page Tour — TL and Colaborador only, after welcome, before checklist */}
      {showTour && (
        <PageTour
          steps={tourSteps}
          onComplete={ob.markTourCompleted}
          onSkip={ob.markTourCompleted}
        />
      )}

      {/* [3] Floating Fai Widget — visible after tour (or immediately for admin) */}
      <FaiWidget
        checklist={ob.checklist}
        progress={ob.progress}
        completedCount={ob.completedCount}
        totalCount={ob.totalCount}
        visible={showFaiWidget}
        settingsHref={settingsHref}
      />

      {/* Admin-only Page Tooltip — contextual help per page */}
      {currentTooltip && (
        <PageTooltip
          message={currentTooltip.message}
          checklistItem={currentChecklistItem}
          currentStep={ob.completedCount + 1}
          totalSteps={ob.totalCount}
          onDismiss={handleTooltipDismiss}
          visible={ob.state.welcomeSeen && !ob.state.checklistCompleted}
        />
      )}
    </>
  );
}
