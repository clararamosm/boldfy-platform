// src/app/colaborador/marca-pessoal/page.tsx
//
// Tela de Setup de Marca Pessoal v2 do colaborador (PR 1).
// Substitui a versao v1 que tinha 6 campos flat (voice, expertise, value,
// position, languageStyle, contentPillars).
//
// Organizada em 4 cards-bloco verticais que espelham o aprendizado das
// trilhas MP1, MP3, MP7, EC1, EC2:
//   1. Identidade basica         — cargo + expertise (sempre)
//   2. Discovery + Proposta      — MP1 + MP3
//   3. Voz (7 sliders)           — MP7
//   4. Estrategia (objetivo + pilares) — EC1 + EC2
//
// Migracao do schema antigo e LAZY: a leitura faz fallback v1→v2 via
// `resolvePersonalBrand`. Salvar a tela escreve sempre em v2 e migra o
// usuario automaticamente.
//
// Spec: source-of-truth/specs/colaborador-marca-pessoal-e-editor-de-conteudo.md §4

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Header } from '@/components/dashboard/header';
import { Button } from '@/components/ui/button';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Loader2, BookOpen, Plus, Trash2, Download } from 'lucide-react';
import { savePersonalBrand, previewWorkbookImport } from '@/app/actions/personal-brand';
import { resolvePersonalBrand } from '@/lib/personal-brand';
import {
  defaultPersonalBrandVoiceSliders,
  isBasicsFilled,
  isDiscoveryFilled,
  isVoiceFilled,
  isStrategyFilled,
  OBJECTIVE_LABELS,
  PERSONAL_BRAND_OBJECTIVES,
  type PersonalBrand,
  type PersonalBrandDiscovery,
  type PersonalBrandObjective,
  type PersonalBrandPillar,
  type PersonalBrandStrategy,
  type PersonalBrandVoice,
} from '@/types/personal-brand';
import { PILLAR_COLORS, type PillarColorKey, getPillarClasses } from '@/lib/pillar-colors';

// ──────────────────────────────────────────────────────────────────────────
// Estado local — espelha PersonalBrand v2 mas com discovery/voice/strategy
// sempre preenchidos pra simplificar binding de inputs. Na hora de salvar,
// removemos blocos vazios.
// ──────────────────────────────────────────────────────────────────────────

type FormState = {
  basics: { position: string; expertise: string };
  discovery: PersonalBrandDiscovery;
  voice: PersonalBrandVoice;
  strategy: PersonalBrandStrategy;
};

function emptyForm(): FormState {
  return {
    basics: { position: '', expertise: '' },
    discovery: {
      convergence: '',
      aspiration: '',
      surprise: '',
      startingPhrase: '',
      valueProposition: { who: '', problem: '', how: '', result: '' },
    },
    voice: {
      sliders: defaultPersonalBrandVoiceSliders(),
      keywords: [],
      avoidWords: [],
      description: '',
    },
    strategy: {
      primaryObjective: 'autoridade',
      secondaryObjectives: [],
      pillars: [],
    },
  };
}

