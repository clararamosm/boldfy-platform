'use client';

import { useState, useEffect } from 'react';
import { Header } from "@/components/dashboard/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText } from "lucide-react";
import { useAuth } from '@/contexts/auth-context';
import { useT } from '@/lib/i18n/context';
import { getAuthToken } from '@/lib/auth-client';
import type { ContentStrategyData } from '@/app/actions/content-strategy';

export default function ThoughtLeaderEstrategiaPage() {
  const { user } = useAuth();
  const t = useT();
  const [strategy, setStrategy] = useState<ContentStrategyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;

    const fetchStrategy = async () => {
      setIsLoading(true);
      try {
        const token = await getAuthToken();
        const { getContentStrategy } = await import('@/app/actions/content-strategy');
        const result = await getContentStrategy(token, user.uid);
        if (result.data) {
          setStrategy(result.data);
        }
      } catch (error) {
        console.error('Error fetching strategy:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStrategy();
  }, [user?.uid]);

  if (isLoading) {
    return (
      <>
        <Header title={t.thoughtLeader.strategyTitle} />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </main>
      </>
    );
  }

  if (!strategy) {
    return (
      <>
        <Header title={t.thoughtLeader.strategyTitle} />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">{t.thoughtLeader.noStrategy}</p>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <Header title={t.thoughtLeader.strategyTitle} />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        {/* Content Types */}
        {strategy.contentTypes && (
          <div>
            <h3 className="text-lg font-semibold mb-3">Tipos de Conteúdo</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Visibilidade (ToFu)</CardTitle>
                  <Badge variant="outline">{strategy.contentTypes.visibility?.percentage || 0}%</Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{strategy.contentTypes.visibility?.description || ''}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Autoridade (MoFu)</CardTitle>
                  <Badge variant="outline">{strategy.contentTypes.authority?.percentage || 0}%</Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{strategy.contentTypes.authority?.description || ''}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Conversão (BoFu)</CardTitle>
                  <Badge variant="outline">{strategy.contentTypes.conversion?.percentage || 0}%</Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{strategy.contentTypes.conversion?.description || ''}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Messaging & Positioning */}
        {strategy.messaging && (strategy.messaging.enemy || strategy.messaging.positioning || strategy.messaging.pointOfView) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mensagens e Posicionamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {strategy.messaging.enemy && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase">Arqui-inimigo</p>
                  <p className="text-sm">{strategy.messaging.enemy}</p>
                </div>
              )}
              {strategy.messaging.positioning && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase">Posicionamento</p>
                  <p className="text-sm">{strategy.messaging.positioning}</p>
                </div>
              )}
              {strategy.messaging.pointOfView && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase">Ponto de Vista</p>
                  <p className="text-sm">{strategy.messaging.pointOfView}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Central Narrative */}
        {strategy.narrative && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Narrativa Central</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{strategy.narrative}</p>
            </CardContent>
          </Card>
        )}

        {/* Pain Points */}
        {strategy.pains && strategy.pains.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {strategy.pains.map((pain, i) => (
                <div key={i}>
                  <p className="text-sm font-medium">{pain.title}</p>
                  <p className="text-sm text-muted-foreground">{pain.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Solutions */}
        {strategy.solutions && strategy.solutions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Soluções</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {strategy.solutions.map((sol, i) => (
                <div key={i}>
                  <p className="text-sm font-medium">{sol.title}</p>
                  <p className="text-sm text-muted-foreground">{sol.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Content Pillars */}
        {strategy.pillars && strategy.pillars.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3">Pilares de Conteúdo</h3>
            <div className="grid gap-4 md:grid-cols-3">
              {strategy.pillars.map((pillar, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{pillar.name}</CardTitle>
                    <CardDescription>{pillar.subtitle}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {pillar.series && pillar.series.length > 0 && (
                      <div className="space-y-2">
                        {pillar.series.map((serie, j) => (
                          <div key={j} className="border-l-2 border-primary/20 pl-2">
                            <p className="text-xs font-medium">{serie.name}</p>
                            <p className="text-xs text-muted-foreground">{serie.objective}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
