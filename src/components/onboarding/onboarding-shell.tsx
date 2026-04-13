// src/components/onboarding/onboarding-shell.tsx
// Orchestrator component that manages the entire onboarding flow.
// Wraps children and renders WelcomePopup, FaiWidget, and PageTooltip.
// Added to each role's layout, after subscription gate.

'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useOnboarding, type OnboardingRole } from '@/hooks/use-onboarding';
import { WelcomePopup } from './welcome-popup';
import { FaiWidget } from './fai-widget';
import { PageTooltip } from './page-tooltip';

type OnboardingShellProps = {
  role: OnboardingRole;
  companyName?: string;
  licensesCount?: number;
  trialDays?: number;
  children: React.ReactNode;
};

// ─── Tooltip definitions per route ────────────────────────────
// Maps pathname patterns to tooltip messages.

type TooltipDef = {
  pathPattern: string;     // Pathname to match (startsWith)
  message: React.ReactNode;
  step: number;            // Which tooltip step this is
};

const ADMIN_TOOLTIPS: TooltipDef[] = [
  {
    pathPattern: '/admin/brand-context',
    message: <><strong>Este é o Brand Context.</strong> Preencha com a identidade da marca — tom de voz, público, valores. A IA usa isso pra gerar conteúdo.</>,
    step: 1,
  },
  {
    pathPattern: '/admin/colaboradores',
    message: <><strong>Aqui você gerencia o time.</strong> Convide colaboradores e thought leaders pro programa.</>,
    step: 2,
  },
  {
    pathPattern: '/admin/missoes',
    message: <><strong>Missões motivam o time.</strong> Crie desafios que geram pontos e engajamento!</>,
    step: 3,
  },
  {
    pathPattern: '/admin/recompensas',
    message: <><strong>A loja de recompensas.</strong> Cadastre prêmios que o time pode trocar por pontos.</>,
    step: 4,
  },
  {
    pathPattern: '/admin/trilhas',
    message: <><strong>Trilhas de aprendizado.</strong> Ative conteúdos educativos pro time evoluir.</>,
    step: 5,
  },
];

const COLAB_TOOLTIPS: TooltipDef[] = [
  {
    pathPattern: '/colaborador/configuracoes',
    message: <><strong>Suas configurações.</strong> Conecte seu LinkedIn aqui pra poder publicar posts!</>,
    step: 1,
  },
  {
    pathPattern: '/colaborador/trilhas',
    message: <><strong>Trilhas de aprendizado.</strong> Explore conteúdos pra melhorar seu posicionamento no LinkedIn.</>,
    step: 2,
  },
  {
    pathPattern: '/colaborador/posts',
    message: <><strong>Seus posts.</strong> Crie conteúdo com ajuda da IA e publique direto no LinkedIn!</>,
    step: 3,
  },
  {
    pathPattern: '/colaborador/missoes',
    message: <><strong>Missões do programa.</strong> Complete desafios pra ganhar pontos e recompensas!</>,
    step: 4,
  },
];

const TL_TOOLTIPS: TooltipDef[] = [
  {
    pathPattern: '/thoughtleader/configuracoes',
    message: <><strong>Conecte seu LinkedIn.</strong> Isso permite que a equipe publique posts no seu perfil.</>,
    step: 1,
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
  trialDays = 14,
  children,
}: OnboardingShellProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const ob = useOnboarding(user?.uid, role);

  const tooltipDefs = useMemo(() => getTooltipsForRole(role), [role]);
  const settingsHref = getSettingsHref(role);

  // Find current tooltip based on path and step
  const currentTooltip = useMemo(() => {
    if (ob.state.tooltipStep <= 0) return null; // Not started or dismissed
    if (ob.state.checklistCompleted) return null; // All done

    return tooltipDefs.find(
      (t) => pathname.startsWith(t.pathPattern) && t.step === ob.state.tooltipStep
    ) || null;
  }, [ob.state.tooltipStep, ob.state.checklistCompleted, tooltipDefs, pathname]);

  const totalTooltipSteps = tooltipDefs.length;

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
        trialDays={trialDays}
        onComplete={ob.markWelcomeSeen}
      />

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

      {/* Page Tooltip — shows contextual help per page */}
      {currentTooltip && (
        <PageTooltip
          message={currentTooltip.message}
          checklist={ob.checklist}
          currentStep={currentTooltip.step}
          totalSteps={totalTooltipSteps}
          onDismiss={ob.advanceTooltip}
          visible={ob.state.welcomeSeen && !ob.state.checklistCompleted}
        />
      )}
    </>
  );
}