function brandToForm(brand: PersonalBrand): FormState {
  const empty = emptyForm();
  return {
    basics: { ...empty.basics, ...brand.basics },
    discovery: brand.discovery ?? empty.discovery,
    voice: brand.voice
      ? {
          sliders: { ...empty.voice.sliders, ...brand.voice.sliders },
          keywords: brand.voice.keywords ?? [],
          avoidWords: brand.voice.avoidWords ?? [],
          description: brand.voice.description ?? '',
        }
      : empty.voice,
    strategy: brand.strategy ?? empty.strategy,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Sub-componente: BlockHeader com badge de estado
// ──────────────────────────────────────────────────────────────────────────

type BlockStatus = 'filled' | 'in-progress';

function BlockStatusBadge({ status }: { status: BlockStatus }) {
  return status === 'filled' ? (
    <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-white">
      Preenchido
    </Badge>
  ) : (
    <Badge variant="secondary">Em construcao</Badge>
  );
}

function TrilhaHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 p-3 text-sm text-muted-foreground flex items-start gap-2">
      <BookOpen className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="flex-1">
        {children}
        <div className="mt-1">
          <Link href="/colaborador/trilhas" className="text-primary hover:underline text-xs">
            Ver trilhas →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Sub-componente: linha de slider
// ──────────────────────────────────────────────────────────────────────────

type SliderRowProps = {
  label: string;
  leftLabel: string;
  rightLabel: string;
  value: number;
  onChange: (v: number) => void;
};

function SliderRow({ label, leftLabel, rightLabel, value, onChange }: SliderRowProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{value}/100</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={(v) => onChange(v[0] ?? 50)}
        min={0}
        max={100}
        step={1}
        className="py-1"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Sub-componente: editor de um pilar
// ──────────────────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

type PillarEditorProps = {
  pillar: PersonalBrandPillar;
  onChange: (p: PersonalBrandPillar) => void;
  onRemove: () => void;
};

function PillarEditor({ pillar, onChange, onRemove }: PillarEditorProps) {
  const classes = getPillarClasses(pillar.color);
  return (
    <Card className="border-l-4" style={{ borderLeftColor: 'currentColor' }}>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start gap-2">
          <Input
            value={pillar.name}
            onChange={(e) =>
              onChange({
                ...pillar,
                name: e.target.value,
                id: pillar.id || slugify(e.target.value) || `pilar-${Date.now()}`,
              })
            }
            placeholder="Nome do pilar (ex: Previsao de Receita)"
            maxLength={80}
            className="flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label="Remover pilar"
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
        <Textarea
          value={pillar.description}
          onChange={(e) => onChange({ ...pillar, description: e.target.value })}
          placeholder="Em 1 frase: o que esse pilar cobre"
          maxLength={300}
          rows={2}
        />
        <div className="flex items-center gap-3">
          <Label className="text-xs text-muted-foreground">Cor:</Label>
          <div className="flex gap-2">
            {PILLAR_COLORS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => onChange({ ...pillar, color: c.key })}
                aria-label={`Selecionar cor ${c.label}`}
                className={`w-7 h-7 rounded-full ${c.swatch} transition-all ${
                  pillar.color === c.key
                    ? 'ring-2 ring-offset-2 ring-primary scale-110'
                    : 'opacity-70 hover:opacity-100'
                }`}
              />
            ))}
          </div>
          <Badge className={`${classes.bg} ${classes.text} border-0 ml-auto`}>{pillar.name || 'Preview'}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Pagina
// ──────────────────────────────────────────────────────────────────────────

function FormSkeleton() {
  return (
    <div className="space-y-6">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-64 w-full" />
      ))}
    </div>
  );
}

