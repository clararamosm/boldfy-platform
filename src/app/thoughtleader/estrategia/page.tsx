'use client';

import { useState, useEffect } from 'react';
import { Header } from "@/components/dashboard/header";
import { Loader2, FileText, Eye, Shield, Target, Layers, Zap, LayoutGrid, Crosshair } from "lucide-react";
import { useAuth } from '@/contexts/auth-context';
import { useT } from '@/lib/i18n/context';
import { getAuthToken } from '@/lib/auth-client';
import { getPillarClasses } from '@/lib/pillar-colors';
import type { ContentStrategyData } from '@/app/actions/content-strategy';
import type { LucideIcon } from 'lucide-react';

// ─── Visual helpers (same style as brand manual) ──────

function Section({ icon: Icon, title, description, children }: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center justify-center h-9 w-9 rounded-[10px] bg-primary/10 text-primary shrink-0">
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <div>
          <h2 className="font-extrabold text-lg tracking-tight">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Pill({ children, variant = 'primary' }: { children: React.ReactNode; variant?: 'primary' | 'muted' | 'dark' }) {
  const styles = {
    primary: 'text-primary bg-primary/10 border-primary/20',
    muted: 'text-foreground bg-muted/50 border-border',
    dark: 'text-primary-foreground bg-foreground border-foreground/80',
  };
  return (
    <span className={`inline-block text-sm font-semibold px-3.5 py-1.5 rounded-full border transition-all hover:-translate-y-0.5 ${styles[variant]}`}>
      {children}
    </span>
  );
}

const CT_CONFIG = {
  visibility: {
    icon: Eye,
    label: 'Visibilidade',
    tag: 'ToFu',
    accentColor: 'from-blue-500 to-blue-400',
    bgColor: 'bg-blue-500/[0.04]',
    borderColor: 'border-blue-500/20',
    badgeBg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    dotColor: 'bg-blue-500',
  },
  authority: {
    icon: Shield,
    label: 'Autoridade',
    tag: 'MoFu',
    accentColor: 'from-purple-500 to-purple-400',
    bgColor: 'bg-purple-500/[0.04]',
    borderColor: 'border-purple-500/20',
    badgeBg: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    dotColor: 'bg-purple-500',
  },
  conversion: {
    icon: Target,
    label: 'Conversão',
    tag: 'BoFu',
    accentColor: 'from-green-500 to-green-400',
    bgColor: 'bg-green-500/[0.04]',
    borderColor: 'border-green-500/20',
    badgeBg: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    dotColor: 'bg-green-500',
  },
} as const;

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
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">{t.thoughtLeader.noStrategy}</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header title={t.thoughtLeader.strategyTitle} />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-[1200px] mx-auto space-y-6">

          {/* ═══ Content Types ═══ */}
          {strategy.contentTypes && (
            <Section icon={LayoutGrid} title="Tipos de Conteúdo" description="Distribuição estratégica entre visibilidade, autoridade e conversão.">
              <div className="grid gap-4 md:grid-cols-3">
                {(['visibility', 'authority', 'conversion'] as const).map(key => {
                  const ct = strategy.contentTypes[key];
                  if (!ct) return null;
                  const cfg = CT_CONFIG[key];
                  const Icon = cfg.icon;
                  const hasFormats = ct.formats && ct.formats.filter(f => f).length > 0;
                  const hasTriggers = ct.triggers && ct.triggers.filter(t => t).length > 0;

                  return (
                    <div
                      key={key}
                      className={`relative ${cfg.bgColor} border ${cfg.borderColor} rounded-2xl p-5 overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md`}
                    >
                      {/* Left accent bar */}
                      <div className={`absolute top-0 bottom-0 left-0 w-1 bg-gradient-to-b ${cfg.accentColor}`} />

                      {/* Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`flex items-center justify-center h-7 w-7 rounded-lg ${cfg.badgeBg}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <span className="font-extrabold text-sm">{cfg.label}</span>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${cfg.badgeBg}`}>
                          {ct.percentage || 0}%
                        </span>
                      </div>

                      {/* Tag */}
                      <span className="inline-block text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-2">
                        {cfg.tag}
                      </span>

                      {/* Description */}
                      {ct.description && (
                        <p className="text-sm text-muted-foreground leading-relaxed mb-3">{ct.description}</p>
                      )}

                      {/* Formats */}
                      {hasFormats && (
                        <div className="mb-3">
                          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Formatos</span>
                          <div className="flex flex-col gap-1.5 mt-1.5">
                            {ct.formats!.filter(f => f).map((fmt, i) => (
                              <div key={i} className={`px-3 py-2 rounded-lg border text-xs leading-relaxed ${cfg.borderColor} ${cfg.bgColor}`}>
                                {fmt}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Triggers */}
                      {hasTriggers && (
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Gatilhos</span>
                          <div className="flex flex-col gap-1.5 mt-1.5">
                            {ct.triggers!.filter(t => t).map((trg, i) => (
                              <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30 text-xs leading-relaxed">
                                <Zap className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                                <span>{trg}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* ═══ Content Pillars ═══ */}
          {strategy.pillars && strategy.pillars.length > 0 && (
            <Section icon={Crosshair} title="Pilares de Conteúdo" description="Os pilares temáticos que guiam a criação de conteúdo.">
              <div className="grid gap-4 md:grid-cols-2">
                {strategy.pillars.map((pillar, i) => {
                  const colorClasses = getPillarClasses(pillar.color);
                  const hasExamples = pillar.contentExamples && pillar.contentExamples.filter(e => e).length > 0;
                  // Legacy fallback
                  const hasSeries = !hasExamples && pillar.series && pillar.series.length > 0;
                  const purpose = pillar.purpose || pillar.subtitle || '';

                  return (
                    <div
                      key={i}
                      className={`relative ${colorClasses.bg} border border-border rounded-2xl p-5 overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md`}
                    >
                      {/* Header with name */}
                      <div className="flex items-center gap-2.5 mb-3">
                        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${colorClasses.text.includes('orange') ? 'bg-orange-500' : colorClasses.text.includes('amber') ? 'bg-amber-400' : colorClasses.text.includes('green') ? 'bg-green-500' : colorClasses.text.includes('blue') ? 'bg-blue-500' : 'bg-primary'}`} />
                        <h3 className={`font-extrabold text-base ${colorClasses.text}`}>{pillar.name || 'Sem nome'}</h3>
                      </div>

                      {/* Purpose */}
                      {purpose && (
                        <p className="text-sm text-muted-foreground leading-relaxed mb-4 pl-5">{purpose}</p>
                      )}

                      {/* Objectives */}
                      {(pillar.audienceObjective || pillar.businessObjective) && (
                        <div className="grid grid-cols-1 gap-3 mb-4">
                          {pillar.audienceObjective && (
                            <div className="bg-card/50 border border-border rounded-xl p-3 transition-all hover:border-primary/30">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                                <span className="font-extrabold text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Objetivo da Audiência</span>
                              </div>
                              <p className="text-sm pl-3.5 leading-relaxed">{pillar.audienceObjective}</p>
                            </div>
                          )}
                          {pillar.businessObjective && (
                            <div className="bg-card/50 border border-border rounded-xl p-3 transition-all hover:border-primary/30">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                                <span className="font-extrabold text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Objetivo de Negócio</span>
                              </div>
                              <p className="text-sm pl-3.5 leading-relaxed">{pillar.businessObjective}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Content Examples as pills */}
                      {hasExamples && (
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-2 block pl-5">Tipos de Conteúdo</span>
                          <div className="flex flex-wrap gap-1.5 pl-5">
                            {pillar.contentExamples!.filter(e => e).map((ex, j) => (
                              <Pill key={j} variant="muted">{ex}</Pill>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Legacy series fallback */}
                      {hasSeries && (
                        <div className="space-y-2 pl-5">
                          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-1 block">Séries</span>
                          {pillar.series!.map((serie, j) => (
                            <div key={j} className="border-l-2 border-primary/20 pl-3">
                              <p className="text-xs font-semibold">{serie.name}</p>
                              <p className="text-xs text-muted-foreground">{serie.objective}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* ═══ Legacy: Messaging & Positioning ═══ */}
          {strategy.messaging && (strategy.messaging.enemy || strategy.messaging.positioning || strategy.messaging.pointOfView) && (
            <Section icon={Crosshair} title="Mensagens e Posicionamento">
              <div className="grid gap-3 md:grid-cols-3">
                {strategy.messaging.enemy && (
                  <div className="bg-muted/30 border border-border rounded-xl p-4 transition-all hover:border-primary/30 hover:-translate-y-0.5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      <span className="font-extrabold text-sm">Arqui-inimigo</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed pl-3.5">{strategy.messaging.enemy}</p>
                  </div>
                )}
                {strategy.messaging.positioning && (
                  <div className="bg-muted/30 border border-border rounded-xl p-4 transition-all hover:border-primary/30 hover:-translate-y-0.5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      <span className="font-extrabold text-sm">Posicionamento</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed pl-3.5">{strategy.messaging.positioning}</p>
                  </div>
                )}
                {strategy.messaging.pointOfView && (
                  <div className="bg-muted/30 border border-border rounded-xl p-4 transition-all hover:border-primary/30 hover:-translate-y-0.5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      <span className="font-extrabold text-sm">Ponto de Vista</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed pl-3.5">{strategy.messaging.pointOfView}</p>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* ═══ Legacy: Narrative ═══ */}
          {strategy.narrative && (
            <Section icon={FileText} title="Narrativa Central">
              <div className="bg-primary/5 border-l-[3px] border-l-primary px-4 py-3 rounded-r-lg">
                <p className="text-sm italic leading-relaxed">{strategy.narrative}</p>
              </div>
            </Section>
          )}

          {/* ═══ Legacy: Pains + Solutions ═══ */}
          {((strategy.pains && strategy.pains.length > 0) || (strategy.solutions && strategy.solutions.length > 0)) && (
            <div className="grid gap-4 md:grid-cols-2">
              {strategy.pains && strategy.pains.length > 0 && (
                <Section icon={Zap} title="Dores">
                  <div className="space-y-2">
                    {strategy.pains.map((pain, i) => (
                      <div key={i} className="bg-muted/30 border border-border rounded-xl p-4 transition-all hover:border-primary/30 hover:-translate-y-0.5">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                          <span className="font-extrabold text-sm">{pain.title}</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed pl-3.5">{pain.description}</p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
              {strategy.solutions && strategy.solutions.length > 0 && (
                <Section icon={Target} title="Soluções">
                  <div className="space-y-2">
                    {strategy.solutions.map((sol, i) => (
                      <div key={i} className="bg-muted/30 border border-border rounded-xl p-4 transition-all hover:border-primary/30 hover:-translate-y-0.5">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                          <span className="font-extrabold text-sm">{sol.title}</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed pl-3.5">{sol.description}</p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </div>
          )}

        </div>
      </main>
    </>
  );
}
