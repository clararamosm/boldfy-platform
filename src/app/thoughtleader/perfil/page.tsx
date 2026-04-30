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
import type { LinkedInProfileOptimization, LinkedInProfileSuggestions } from '@/lib/linkedin-analytics-types';

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

  // Usar edited se existir, senão suggestions
  const activeSuggestions: LinkedInProfileSuggestions = (profile.edited || profile.suggestions)!;

  return (
    <>
      <Header title="Meu Perfil LinkedIn" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Score simplificado para o TL */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="font-semibold text-sm">Score de Alinhamento 360Brew</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Avalia o quanto o seu perfil está alinhado ao algoritmo do LinkedIn em 2026
                </p>
              </div>
              <AlignmentScoreBadge
                alignment={activeSuggestions.semanticAlignment}
                showIssues={false}
                compact
              />
            </div>
            <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={
                  activeSuggestions.semanticAlignment.score >= 70
                    ? 'h-full rounded-full bg-green-500 transition-all'
                    : activeSuggestions.semanticAlignment.score >= 40
                      ? 'h-full rounded-full bg-yellow-500 transition-all'
                      : 'h-full rounded-full bg-red-500 transition-all'
                }
                style={{ width: `${activeSuggestions.semanticAlignment.score}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {activeSuggestions.semanticAlignment.passesAudit
                ? '✓ Seu perfil passa na auditoria do algoritmo — distribuição desbloqueada.'
                : '⚠ Seu perfil ainda não passa na auditoria. Siga as sugestões abaixo para melhorar.'}
            </p>
          </div>

          {/* Instrução */}
          <div className="rounded-lg bg-violet-50 border border-violet-200 p-4 text-sm text-violet-800">
            <p className="font-semibold mb-1">Como usar este guia</p>
            <p>
              Abaixo você encontra todas as sugestões de otimização para o seu perfil LinkedIn.
              Use os botões <strong>Copiar</strong> para copiar cada seção e colar diretamente no LinkedIn.
            </p>
          </div>

          {/* Mockup do perfil */}
          <ProfilePreview
            suggestions={activeSuggestions}
            tlName={userName}
            tlAvatarUrl={userAvatar}
            readOnly={false}
          />

          {/* Gap analysis (simplificado) */}
          {activeSuggestions.gapAnalysis && (
            <div className="rounded-lg border bg-amber-50 border-amber-200 p-4">
              <p className="text-sm font-semibold text-amber-800 mb-1">O que precisava ser ajustado</p>
              <p className="text-sm text-amber-700 whitespace-pre-line">{activeSuggestions.gapAnalysis}</p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
