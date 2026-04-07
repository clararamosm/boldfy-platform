'use client';

import { Header } from '@/components/dashboard/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SupportDialog } from '@/components/support-dialog';
import {
  BookOpen,
  Linkedin,
  Sparkles,
  CalendarDays,
  Trophy,
  BarChart3,
  Zap,
  Settings,
  PlayCircle,
  Users,
  LayoutDashboard,
  Gift,
  Library,
} from 'lucide-react';
import { useT } from '@/lib/i18n/context';
import type { Dictionary } from '@/lib/i18n/dictionaries';

// ─── Tutorial sections for Colaboradores ──────────────────────
function getColaboradorSections(sp: Dictionary['supportPage']) {
  return [
    {
      title: sp.gettingStarted,
      description: sp.gettingStartedDesc,
      icon: PlayCircle,
      items: [sp.accessAccount, sp.connectLinkedin, sp.setupProfile],
    },
    {
      title: sp.trailsSection,
      description: sp.trailsSectionDesc,
      icon: BookOpen,
      items: [sp.startTrail, sp.completeModules, sp.scoringProgress],
    },
    {
      title: sp.assistantSection,
      description: sp.assistantSectionDesc,
      icon: Sparkles,
      items: [sp.generateCaption, sp.chooseHooks, sp.hotTopics, sp.formatsSizes],
    },
    {
      title: sp.calendarSection,
      description: sp.calendarSectionDesc,
      icon: CalendarDays,
      items: [sp.schedulePost, sp.publishLinkedin, sp.addImages],
    },
    {
      title: sp.feedSection,
      description: sp.feedSectionDesc,
      icon: Linkedin,
      items: [sp.viewColleaguePosts, sp.engagementMetrics],
    },
    {
      title: sp.missionsSection,
      description: sp.missionsSectionDesc,
      icon: Zap,
      items: [sp.completeMissions, sp.missionTypes, sp.missionRewards],
    },
    {
      title: sp.rankingsSection,
      description: sp.rankingsSectionDesc,
      icon: Trophy,
      items: [sp.howRanking, sp.redeemRewards, sp.scoringSystem],
    },
    {
      title: sp.settingsSection,
      description: sp.settingsSectionDesc,
      icon: Settings,
      items: [sp.editBranding, sp.reconnectLinkedin, sp.editProfile],
    },
  ];
}

// ─── Tutorial sections for Admins ─────────────────────────────
function getAdminSections(sp: Dictionary['supportPage']) {
  return [
    {
      title: sp.dashboardMetrics,
      description: sp.dashboardMetricsDesc,
      icon: LayoutDashboard,
      items: [sp.understandMetrics, sp.trackActivity, sp.engagementIndicators],
    },
    {
      title: sp.manageCollaborators,
      description: sp.manageCollaboratorsDesc,
      icon: Users,
      items: [sp.inviteCollaborators, sp.licenseLimits, sp.removeCollaborators],
    },
    {
      title: sp.missionsSection,
      description: sp.missionsSectionDesc,
      icon: Trophy,
      items: [sp.createTrail, sp.addModules, sp.trackProgress],
    },
    {
      title: sp.adminTrails,
      description: sp.adminTrailsDesc,
      icon: BookOpen,
      items: [sp.createTrail, sp.addModules, sp.trackProgress],
    },
    {
      title: sp.adminRewards,
      description: sp.adminRewardsDesc,
      icon: Gift,
      items: [sp.createRewards, sp.manageRedemptions, sp.markDelivered],
    },
    {
      title: sp.adminLibrary,
      description: sp.adminLibraryDesc,
      icon: Library,
      items: [sp.addMaterials, sp.organizeCategories, sp.shareCollaborators],
    },
    {
      title: sp.feedSection,
      description: sp.feedSectionDesc,
      icon: Linkedin,
      items: [sp.monitorPosts, sp.teamReachMetrics],
    },
    {
      title: sp.settingsSection,
      description: sp.settingsSectionDesc,
      icon: Settings,
      items: [sp.companyBranding, sp.customHotTopics, sp.generalSettings],
    },
  ];
}

// ─── Reusable section grid ────────────────────────────────────
type TutorialSection = { title: string; description: string; icon: typeof BookOpen; items: string[] };
function TutorialGrid({ sections }: { sections: TutorialSection[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {sections.map((section) => (
        <Card key={section.title} className="opacity-80 hover:opacity-100 transition-opacity">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                <section.icon className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <CardTitle className="text-sm">{section.title}</CardTitle>
                <CardDescription className="text-xs">{section.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {section.items.map((item) => (
                <li key={item} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-purple-300 mt-0.5">●</span>
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────
type SuportePageContentProps = {
  role?: 'admin' | 'colaborador';
};

export function SuportePageContent({ role = 'colaborador' }: SuportePageContentProps) {
  const t = useT();
  const sp = t.supportPage;
  const isAdmin = role === 'admin';
  const colaboradorSections = getColaboradorSections(sp);
  const adminSections = getAdminSections(sp);

  return (
    <>
      <Header title={sp.title} />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        {/* Header banner */}
        <div className="rounded-xl bg-gradient-to-r from-purple-50 to-purple-100/50 border border-purple-200/50 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <BookOpen className="h-6 w-6 text-purple-600" />
                <h2 className="text-xl font-bold text-foreground">{sp.howToUse}</h2>
                <Badge variant="outline" className="text-[10px] border-purple-200 text-purple-600">
                  {sp.underConstruction}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground max-w-2xl">
                {sp.howToUseDescription}
              </p>
            </div>
            <SupportDialog pagina={sp.title} />
          </div>
        </div>

        {/* Admin sees both sections */}
        {isAdmin && (
          <>
            {/* Admin tutorials */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-purple-600" />
                <h3 className="font-semibold text-sm text-foreground">{sp.adminPanel}</h3>
                <Badge variant="secondary" className="text-[10px]">{t.roles.admin}</Badge>
              </div>
              <TutorialGrid sections={adminSections} />
            </div>

            {/* Collaborator tutorials — for admin reference */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-600" />
                <h3 className="font-semibold text-sm text-foreground">{sp.collaboratorView}</h3>
                <Badge variant="outline" className="text-[10px]">{t.roles.collaborator}</Badge>
              </div>
              <TutorialGrid sections={colaboradorSections} />
            </div>
          </>
        )}

        {/* Collaborator sees only their section */}
        {!isAdmin && (
          <TutorialGrid sections={colaboradorSections} />
        )}
      </main>
    </>
  );
}