export default function MarcaPessoalPage() {
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const userId = authUser?.uid ?? null;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  // PR 2: estado do import-workbook flow
  const [isImporting, setIsImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    discovery: Partial<FormState['discovery']>;
    foundCodes: string[];
    missingCodes: string[];
    notAnsweredCodes: string[];
  } | null>(null);

  const fetchData = useCallback(
    async (uid: string) => {
      try {
        setIsLoading(true);
        const snap = await getDoc(doc(db, 'users', uid));
        const data = snap.exists() ? snap.data() : {};
        const { brand } = resolvePersonalBrand(data);
        setForm(brandToForm(brand));
      } catch (error) {
        console.error('Error fetching personal brand:', error);
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar',
          description: 'Tente recarregar a pagina.',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (userId) void fetchData(userId);
  }, [userId, fetchData]);

  const handleSave = async () => {
    if (!userId) return;
    if (!isBasicsFilled(form.basics)) {
      toast({
        variant: 'destructive',
        title: 'Identidade basica obrigatoria',
        description: 'Preencha pelo menos cargo e expertise antes de salvar.',
      });
      return;
    }
    setIsSaving(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Sessao expirada. Faca login novamente.');

      // Monta o payload removendo blocos vazios.
      const payload = {
        basics: form.basics,
        ...(isDiscoveryFilled(form.discovery) && { discovery: form.discovery }),
        ...(isVoiceFilled(form.voice) && { voice: form.voice }),
        ...(isStrategyFilled(form.strategy) && { strategy: form.strategy }),
        source: 'manual' as const,
      };

      const result = await savePersonalBrand(idToken, userId, payload);
      if (!result.ok) {
        toast({ variant: 'destructive', title: 'Erro ao salvar', description: result.error });
        return;
      }
      toast({ title: 'Marca pessoal salva', description: 'Suas preferencias foram atualizadas.' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: errorMessage });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Pilar handlers ──
  const addPillar = () => {
    if (form.strategy.pillars.length >= 5) return;
    const usedColors = new Set(form.strategy.pillars.map((p) => p.color));
    const nextColor = (PILLAR_COLORS.find((c) => !usedColors.has(c.key))?.key ?? 'orange') as PillarColorKey;
    setForm({
      ...form,
      strategy: {
        ...form.strategy,
        pillars: [
          ...form.strategy.pillars,
          { id: `pilar-${Date.now()}`, name: '', description: '', color: nextColor },
        ],
      },
    });
  };
  const updatePillar = (idx: number, p: PersonalBrandPillar) => {
    const next = [...form.strategy.pillars];
    next[idx] = p;
    setForm({ ...form, strategy: { ...form.strategy, pillars: next } });
  };
  const removePillar = (idx: number) => {
    setForm({
      ...form,
      strategy: {
        ...form.strategy,
        pillars: form.strategy.pillars.filter((_, i) => i !== idx),
      },
    });
  };

  // ── PR 2: Import workbook ──
  const handleStartImport = async () => {
    if (!userId) return;
    setIsImporting(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('Sessao expirada. Faca login novamente.');
      const result = await previewWorkbookImport(idToken, userId);
      if (!result.ok) {
        toast({ variant: 'destructive', title: 'Erro ao importar', description: result.error });
        return;
      }
      const preview = result.preview;
      const hasAny =
        Object.keys(preview.discovery).length > 0 ||
        preview.trailsFound.length > 0;
      if (!hasAny) {
        toast({
          variant: 'default',
          title: 'Nada a importar',
          description:
            preview.trailsMissing.length > 0
              ? `As trilhas (${preview.trailsMissing.join(', ')}) ainda nao foram cadastradas pelo Master.`
              : 'Voce ainda nao respondeu as trilhas relevantes (MP01, MP03).',
        });
        return;
      }
      setImportPreview({
        discovery: preview.discovery,
        foundCodes: preview.trailsFound.map((t) => t.code),
        missingCodes: preview.trailsMissing,
        notAnsweredCodes: preview.trailsNotAnswered,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido.';
      toast({ variant: 'destructive', title: 'Erro ao importar', description: msg });
    } finally {
      setIsImporting(false);
    }
  };

  const handleConfirmImport = () => {
    if (!importPreview) return;
    const { discovery } = importPreview;
    // Aplica o preview por cima do estado atual. NAO salva — usuario
    // ainda precisa clicar "Salvar marca pessoal" pra commitar.
    setForm((current) => ({
      ...current,
      discovery: {
        convergence: discovery.convergence ?? current.discovery.convergence,
        aspiration: discovery.aspiration ?? current.discovery.aspiration,
        surprise: discovery.surprise ?? current.discovery.surprise,
        startingPhrase: discovery.startingPhrase ?? current.discovery.startingPhrase,
        valueProposition: discovery.valueProposition
          ? { ...current.discovery.valueProposition, ...discovery.valueProposition }
          : current.discovery.valueProposition,
      },
    }));
    setImportPreview(null);
    toast({
      title: 'Workbook importado',
      description: 'Revise os campos e clique em "Salvar marca pessoal" pra commitar.',
    });
  };

  // ── Objetivos secundarios ──
  const toggleSecondaryObjective = (obj: PersonalBrandObjective) => {
    const current = form.strategy.secondaryObjectives ?? [];
    if (current.includes(obj)) {
      setForm({
        ...form,
        strategy: { ...form.strategy, secondaryObjectives: current.filter((o) => o !== obj) },
      });
    } else if (current.length < 2 && obj !== form.strategy.primaryObjective) {
      setForm({
        ...form,
        strategy: { ...form.strategy, secondaryObjectives: [...current, obj] },
      });
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header title="Marca Pessoal" />
      <main className="flex-1 p-6 md:p-10">
        <div className="mx-auto max-w-4xl space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Marca Pessoal</h1>
            <p className="text-muted-foreground">
              Configure sua identidade em 4 blocos. A IA usa essas informacoes pra gerar conteudo que soa como voce.
            </p>
          </div>

          {isLoading ? (
            <FormSkeleton />
          ) : (
            <>
              {/* ── BLOCO 1 ─────────────────────────────────────────── */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>1. Identidade basica</CardTitle>
                      <CardDescription>O minimo pra IA saber quem esta escrevendo.</CardDescription>
                    </div>
                    <BlockStatusBadge status={isBasicsFilled(form.basics) ? 'filled' : 'in-progress'} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="position">Cargo</Label>
                    <Input
                      id="position"
                      placeholder="Ex: Head de Marketing, Consultora de Vendas, Diretor Comercial..."
                      value={form.basics.position}
                      onChange={(e) =>
                        setForm({ ...form, basics: { ...form.basics, position: e.target.value } })
                      }
                      maxLength={200}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expertise">Expertise</Label>
                    <Textarea
                      id="expertise"
                      placeholder="O que voce domina (1-2 frases). Ex: 'Vendas complexas pra fintechs B2B com ciclo longo'."
                      value={form.basics.expertise}
                      onChange={(e) =>
                        setForm({ ...form, basics: { ...form.basics, expertise: e.target.value } })
                      }
                      maxLength={1000}
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* ── BLOCO 2 ─────────────────────────────────────────── */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>2. Discovery e Proposta de Valor</CardTitle>
                      <CardDescription>Frase de partida (MP1) + Proposta de Valor estruturada (MP3).</CardDescription>
                    </div>
                    <BlockStatusBadge status={isDiscoveryFilled(form.discovery) ? 'filled' : 'in-progress'} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-start gap-3 flex-col md:flex-row md:items-center">
                    <TrilhaHint>
                      Essas perguntas ficam mais claras depois da trilha <strong>Discovery de Marca Pessoal</strong>.
                    </TrilhaHint>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleStartImport}
                      disabled={isImporting}
                      className="shrink-0"
                    >
                      {isImporting ? (
                        <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Lendo workbook</>
                      ) : (
                        <><Download className="w-3.5 h-3.5 mr-1.5" /> Importar do workbook</>
                      )}
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold">Frase de partida (MP1)</h3>
                    <div className="space-y-2">
                      <Label htmlFor="convergence">Como voce aparece hoje</Label>
                      <Textarea
                        id="convergence"
                        placeholder="O que as pessoas ja te associam — visivel e atual."
                        value={form.discovery.convergence}
                        onChange={(e) =>
                          setForm({ ...form, discovery: { ...form.discovery, convergence: e.target.value } })
                        }
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="aspiration">Como voce quer ser visto</Label>
                      <Textarea
                        id="aspiration"
                        placeholder="A imagem aspiracional que ainda nao alcancou."
                        value={form.discovery.aspiration}
                        onChange={(e) =>
                          setForm({ ...form, discovery: { ...form.discovery, aspiration: e.target.value } })
                        }
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="surprise">O que surpreendeu nas respostas externas</Label>
                      <Textarea
                        id="surprise"
                        placeholder="Algo que terceiros disseram sobre voce que voce nao esperava."
                        value={form.discovery.surprise}
                        onChange={(e) =>
                          setForm({ ...form, discovery: { ...form.discovery, surprise: e.target.value } })
                        }
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="startingPhrase">Frase composta (opcional)</Label>
                      <Textarea
                        id="startingPhrase"
                        placeholder="Frase livre que sintetiza os tres pontos acima."
                        value={form.discovery.startingPhrase}
                        onChange={(e) =>
                          setForm({ ...form, discovery: { ...form.discovery, startingPhrase: e.target.value } })
                        }
                        rows={2}
                      />
                    </div>
                  </div>

                  <div className="space-y-4 border-t pt-4">
                    <h3 className="text-sm font-semibold">Proposta de Valor estruturada (MP3)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="vp-who">Pra quem gera valor</Label>
                        <Input
                          id="vp-who"
                          placeholder="Ex: gestores de produto B2B"
                          value={form.discovery.valueProposition.who}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              discovery: {
                                ...form.discovery,
                                valueProposition: { ...form.discovery.valueProposition, who: e.target.value },
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vp-problem">Problema que resolve</Label>
                        <Input
                          id="vp-problem"
                          placeholder="Ex: o gap com o board"
                          value={form.discovery.valueProposition.problem}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              discovery: {
                                ...form.discovery,
                                valueProposition: { ...form.discovery.valueProposition, problem: e.target.value },
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vp-how">Como (o que torna o jeito diferente)</Label>
                        <Input
                          id="vp-how"
                          placeholder="Ex: documentacao narrativa"
                          value={form.discovery.valueProposition.how}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              discovery: {
                                ...form.discovery,
                                valueProposition: { ...form.discovery.valueProposition, how: e.target.value },
                              },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vp-result">Resultado/transformacao</Label>
                        <Input
                          id="vp-result"
                          placeholder="Ex: aprovacoes mais rapidas"
                          value={form.discovery.valueProposition.result}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              discovery: {
                                ...form.discovery,
                                valueProposition: { ...form.discovery.valueProposition, result: e.target.value },
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                    {form.discovery.valueProposition.who && form.discovery.valueProposition.problem && (
                      <p className="text-xs text-muted-foreground italic pt-2">
                        Preview: &ldquo;Eu ajudo {form.discovery.valueProposition.who} a resolver{' '}
                        {form.discovery.valueProposition.problem}
                        {form.discovery.valueProposition.how && ` atraves de ${form.discovery.valueProposition.how}`}
                        {form.discovery.valueProposition.result && `, gerando ${form.discovery.valueProposition.result}`}
                        .&rdquo;
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* ── BLOCO 3 ─────────────────────────────────────────── */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>3. Voz</CardTitle>
                      <CardDescription>Calibre os sliders pra IA encontrar o seu tom (MP7).</CardDescription>
                    </div>
                    <BlockStatusBadge status={isVoiceFilled(form.voice) ? 'filled' : 'in-progress'} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <SliderRow
                    label="Formalidade"
                    leftLabel="Formal"
                    rightLabel="Casual"
                    value={form.voice.sliders.formality}
                    onChange={(v) =>
                      setForm({ ...form, voice: { ...form.voice, sliders: { ...form.voice.sliders, formality: v } } })
                    }
                  />
                  <SliderRow
                    label="Tom"
                    leftLabel="Serio"
                    rightLabel="Divertido"
                    value={form.voice.sliders.tone}
                    onChange={(v) =>
                      setForm({ ...form, voice: { ...form.voice, sliders: { ...form.voice.sliders, tone: v } } })
                    }
                  />
                  <SliderRow
                    label="Complexidade"
                    leftLabel="Tecnico"
                    rightLabel="Acessivel"
                    value={form.voice.sliders.complexity}
                    onChange={(v) =>
                      setForm({ ...form, voice: { ...form.voice, sliders: { ...form.voice.sliders, complexity: v } } })
                    }
                  />
                  <SliderRow
                    label="Brevidade"
                    leftLabel="Direto"
                    rightLabel="Detalhado"
                    value={form.voice.sliders.brevity}
                    onChange={(v) =>
                      setForm({ ...form, voice: { ...form.voice, sliders: { ...form.voice.sliders, brevity: v } } })
                    }
                  />

                  <Accordion type="single" collapsible className="border-t pt-2">
                    <AccordionItem value="refinar" className="border-none">
                      <AccordionTrigger className="text-sm font-medium py-2">Refinar mais</AccordionTrigger>
                      <AccordionContent className="space-y-5 pt-3">
                        <SliderRow
                          label="Postura"
                          leftLabel="Contido"
                          rightLabel="Provocador"
                          value={form.voice.sliders.stance ?? 50}
                          onChange={(v) =>
                            setForm({ ...form, voice: { ...form.voice, sliders: { ...form.voice.sliders, stance: v } } })
                          }
                        />
                        <SliderRow
                          label="Registro"
                          leftLabel="Analitico"
                          rightLabel="Emocional"
                          value={form.voice.sliders.register ?? 50}
                          onChange={(v) =>
                            setForm({ ...form, voice: { ...form.voice, sliders: { ...form.voice.sliders, register: v } } })
                          }
                        />
                        <SliderRow
                          label="Perspectiva"
                          leftLabel="Cetico"
                          rightLabel="Otimista"
                          value={form.voice.sliders.outlook ?? 50}
                          onChange={(v) =>
                            setForm({ ...form, voice: { ...form.voice, sliders: { ...form.voice.sliders, outlook: v } } })
                          }
                        />

                        <div className="space-y-2 pt-2">
                          <Label htmlFor="keywords">Palavras-assinatura (opcional)</Label>
                          <Input
                            id="keywords"
                            placeholder="Separe por virgula. Ex: trade-off, sinal, jogada"
                            value={form.voice.keywords?.join(', ') ?? ''}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                voice: {
                                  ...form.voice,
                                  keywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20),
                                },
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="avoidWords">Palavras a evitar (opcional)</Label>
                          <Input
                            id="avoidWords"
                            placeholder="Separe por virgula. Ex: jornada, crucial, paradigma"
                            value={form.voice.avoidWords?.join(', ') ?? ''}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                voice: {
                                  ...form.voice,
                                  avoidWords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20),
                                },
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="voice-desc">Descricao livre (opcional)</Label>
                          <Textarea
                            id="voice-desc"
                            placeholder="1-2 frases pra calibrar a IA mais finamente."
                            value={form.voice.description ?? ''}
                            onChange={(e) =>
                              setForm({ ...form, voice: { ...form.voice, description: e.target.value } })
                            }
                            rows={2}
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>

              {/* ── BLOCO 4 ─────────────────────────────────────────── */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>4. Estrategia de Conteudo</CardTitle>
                      <CardDescription>Objetivo (EC1) e Pilares (EC2) do seu conteudo.</CardDescription>
                    </div>
                    <BlockStatusBadge status={isStrategyFilled(form.strategy) ? 'filled' : 'in-progress'} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <TrilhaHint>
                    Pilares ficam mais claros depois da trilha <strong>Estrategia de Conteudo</strong>.
                  </TrilhaHint>

                  <div className="space-y-2">
                    <Label htmlFor="primary-obj">Objetivo primario</Label>
                    <Select
                      value={form.strategy.primaryObjective}
                      onValueChange={(v) =>
                        setForm({
                          ...form,
                          strategy: { ...form.strategy, primaryObjective: v as PersonalBrandObjective },
                        })
                      }
                    >
                      <SelectTrigger id="primary-obj">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PERSONAL_BRAND_OBJECTIVES.map((obj) => (
                          <SelectItem key={obj} value={obj}>
                            {OBJECTIVE_LABELS[obj]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Objetivos secundarios (ate 2)</Label>
                    <div className="flex flex-wrap gap-2">
                      {PERSONAL_BRAND_OBJECTIVES.filter((o) => o !== form.strategy.primaryObjective).map((obj) => {
                        const selected = form.strategy.secondaryObjectives?.includes(obj) ?? false;
                        const disabled =
                          !selected && (form.strategy.secondaryObjectives?.length ?? 0) >= 2;
                        return (
                          <button
                            key={obj}
                            type="button"
                            onClick={() => toggleSecondaryObjective(obj)}
                            disabled={disabled}
                            className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                              selected
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background border-input hover:bg-accent'
                            } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                          >
                            {OBJECTIVE_LABELS[obj]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-3 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Pilares de conteudo</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          De 3 a 5 pilares. Cada um com nome curto, descricao em 1 frase e cor.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={addPillar}
                        disabled={form.strategy.pillars.length >= 5}
                      >
                        <Plus className="w-4 h-4 mr-1" /> Adicionar pilar
                      </Button>
                    </div>

                    {form.strategy.pillars.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">
                        Nenhum pilar definido. Adicione pelo menos 3 pra dar foco ao seu conteudo.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {form.strategy.pillars.map((p, idx) => (
                          <PillarEditor
                            key={p.id || idx}
                            pillar={p}
                            onChange={(np) => updatePillar(idx, np)}
                            onRemove={() => removePillar(idx)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* ── Acao final ──────────────────────────────────────── */}
              <div className="flex justify-end sticky bottom-4 z-10">
                <Button onClick={handleSave} disabled={isSaving} size="lg" className="shadow-lg">
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando
                    </>
                  ) : (
                    'Salvar marca pessoal'
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </main>

      {/* PR 2: dialogo de confirmacao do import-workbook */}
      <AlertDialog open={!!importPreview} onOpenChange={(o) => !o && setImportPreview(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Importar do workbook</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-left">
                <p>
                  Vamos sobrescrever os campos de Discovery e Proposta de Valor com o que voce respondeu
                  nas trilhas. Voce pode revisar e editar antes de salvar.
                </p>
                {importPreview && (
                  <>
                    {importPreview.foundCodes.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Lendo de: <strong>{importPreview.foundCodes.join(', ')}</strong>
                      </p>
                    )}
                    {importPreview.notAnsweredCodes.length > 0 && (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        Trilhas sem resposta sua: {importPreview.notAnsweredCodes.join(', ')}
                      </p>
                    )}
                    {importPreview.missingCodes.length > 0 && (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        Trilhas nao cadastradas pelo Master: {importPreview.missingCodes.join(', ')}
                      </p>
                    )}
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmImport}>Importar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
