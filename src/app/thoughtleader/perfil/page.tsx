'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Header } from '@/components/dashboard/header';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Sparkles } from 'lucide-react';
import { getAuthToken } from '@/lib/auth-client';
import { getLinkedInProfile } from '@/app/actions/profile-optimizer';
import { ProfilePreview } from '@/components/profile-optimizer/profile-preview';
import { AlignmentScoreBadge } from '@/components/profile-optimizer/alignment-score-badge';
import type {
  LinkedInProfileOptimization,
  LinkedInProfileSuggestions,
  LinkedInProfileCurrent,
} from '@/lib/linkedin-analytics-types';
import { cn } from '@/lib/utils';

// Converte o perfil atual em um objeto que ProfilePreview consegue renderizar
function currentToSuggestions(current: LinkedInProfileCurrent): LinkedInProfileSuggestions {
  return {
    headline: current.headline,
    about: current.about,
    topSkills: current.topSkills,
    experiences: current.experiences.map((e) => ({
      ...e,
      action: 'keep' as const,
      rewrittenDescription: undefined,
    })),
    featuredItems: current.featuredItems.map((f) => ({
      ...f,
      action: 'keep' as const,
      rationale: '',
    })),
    semanticAlignment: { score: 0, passesAudit: false, issues: [] },
    editedAt: '',
  };
}

export default function ThoughtLeaderPerfilPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<LinkedInProfileOptimization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    const load = async () => {
      setLoading(true);
      try {
        const token = await getAuthToken();
        const result = await getLinkedInProfile(token, user.uid);
        if (result.profile) setProfile(result.profile);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.uid]);

  if (loading) {
    return (
      <>
        <Header title="Meu Perfil LinkedIn" />
        <main className="flex-1 overflow-auto p-4 md:p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </main>
      </>
    );
  }

  const userName = user?.profile?.name || user?.name || user?.email?.split('@')[0] || '';
  const userAvatar = user?.profile?.avatarUrl || undefined;

  // Sem publicação ainda
  if (!profile || profile.status !== 'published') {
    return (
      <>
        <Header title="Meu Perfil LinkedIn" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="max-w-xl mx-auto mt-8">
            <Card>
              <CardContent className="py-14 flex flex-col items-center text-center gap-4">
                <div className="h-16 w-16 rounded-full bg-violet-50 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-violet-500" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold mb-1">Perfil em preparação</h2>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Seu time de estratégia está preparando as sugestões de otimização do seu perfil LinkedIn.
                    Em breve você terá um guia completo aqui.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </>
    );
  }

  const activeSuggestions: LinkedInProfileSuggestions = profile.edited!;

  return (
    <>
      <Header title="Meu Perfil LinkedIn" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* Instrução */}
          <div className="rounded-lg bg-violet-50 border border-violet-200 p-4 text-sm text-violet-800">
            <p className="font-semibold mb-1">Como usar este guia</p>
            <p>
              Veja como era seu perfil <strong>antes</strong> e como ficará <strong>depois</strong> da otimização.
              Use os botões <strong>Copiar</strong> para colar cada seção diretamente no LinkedIn.
            </p>
          </div>

          {/* Score antes/depois — só exibe quando score do depois foi gerado */}
          {profile.currentAlignment && activeSuggestions.semanticAlignment?.score > 0 && (
            <div className="rounded-lg border bg-gray-50 p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Score 360Brew — Antes vs. Depois
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Perfil atual</p>
                  <AlignmentScoreBadge alignment={profile.currentAlignment} showIssues={false} compact />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-violet-600 font-medium">Perfil otimizado</p>
                  <AlignmentScoreBadge alignment={activeSuggestions.semanticAlignment} showIssues={false} compact />
                </div>
              </div>
            </div>
          )}

          {/* Comparativo lado a lado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

            {/* ANTES — perfil atual em cinza */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Antes
                </span>
                <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">Perfil atual</span>
              </div>
              {profile.current ? (
                <div className="opacity-70 grayscale">
                  <ProfilePreview
                    suggestions={currentToSuggestions(profile.current)}
                    tlName={userName}
                    tlAvatarUrl={userAvatar}
                    profileAvatarUrl={profile.avatarUrl ?? undefined}
                    profileBannerUrl={profile.bannerUrl ?? undefined}
                    readOnly={true}
                    variant="before"
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-dashed bg-gray-50 p-8 text-center text-sm text-muted-foreground">
                  Perfil original não disponível
                </div>
              )}
            </div>

            {/* DEPOIS — perfil otimizado com borda roxa */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-violet-600 uppercase tracking-wide">
                  Depois
                </span>
                <span className="text-xs bg-violet-50 text-violet-700 border border-violet-200 rounded-full px-2 py-0.5">
                  Otimizado
                </span>
                <AlignmentScoreBadge
                  alignment={activeSuggestions.semanticAlignment}
                  showIssues={false}
                  compact
                />
              </div>
              <div className="ring-2 ring-violet-500 ring-offset-2 rounded-xl">
                <ProfilePreview
                  suggestions={activeSuggestions}
                  tlName={userName}
                  tlAvatarUrl={userAvatar}
                  profileAvatarUrl={profile.avatarUrl ?? undefined}
                  profileBannerUrl={profile.bannerUrl ?? undefined}
                  readOnly={false}
                />
              </div>
            </div>
          </div>

        </div>
      </main>
    </>
  );
}
