'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Header } from '@/components/dashboard/header';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Sparkles, CheckSquare } from 'lucide-react';
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
    gapAnalysis: '',
    generatedAt: '',
  };
}

function parseGapAnalysis(text: string): string[] {
  if (!text) return [];
  const numbered = text.split(/\n?\d+\.\s+/).filter(Boolean);
  if (numbered.length > 1) return numbered.map((s) => s.trim());
  return text.split(/\n{1,2}/).map((s) => s.trim()).filter(Boolean);
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

  const activeSuggestions: LinkedInProfileSuggestions = (profile.edited || profile.suggestions)!;
  const gapItems = parseGapAnalysis(activeSuggestions.gapAnalysis);

  return (
    <>
      <Header title="Meu Perfil LinkedIn" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* Instrução */}
          <div className="rounded-lg bg-violet-50 border border-violet-200 p-4 text-sm text-violet-800">
            <p className="font-semibold mb-1">Como usar este guia</p>
            <p>
              Veja abaixo como era seu perfil <strong>antes</strong> e como ficará <strong>depois</strong> da otimização.
              Use os botões <strong>Copiar</strong> para colar cada seção diretamente no LinkedIn.
            </p>
          </div>

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
                  readOnly={false}
                />
              </div>
            </div>
          </div>

          {/* Gap analysis em checklist */}
          {gapItems.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <CheckSquare className="h-3.5 w-3.5 text-amber-700" />
                <p className="text-sm font-semibold text-amber-800">O que foi ajustado no seu perfil</p>
              </div>
              <ul className="space-y-1.5">
                {gapItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                    <span className="shrink-0 mt-0.5 h-4 w-4 rounded border border-amber-400 bg-white flex items-center justify-center text-amber-500 font-bold text-[10px]">
                      {i + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
