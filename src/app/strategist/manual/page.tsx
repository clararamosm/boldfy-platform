// src/app/strategist/manual/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/dashboard/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { getAuthToken } from '@/lib/auth-client';
import { getBrandManual, saveBrandManual, type BrandManualData } from '@/app/actions/content-strategy';
import { Loader2, Plus, X, User } from 'lucide-react';
import { BrandManualImporter } from '@/components/brand-manual-importer';

// ─── Helpers ──────

function emptyManual(): BrandManualData {
  return {
    personality: { description: '', attributes: [{ title: '', description: '' }] },
    mindset: [{ title: '', description: '' }],
    archetypes: {
      primary: { title: '', description: '' },
      secondary: { title: '', description: '' },
    },
    toneOfVoice: [{ title: '', description: '' }],
    languageStyle: [{ title: '', description: '' }],
    bestPractices: { dos: [''], donts: [''] },
    vocabulary: { keywords: [''], expressions: [''] },
    summary: { positioning: '', valueProposition: '', differential: '', mission: '' },
  };
}

export default function StrategistManualPage() {
  const searchParams = useSearchParams();
  const companySlug = searchParams.get('c');
  const tlSlug = searchParams.get('tl');
  const { toast } = useToast();

  // Resolved Firestore IDs
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [tlId, setTlId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [tlName, setTlName] = useState('');
  const [data, setData] = useState<BrandManualData>(emptyManual());

  // Resolve slugs
  useEffect(() => {
    if (!companySlug || !tlSlug) return;
    const resolve = async () => {
      try {
        const token = await getAuthToken();
        const { resolveSlugs } = await import('@/app/actions/content-pipeline');
        const result = await resolveSlugs(token, companySlug, tlSlug);
        if (result.companyId) setCompanyId(result.companyId);
        if (result.tlId) setTlId(result.tlId);
        if (result.tlName) setTlName(result.tlName);
      } catch {
        // silent
      }
    };
    resolve();
  }, [companySlug, tlSlug]);

  const fetchData = useCallback(async () => {
    if (!tlId) return;
    setIsLoading(true);
    try {
      const token = await getAuthToken();

      const result = await getBrandManual(token, tlId);
      if (result.data) {
        // Merge with defaults so all fields exist
        setData({ ...emptyManual(), ...result.data });
      } else if (result.error) {
        toast({ variant: 'destructive', title: 'Erro', description: result.error });
      }
    } catch (err) {
      console.error('Error loading brand manual:', err);
      toast({ variant: 'destructive', title: 'Erro ao carregar manual.' });
    } finally {
      setIsLoading(false);
    }
  }, [tlId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    if (!tlId) return;
    setIsSaving(true);
    try {
      // Force-refresh token to avoid expiry after long form editing
      const token = await getAuthToken();
      // Clean empty items
      const clean: BrandManualData = {
        ...data,
        personality: {
          description: data.personality.description,
          attributes: data.personality.attributes.filter(a => a.title || a.description),
        },
        mindset: data.mindset.filter(m => m.title || m.description),
        toneOfVoice: data.toneOfVoice.filter(t => t.title || t.description),
        languageStyle: data.languageStyle.filter(l => l.title || l.description),
        bestPractices: {
          dos: data.bestPractices.dos.filter(Boolean),
          donts: data.bestPractices.donts.filter(Boolean),
        },
        vocabulary: {
          keywords: data.vocabulary.keywords.filter(Boolean),
          expressions: data.vocabulary.expressions.filter(Boolean),
        },
      };
      const result = await saveBrandManual(token, tlId, clean);
      if (result.success) {
        toast({ title: 'Manual de Marca salvo com sucesso!' });
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: result.error });
      }
    } catch (err: unknown) {
      console.error('Error saving brand manual:', err);
      const msg = err instanceof Error ? err.message : 'Erro desconhecido ao salvar.';
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: msg });
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Import handler ──────

  const handleImport = (imported: Partial<BrandManualData>) => {
    setData(prev => {
      const merged = { ...prev };
      if (imported.personality) {
        merged.personality = {
          description: imported.personality.description || prev.personality.description,
          attributes: imported.personality.attributes?.length
            ? imported.personality.attributes
            : prev.personality.attributes,
        };
      }
      if (imported.mindset?.length) merged.mindset = imported.mindset;
      if (imported.archetypes) {
        merged.archetypes = {
          primary: {
            title: imported.archetypes.primary.title || prev.archetypes.primary.title,
            description: imported.archetypes.primary.description || prev.archetypes.primary.description,
          },
          secondary: {
            title: imported.archetypes.secondary.title || prev.archetypes.secondary.title,
            description: imported.archetypes.secondary.description || prev.archetypes.secondary.description,
          },
        };
      }
      if (imported.toneOfVoice?.length) merged.toneOfVoice = imported.toneOfVoice;
      if (imported.languageStyle?.length) merged.languageStyle = imported.languageStyle;
      if (imported.bestPractices) {
        merged.bestPractices = {
          dos: imported.bestPractices.dos.length > 0 && imported.bestPractices.dos[0]
            ? imported.bestPractices.dos
            : prev.bestPractices.dos,
          donts: imported.bestPractices.donts.length > 0 && imported.bestPractices.donts[0]
            ? imported.bestPractices.donts
            : prev.bestPractices.donts,
        };
      }
      if (imported.vocabulary) {
        merged.vocabulary = {
          keywords: imported.vocabulary.keywords.length > 0 && imported.vocabulary.keywords[0]
            ? imported.vocabulary.keywords
            : prev.vocabulary.keywords,
          expressions: imported.vocabulary.expressions.length > 0 && imported.vocabulary.expressions[0]
            ? imported.vocabulary.expressions
            : prev.vocabulary.expressions,
        };
      }
      if (imported.summary) {
        merged.summary = {
          positioning: imported.summary.positioning || prev.summary.positioning,
          valueProposition: imported.summary.valueProposition || prev.summary.valueProposition,
          differential: imported.summary.differential || prev.summary.differential,
          mission: imported.summary.mission || prev.summary.mission,
        };
      }
      return merged;
    });
    toast({ title: 'Texto importado!', description: 'Os campos foram preenchidos. Revise antes de salvar.' });
  };

  // ─── Array helpers ──────

  function addItem<T>(arr: T[], empty: T): T[] {
    return [...arr, empty];
  }

  function removeItem<T>(arr: T[], idx: number): T[] {
    return arr.filter((_, i) => i !== idx);
  }

  function updateItem<T>(arr: T[], idx: number, updated: Partial<T>): T[] {
    return arr.map((item, i) => (i === idx ? { ...item, ...updated } : item));
  }

  // ─── No TL selected ──────

  if (!tlSlug || !companySlug) {
    return (
      <>
        <Header title="Manual de Marca" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <User className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Selecione um perfil no menu lateral.</p>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <Header title="Manual de Marca" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="max-w-3xl mx-auto space-y-4">
            <Skeleton className="h-8 w-64" />
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header title={`Manual de Marca${tlName ? ` — ${tlName}` : ''}`} />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Import bar */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Preencha os campos abaixo ou importe o texto de um manual já pronto.
            </p>
            <BrandManualImporter onImport={handleImport} />
          </div>

          {/* 1. Personalidade */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personalidade</CardTitle>
              <CardDescription>Descrição geral e atributos que definem a marca pessoal.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Descrição Geral</Label>
                <Textarea
                  value={data.personality.description}
                  onChange={(e) => setData(prev => ({
                    ...prev,
                    personality: { ...prev.personality, description: e.target.value },
                  }))}
                  placeholder="Como essa pessoa se apresenta ao mundo profissional..."
                  rows={3}
                  disabled={isSaving}
                />
              </div>
              <Label>Atributos</Label>
              {data.personality.attributes.map((attr, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <div className="flex-1 grid grid-cols-[1fr_2fr] gap-2">
                    <Input
                      placeholder="Atributo"
                      value={attr.title}
                      onChange={(e) => setData(prev => ({
                        ...prev,
                        personality: {
                          ...prev.personality,
                          attributes: updateItem(prev.personality.attributes, idx, { title: e.target.value }),
                        },
                      }))}
                      disabled={isSaving}
                    />
                    <Input
                      placeholder="Descrição"
                      value={attr.description}
                      onChange={(e) => setData(prev => ({
                        ...prev,
                        personality: {
                          ...prev.personality,
                          attributes: updateItem(prev.personality.attributes, idx, { description: e.target.value }),
                        },
                      }))}
                      disabled={isSaving}
                    />
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => setData(prev => ({
                      ...prev,
                      personality: {
                        ...prev.personality,
                        attributes: removeItem(prev.personality.attributes, idx),
                      },
                    }))}
                    disabled={isSaving || data.personality.attributes.length <= 1}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline" size="sm"
                onClick={() => setData(prev => ({
                  ...prev,
                  personality: {
                    ...prev.personality,
                    attributes: addItem(prev.personality.attributes, { title: '', description: '' }),
                  },
                }))}
                disabled={isSaving}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Atributo
              </Button>
            </CardContent>
          </Card>

          {/* 2. Mentalidade */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mentalidade</CardTitle>
              <CardDescription>Princípios e crenças que guiam a comunicação.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.mindset.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <div className="flex-1 grid grid-cols-[1fr_2fr] gap-2">
                    <Input
                      placeholder="Princípio"
                      value={item.title}
                      onChange={(e) => setData(prev => ({
                        ...prev,
                        mindset: updateItem(prev.mindset, idx, { title: e.target.value }),
                      }))}
                      disabled={isSaving}
                    />
                    <Input
                      placeholder="Descrição"
                      value={item.description}
                      onChange={(e) => setData(prev => ({
                        ...prev,
                        mindset: updateItem(prev.mindset, idx, { description: e.target.value }),
                      }))}
                      disabled={isSaving}
                    />
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => setData(prev => ({ ...prev, mindset: removeItem(prev.mindset, idx) }))}
                    disabled={isSaving || data.mindset.length <= 1}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline" size="sm"
                onClick={() => setData(prev => ({
                  ...prev,
                  mindset: addItem(prev.mindset, { title: '', description: '' }),
                }))}
                disabled={isSaving}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Princípio
              </Button>
            </CardContent>
          </Card>

          {/* 3. Arquétipos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Arquétipos</CardTitle>
              <CardDescription>Arquétipo primário e secundário da marca pessoal.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Arquétipo Primário</Label>
                <div className="grid grid-cols-[1fr_2fr] gap-2">
                  <Input
                    placeholder="Nome"
                    value={data.archetypes.primary.title}
                    onChange={(e) => setData(prev => ({
                      ...prev,
                      archetypes: { ...prev.archetypes, primary: { ...prev.archetypes.primary, title: e.target.value } },
                    }))}
                    disabled={isSaving}
                  />
                  <Input
                    placeholder="Descrição"
                    value={data.archetypes.primary.description}
                    onChange={(e) => setData(prev => ({
                      ...prev,
                      archetypes: { ...prev.archetypes, primary: { ...prev.archetypes.primary, description: e.target.value } },
                    }))}
                    disabled={isSaving}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Arquétipo Secundário</Label>
                <div className="grid grid-cols-[1fr_2fr] gap-2">
                  <Input
                    placeholder="Nome"
                    value={data.archetypes.secondary.title}
                    onChange={(e) => setData(prev => ({
                      ...prev,
                      archetypes: { ...prev.archetypes, secondary: { ...prev.archetypes.secondary, title: e.target.value } },
                    }))}
                    disabled={isSaving}
                  />
                  <Input
                    placeholder="Descrição"
                    value={data.archetypes.secondary.description}
                    onChange={(e) => setData(prev => ({
                      ...prev,
                      archetypes: { ...prev.archetypes, secondary: { ...prev.archetypes.secondary, description: e.target.value } },
                    }))}
                    disabled={isSaving}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 4. Tom de Voz */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tom de Voz</CardTitle>
              <CardDescription>Os tons que definem como a marca se comunica.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.toneOfVoice.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <div className="flex-1 grid grid-cols-[1fr_2fr] gap-2">
                    <Input
                      placeholder="Tom"
                      value={item.title}
                      onChange={(e) => setData(prev => ({
                        ...prev,
                        toneOfVoice: updateItem(prev.toneOfVoice, idx, { title: e.target.value }),
                      }))}
                      disabled={isSaving}
                    />
                    <Input
                      placeholder="Descrição"
                      value={item.description}
                      onChange={(e) => setData(prev => ({
                        ...prev,
                        toneOfVoice: updateItem(prev.toneOfVoice, idx, { description: e.target.value }),
                      }))}
                      disabled={isSaving}
                    />
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => setData(prev => ({ ...prev, toneOfVoice: removeItem(prev.toneOfVoice, idx) }))}
                    disabled={isSaving || data.toneOfVoice.length <= 1}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline" size="sm"
                onClick={() => setData(prev => ({
                  ...prev,
                  toneOfVoice: addItem(prev.toneOfVoice, { title: '', description: '' }),
                }))}
                disabled={isSaving}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Tom
              </Button>
            </CardContent>
          </Card>

          {/* 5. Linguagem e Estilo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Linguagem e Estilo</CardTitle>
              <CardDescription>Características de escrita e estilo de comunicação.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.languageStyle.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <div className="flex-1 grid grid-cols-[1fr_2fr] gap-2">
                    <Input
                      placeholder="Característica"
                      value={item.title}
                      onChange={(e) => setData(prev => ({
                        ...prev,
                        languageStyle: updateItem(prev.languageStyle, idx, { title: e.target.value }),
                      }))}
                      disabled={isSaving}
                    />
                    <Input
                      placeholder="Descrição"
                      value={item.description}
                      onChange={(e) => setData(prev => ({
                        ...prev,
                        languageStyle: updateItem(prev.languageStyle, idx, { description: e.target.value }),
                      }))}
                      disabled={isSaving}
                    />
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => setData(prev => ({ ...prev, languageStyle: removeItem(prev.languageStyle, idx) }))}
                    disabled={isSaving || data.languageStyle.length <= 1}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline" size="sm"
                onClick={() => setData(prev => ({
                  ...prev,
                  languageStyle: addItem(prev.languageStyle, { title: '', description: '' }),
                }))}
                disabled={isSaving}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Item
              </Button>
            </CardContent>
          </Card>

          {/* 7. Boas Práticas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Boas Práticas</CardTitle>
              <CardDescription>O que fazer e o que evitar na comunicação.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-green-600">Do&apos;s (Fazer)</Label>
                {data.bestPractices.dos.map((item, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      placeholder="Boa prática..."
                      value={item}
                      onChange={(e) => setData(prev => {
                        const updated = [...prev.bestPractices.dos];
                        updated[idx] = e.target.value;
                        return { ...prev, bestPractices: { ...prev.bestPractices, dos: updated } };
                      })}
                      disabled={isSaving}
                    />
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => setData(prev => ({
                        ...prev,
                        bestPractices: {
                          ...prev.bestPractices,
                          dos: removeItem(prev.bestPractices.dos, idx),
                        },
                      }))}
                      disabled={isSaving || data.bestPractices.dos.length <= 1}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline" size="sm"
                  onClick={() => setData(prev => ({
                    ...prev,
                    bestPractices: {
                      ...prev.bestPractices,
                      dos: [...prev.bestPractices.dos, ''],
                    },
                  }))}
                  disabled={isSaving}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-red-600">Don&apos;ts (Evitar)</Label>
                {data.bestPractices.donts.map((item, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      placeholder="Evitar..."
                      value={item}
                      onChange={(e) => setData(prev => {
                        const updated = [...prev.bestPractices.donts];
                        updated[idx] = e.target.value;
                        return { ...prev, bestPractices: { ...prev.bestPractices, donts: updated } };
                      })}
                      disabled={isSaving}
                    />
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => setData(prev => ({
                        ...prev,
                        bestPractices: {
                          ...prev.bestPractices,
                          donts: removeItem(prev.bestPractices.donts, idx),
                        },
                      }))}
                      disabled={isSaving || data.bestPractices.donts.length <= 1}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline" size="sm"
                  onClick={() => setData(prev => ({
                    ...prev,
                    bestPractices: {
                      ...prev.bestPractices,
                      donts: [...prev.bestPractices.donts, ''],
                    },
                  }))}
                  disabled={isSaving}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 8. Vocabulário */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vocabulário</CardTitle>
              <CardDescription>Palavras-chave e expressões características.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Palavras-chave</Label>
                {data.vocabulary.keywords.map((item, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      placeholder="Palavra-chave"
                      value={item}
                      onChange={(e) => setData(prev => {
                        const updated = [...prev.vocabulary.keywords];
                        updated[idx] = e.target.value;
                        return { ...prev, vocabulary: { ...prev.vocabulary, keywords: updated } };
                      })}
                      disabled={isSaving}
                    />
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => setData(prev => ({
                        ...prev,
                        vocabulary: {
                          ...prev.vocabulary,
                          keywords: removeItem(prev.vocabulary.keywords, idx),
                        },
                      }))}
                      disabled={isSaving || data.vocabulary.keywords.length <= 1}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline" size="sm"
                  onClick={() => setData(prev => ({
                    ...prev,
                    vocabulary: {
                      ...prev.vocabulary,
                      keywords: [...prev.vocabulary.keywords, ''],
                    },
                  }))}
                  disabled={isSaving}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Palavra
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Expressões</Label>
                {data.vocabulary.expressions.map((item, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      placeholder="Expressão"
                      value={item}
                      onChange={(e) => setData(prev => {
                        const updated = [...prev.vocabulary.expressions];
                        updated[idx] = e.target.value;
                        return { ...prev, vocabulary: { ...prev.vocabulary, expressions: updated } };
                      })}
                      disabled={isSaving}
                    />
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => setData(prev => ({
                        ...prev,
                        vocabulary: {
                          ...prev.vocabulary,
                          expressions: removeItem(prev.vocabulary.expressions, idx),
                        },
                      }))}
                      disabled={isSaving || data.vocabulary.expressions.length <= 1}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline" size="sm"
                  onClick={() => setData(prev => ({
                    ...prev,
                    vocabulary: {
                      ...prev.vocabulary,
                      expressions: [...prev.vocabulary.expressions, ''],
                    },
                  }))}
                  disabled={isSaving}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Expressão
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 9. Resumo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumo</CardTitle>
              <CardDescription>Síntese do posicionamento e diferenciais.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Posicionamento</Label>
                <Textarea
                  value={data.summary.positioning}
                  onChange={(e) => setData(prev => ({
                    ...prev,
                    summary: { ...prev.summary, positioning: e.target.value },
                  }))}
                  placeholder="Como essa pessoa se posiciona no mercado..."
                  rows={2}
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label>Proposta de Valor</Label>
                <Textarea
                  value={data.summary.valueProposition}
                  onChange={(e) => setData(prev => ({
                    ...prev,
                    summary: { ...prev.summary, valueProposition: e.target.value },
                  }))}
                  placeholder="O valor único que entrega à audiência..."
                  rows={2}
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label>Diferencial</Label>
                <Textarea
                  value={data.summary.differential}
                  onChange={(e) => setData(prev => ({
                    ...prev,
                    summary: { ...prev.summary, differential: e.target.value },
                  }))}
                  placeholder="O que diferencia das demais vozes no mercado..."
                  rows={2}
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label>Missão</Label>
                <Textarea
                  value={data.summary.mission}
                  onChange={(e) => setData(prev => ({
                    ...prev,
                    summary: { ...prev.summary, mission: e.target.value },
                  }))}
                  placeholder="A missão que guia a comunicação..."
                  rows={2}
                  disabled={isSaving}
                />
              </div>
            </CardContent>
          </Card>

          {/* Save button (sticky) */}
          <div className="sticky bottom-4 flex justify-end">
            <Button size="lg" onClick={handleSave} disabled={isSaving} className="shadow-lg">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Manual de Marca
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
