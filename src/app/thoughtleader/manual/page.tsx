'use client';

import { useState, useEffect } from 'react';
import { Header } from "@/components/dashboard/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, BookOpen } from "lucide-react";
import { useAuth } from '@/contexts/auth-context';
import { useT } from '@/lib/i18n/context';
import { getAuthToken } from '@/lib/auth-client';
import type { BrandManualData } from '@/app/actions/content-strategy';

export default function ThoughtLeaderManualPage() {
  const { user } = useAuth();
  const t = useT();
  const [manual, setManual] = useState<BrandManualData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;

    const fetchManual = async () => {
      setIsLoading(true);
      try {
        const token = await getAuthToken();
        const { getBrandManual } = await import('@/app/actions/content-strategy');
        const result = await getBrandManual(token, user.uid);
        if (result.data) {
          setManual(result.data);
        }
      } catch (error) {
        console.error('Error fetching brand manual:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchManual();
  }, [user?.uid]);

  if (isLoading) {
    return (
      <>
        <Header title={t.thoughtLeader.manualTitle} />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </main>
      </>
    );
  }

  if (!manual) {
    return (
      <>
        <Header title={t.thoughtLeader.manualTitle} />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">{t.thoughtLeader.noManual}</p>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <Header title={t.thoughtLeader.manualTitle} />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        {/* Personality */}
        {manual.personality && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personalidade</CardTitle>
              {manual.personality.description && (
                <CardDescription>{manual.personality.description}</CardDescription>
              )}
            </CardHeader>
            {manual.personality.attributes && manual.personality.attributes.length > 0 && (
              <CardContent className="space-y-2">
                {manual.personality.attributes.map((attr, i) => (
                  <div key={i}>
                    <p className="text-sm font-medium">{attr.title}</p>
                    <p className="text-sm text-muted-foreground">{attr.description}</p>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        )}

        {/* Mindset */}
        {manual.mindset && manual.mindset.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mentalidade</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {manual.mindset.map((item, i) => (
                <div key={i}>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Archetypes */}
        {manual.archetypes && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Arquétipos</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {manual.archetypes.primary?.title && (
                <div className="p-3 rounded-lg border">
                  <Badge className="mb-2">Principal</Badge>
                  <p className="text-sm font-medium">{manual.archetypes.primary.title}</p>
                  <p className="text-sm text-muted-foreground">{manual.archetypes.primary.description}</p>
                </div>
              )}
              {manual.archetypes.secondary?.title && (
                <div className="p-3 rounded-lg border">
                  <Badge variant="secondary" className="mb-2">Secundário</Badge>
                  <p className="text-sm font-medium">{manual.archetypes.secondary.title}</p>
                  <p className="text-sm text-muted-foreground">{manual.archetypes.secondary.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tone of Voice */}
        {manual.toneOfVoice && manual.toneOfVoice.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tom de Voz</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {manual.toneOfVoice.map((tone, i) => (
                <div key={i} className="p-3 rounded-lg border">
                  <p className="text-sm font-medium">{tone.title}</p>
                  <p className="text-xs text-muted-foreground">{tone.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Language & Style */}
        {manual.languageStyle && manual.languageStyle.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Linguagem e Estilo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {manual.languageStyle.map((style, i) => (
                <div key={i}>
                  <p className="text-sm font-medium">{style.title}</p>
                  <p className="text-sm text-muted-foreground">{style.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Do's & Don'ts */}
        {manual.bestPractices && (manual.bestPractices.dos?.length > 0 || manual.bestPractices.donts?.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Boas Práticas</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {manual.bestPractices.dos && manual.bestPractices.dos.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-green-600 mb-2">✓ Faça</p>
                  <ul className="space-y-1">
                    {manual.bestPractices.dos.map((item, i) => (
                      <li key={i} className="text-sm text-muted-foreground">• {item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {manual.bestPractices.donts && manual.bestPractices.donts.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-red-600 mb-2">✗ Não Faça</p>
                  <ul className="space-y-1">
                    {manual.bestPractices.donts.map((item, i) => (
                      <li key={i} className="text-sm text-muted-foreground">• {item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Vocabulary */}
        {manual.vocabulary && (manual.vocabulary.keywords?.length > 0 || manual.vocabulary.expressions?.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vocabulário</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {manual.vocabulary.keywords && manual.vocabulary.keywords.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Palavras-chave</p>
                  <div className="flex flex-wrap gap-1.5">
                    {manual.vocabulary.keywords.map((kw, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{kw}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {manual.vocabulary.expressions && manual.vocabulary.expressions.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Expressões</p>
                  <ul className="space-y-1">
                    {manual.vocabulary.expressions.map((expr, i) => (
                      <li key={i} className="text-sm italic">&ldquo;{expr}&rdquo;</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Summary */}
        {manual.summary && (manual.summary.positioning || manual.summary.valueProposition || manual.summary.differential || manual.summary.mission) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {manual.summary.positioning && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase">Posicionamento</p>
                  <p className="text-sm">{manual.summary.positioning}</p>
                </div>
              )}
              {manual.summary.valueProposition && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase">Proposta de Valor</p>
                  <p className="text-sm">{manual.summary.valueProposition}</p>
                </div>
              )}
              {manual.summary.differential && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase">Diferencial</p>
                  <p className="text-sm">{manual.summary.differential}</p>
                </div>
              )}
              {manual.summary.mission && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase">Missão</p>
                  <p className="text-sm">{manual.summary.mission}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}
