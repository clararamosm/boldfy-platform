'use client';

import { useState, useEffect } from 'react';
import { Header } from "@/components/dashboard/header";
import { Badge } from "@/components/ui/badge";
import { Loader2, BookOpen, User, Clock, Star, Headphones, Type, CheckCircle2, XCircle, Layers, Target, Heart, Zap, Timer } from "lucide-react";
import { useAuth } from '@/contexts/auth-context';
import { useT } from '@/lib/i18n/context';
import { getAuthToken } from '@/lib/auth-client';
import type { BrandManualData } from '@/app/actions/content-strategy';
import { cn } from '@/lib/utils';

// ─── Section wrapper ─────────────────────────────────────────
function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
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
          <h2 className="font-extrabold text-lg tracking-tight text-foreground">{title}</h2>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

// ─── Attribute card (reused in personality, mindset, language) ─
function AttrCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-muted/30 border border-border rounded-xl p-4 transition-all hover:border-primary/30 hover:-translate-y-0.5">
      <div className="flex items-center gap-2 mb-1">
        <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
        <span className="font-extrabold text-sm tracking-tight text-foreground">{title}</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed pl-3.5">{description}</p>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────
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
          <div className="bg-card border border-dashed border-border rounded-2xl py-16 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">{t.thoughtLeader.noManual}</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header title={t.thoughtLeader.manualTitle} />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-[1200px] mx-auto space-y-5">
          {/* Page title */}
          <div className="mb-2">
            <h1 className="font-extrabold text-2xl md:text-3xl tracking-tight text-foreground">
              Manual de Marca Pessoal
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Identidade, voz e diretrizes de comunicação que orientam toda a produção de conteúdo.
            </p>
          </div>

          {/* ─── PERSONALIDADE ──────────────────────────── */}
          {manual.personality && (
            <Section icon={User} title="Personalidade" description="Descrição geral e atributos que definem a marca pessoal.">
              {manual.personality.description && (
                <div className="bg-primary/5 border-l-[3px] border-l-primary rounded-r-lg px-4 py-3 mb-5">
                  <p className="text-sm leading-relaxed text-foreground italic">
                    {manual.personality.description}
                  </p>
                </div>
              )}
              {manual.personality.attributes && manual.personality.attributes.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {manual.personality.attributes.map((attr, i) => (
                    <AttrCard key={i} title={attr.title} description={attr.description} />
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* ─── MENTALIDADE ────────────────────────────── */}
          {manual.mindset && manual.mindset.length > 0 && (
            <Section icon={Clock} title="Mentalidade" description="Princípios e crenças que guiam a comunicação.">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {manual.mindset.map((item, i) => (
                  <AttrCard key={i} title={item.title} description={item.description} />
                ))}
              </div>
            </Section>
          )}

          {/* ─── ARQUÉTIPOS ─────────────────────────────── */}
          {manual.archetypes && (manual.archetypes.primary?.title || manual.archetypes.secondary?.title) && (
            <Section icon={Star} title="Arquétipos" description="Arquétipo primário e secundário da marca pessoal.">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {manual.archetypes.primary?.title && (
                  <div className="relative bg-primary/5 border border-primary/20 rounded-2xl p-5 pl-[76px] transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center h-12 w-12 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
                      <Star className="h-5 w-5" />
                    </div>
                    <span className="inline-block font-extrabold text-[9px] uppercase tracking-[0.14em] text-primary mb-1">
                      Primário
                    </span>
                    <h3 className="font-extrabold text-lg tracking-tight text-foreground mb-1">
                      {manual.archetypes.primary.title}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {manual.archetypes.primary.description}
                    </p>
                  </div>
                )}
                {manual.archetypes.secondary?.title && (
                  <div className="relative bg-muted/30 border border-border rounded-2xl p-5 pl-[76px] transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center h-12 w-12 rounded-xl bg-card border border-border text-primary">
                      <Layers className="h-5 w-5" />
                    </div>
                    <span className="inline-block font-extrabold text-[9px] uppercase tracking-[0.14em] text-primary mb-1">
                      Secundário
                    </span>
                    <h3 className="font-extrabold text-lg tracking-tight text-foreground mb-1">
                      {manual.archetypes.secondary.title}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {manual.archetypes.secondary.description}
                    </p>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* ─── TOM DE VOZ ─────────────────────────────── */}
          {manual.toneOfVoice && manual.toneOfVoice.length > 0 && (
            <Section icon={Headphones} title="Tom de Voz" description="Os tons que definem como a marca se comunica.">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {manual.toneOfVoice.map((tone, i) => (
                  <div
                    key={i}
                    className="bg-muted/30 border border-border rounded-xl p-4 transition-all hover:border-primary/30"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-sm tracking-tight text-foreground">{tone.title}</span>
                      {i === 0 && (
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          Principal
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{tone.description}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ─── LINGUAGEM E ESTILO ─────────────────────── */}
          {manual.languageStyle && manual.languageStyle.length > 0 && (
            <Section icon={Type} title="Linguagem e Estilo" description="Características de escrita e estilo de comunicação.">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {manual.languageStyle.map((style, i) => (
                  <AttrCard key={i} title={style.title} description={style.description} />
                ))}
              </div>
            </Section>
          )}

          {/* ─── BOAS PRÁTICAS ──────────────────────────── */}
          {manual.bestPractices && (manual.bestPractices.dos?.length > 0 || manual.bestPractices.donts?.length > 0) && (
            <Section icon={CheckCircle2} title="Boas Práticas" description="O que fazer e o que evitar na comunicação.">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Do's */}
                {manual.bestPractices.dos && manual.bestPractices.dos.length > 0 && (
                  <div className="bg-green-500/[0.04] border border-green-500/20 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-3 pb-3 border-b border-green-500/15">
                      <span className="flex items-center justify-center h-[22px] w-[22px] rounded-md bg-green-500 text-white">
                        <CheckCircle2 className="h-3 w-3" />
                      </span>
                      <span className="font-extrabold text-sm text-green-700 dark:text-green-400">Faça</span>
                    </div>
                    <ul className="space-y-2">
                      {manual.bestPractices.dos.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-foreground">
                          <span className="h-[5px] w-[5px] rounded-full bg-green-500 mt-[7px] shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {/* Don'ts */}
                {manual.bestPractices.donts && manual.bestPractices.donts.length > 0 && (
                  <div className="bg-muted/30 border border-muted-foreground/20 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border">
                      <span className="flex items-center justify-center h-[22px] w-[22px] rounded-md bg-muted-foreground text-white">
                        <XCircle className="h-3 w-3" />
                      </span>
                      <span className="font-extrabold text-sm text-muted-foreground">Não Faça</span>
                    </div>
                    <ul className="space-y-2">
                      {manual.bestPractices.donts.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-foreground">
                          <span className="h-[5px] w-[5px] rounded-full bg-muted-foreground mt-[7px] shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* ─── VOCABULÁRIO ────────────────────────────── */}
          {manual.vocabulary && (manual.vocabulary.keywords?.length > 0 || manual.vocabulary.expressions?.length > 0) && (
            <Section icon={BookOpen} title="Vocabulário" description="Palavras-chave e expressões características.">
              {manual.vocabulary.keywords && manual.vocabulary.keywords.length > 0 && (
                <div className="mb-5">
                  <span className="inline-block font-extrabold text-[10px] uppercase tracking-[0.14em] text-primary mb-3">
                    Palavras-chave
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {manual.vocabulary.keywords.map((kw, i) => (
                      <span
                        key={i}
                        className="inline-block text-sm font-semibold text-primary bg-primary/10 border border-primary/20 px-3.5 py-1.5 rounded-full transition-all hover:bg-primary hover:text-primary-foreground hover:border-primary hover:-translate-y-0.5"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {manual.vocabulary.expressions && manual.vocabulary.expressions.length > 0 && (
                <div>
                  <span className="inline-block font-extrabold text-[10px] uppercase tracking-[0.14em] text-primary mb-3">
                    Expressões Características
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {manual.vocabulary.expressions.map((expr, i) => (
                      <span
                        key={i}
                        className="inline-block text-sm font-semibold text-primary-foreground bg-foreground border border-foreground/80 px-3.5 py-1.5 rounded-full italic transition-all hover:opacity-80 hover:-translate-y-0.5"
                      >
                        &ldquo;{expr}&rdquo;
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* ─── RESUMO ESTRATÉGICO ─────────────────────── */}
          {manual.summary && (manual.summary.positioning || manual.summary.valueProposition || manual.summary.differential || manual.summary.mission) && (
            <Section icon={Layers} title="Resumo Estratégico" description="Síntese do posicionamento e diferenciais.">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {manual.summary.positioning && (
                  <SummaryCard icon={Target} label="Posicionamento" text={manual.summary.positioning} />
                )}
                {manual.summary.valueProposition && (
                  <SummaryCard icon={Heart} label="Proposta de Valor" text={manual.summary.valueProposition} />
                )}
                {manual.summary.differential && (
                  <SummaryCard icon={Zap} label="Diferencial" text={manual.summary.differential} />
                )}
                {manual.summary.mission && (
                  <SummaryCard icon={Timer} label="Missão" text={manual.summary.mission} />
                )}
              </div>
            </Section>
          )}
        </div>
      </main>
    </>
  );
}

// ─── Summary card ────────────────────────────────────────────
function SummaryCard({
  icon: Icon,
  label,
  text,
}: {
  icon: React.ElementType;
  label: string;
  text: string;
}) {
  return (
    <div className="relative bg-gradient-to-br from-card to-primary/[0.03] border border-border rounded-2xl p-5 pl-6 overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-primary/25">
      {/* Left accent bar */}
      <div className="absolute top-0 bottom-0 left-0 w-1 bg-gradient-to-b from-primary to-primary/60" />
      <div className="flex items-center gap-2 mb-2.5">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <span className="font-extrabold text-[10px] uppercase tracking-[0.14em] text-primary">
          {label}
        </span>
      </div>
      <p className="text-sm font-medium text-foreground leading-relaxed">
        {text}
      </p>
    </div>
  );
}
