// src/components/dashboard/role-layout.tsx
// Shared layout shell for all role-specific areas.
// Handles: AuthProvider → Suspense → auth guard → sidebar shell → DashboardLayout.
// Each role passes its own sidebar content and optional features.
'use client';

import type React from 'react';
import { Suspense } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { SidebarHeader, SidebarContent, SidebarFooter } from '@/components/ui/sidebar';
import Logo from '@/components/logo';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';
import { Loader2 } from 'lucide-react';
import { AuthProvider } from '@/contexts/auth-context';
import { SidebarUserFooter, type FooterMenuItem } from '@/components/dashboard/sidebar-user-footer';
import { LocaleProvider } from '@/lib/i18n/context';
import type { Locale } from '@/lib/i18n/types';
import { useAuthGuard, type UseAuthGuardOptions } from '@/hooks/use-auth-guard';
import { useRouter } from 'next/navigation';

// ─── Types ──────────────────────────────────────────────────────

export interface RoleLayoutConfig {
  /** Auth guard options (role, checkLinkedInToken, etc.) */
  authOptions: UseAuthGuardOptions;
  /** Fixed locale override (null = use detected) */
  locale?: Locale;
  /** Role label shown in sidebar footer */
  roleLabel: string;
  /** Initials fallback for avatar */
  fallbackInitials: string;
  /** Feedback page name for sidebar footer */
  feedbackPage?: string;
  /** Logout label */
  logoutLabel?: string;
  /** Additional menu items for sidebar footer */
  menuItems?: FooterMenuItem[];
}

interface RoleLayoutProps {
  config: RoleLayoutConfig;
  /** Sidebar nav component (e.g. <ColaboradorSidebarNav />) */
  sidebarNav: React.ReactNode;
  /** Optional content above the nav (e.g. "Master Admin" label) */
  sidebarPreNav?: React.ReactNode;
  /** Optional content in sidebar footer before user footer (e.g. LinkedInSidebarBox) */
  sidebarFooterExtra?: React.ReactNode;
  /** Avatar override URL (e.g. company logo) */
  avatarOverride?: string;
  /** Wrap children with additional elements (e.g. OnboardingShell) */
  renderChildren?: (children: React.ReactNode, ctx: { loading: boolean }) => React.ReactNode;
  /** Banner/overlay above children (e.g. master mode banner, trial banner) */
  topBanner?: React.ReactNode;
  children: React.ReactNode;
}

// ─── Inner (after auth) ─────────────────────────────────────────

function RoleLayoutInner({
  config,
  sidebarNav,
  sidebarPreNav,
  sidebarFooterExtra,
  avatarOverride,
  renderChildren,
  topBanner,
  children,
}: RoleLayoutProps) {
  const guard = useAuthGuard(config.authOptions);
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  if (guard.loading || !guard.ready || !guard.user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const locale = config.locale || guard.locale as Locale || 'pt-BR' as Locale;

  const sidebarContent = (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-2 group-data-[state=collapsed]:justify-center">
          <Logo />
          <span className="font-headline text-xl font-bold text-foreground overflow-hidden transition-[max-width,opacity] duration-150 group-data-[state=collapsed]:opacity-0 group-data-[state=collapsed]:max-w-0">Boldfy</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {sidebarPreNav}
        {sidebarNav}
      </SidebarContent>
      <SidebarFooter>
        {sidebarFooterExtra}
        <SidebarUserFooter
          user={guard.user}
          roleLabel={config.roleLabel}
          fallbackInitials={config.fallbackInitials}
          avatarOverride={avatarOverride}
          feedbackPage={config.feedbackPage}
          menuItems={config.menuItems}
          onLogout={handleLogout}
          logoutLabel={config.logoutLabel || 'Sair'}
        />
      </SidebarFooter>
    </>
  );

  const finalChildren = renderChildren
    ? renderChildren(children, { loading: guard.loading })
    : children;

  return (
    <LocaleProvider locale={locale}>
      <DashboardLayout sidebar={sidebarContent}>
        {topBanner}
        {finalChildren}
      </DashboardLayout>
    </LocaleProvider>
  );
}

// ─── Outer (AuthProvider + Suspense) ────────────────────────────

export default function RoleLayout(props: RoleLayoutProps) {
  return (
    <AuthProvider>
      <Suspense
        fallback={
          <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          </div>
        }
      >
        <RoleLayoutInner {...props} />
      </Suspense>
    </AuthProvider>
  );
}
