// src/app/strategist/estrategia/page.tsx
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
import { getContentStrategy, saveContentStrategy, type ContentStrategyData } from '@/app/actions/content-strategy';
import { Loader2, Plus, X, User } from 'lucide-react';
import { PILLAR_COLORS } from '@/lib/pillar-colors';

// ─── Helpers ──────

function emptyStrategy(): ContentStrategyData {
  return {
    contentTypes: {
      visibility: { percentage: 40, description: '' },
      authority: { percentage: 40, description: '' },
      conversion: { percentage: 20, description: '' },
    },
    pillars: [{
      name: '',
      subtitle: '',
      series: [{ name: '', objective: '', inputs: '' }],
    }],
  };
}

export default function StrategistEstrategiaPage() {
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
  const [data, setData] = useState<ContentStrategyData>(emptyStrategy());

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

      const result = await getContentStrategy(token, tlId);
      if (result.data) {
        setData({ ...emptyStrategy(), ...result.data });
      } else if (result.error) {
        toast({ variant: 'destructive', title: 'Erro', description: result.error });
      }
    } catch (err) {
      console.error('Error loading strategy:', err);
      toast({ variant: 'destructive', title: 'Erro ao carregar estratégia.' });
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
      const token = await getAuthToken();
      // Clean empty items
      const clean: ContentStrategyData = {
        ...data,
        pillars: data.pillars
          .filter(p => p.name || p.subtitle || p.series.some(s => s.name))
          .map(p => ({
            ...p,
            series: p.series.filter(s => s.name || s.objective || s.inputs),
          })),
      };
      const result = await saveContentStrategy(token, tlId, clean);
      if (result.success) {
        toast({ title: 'Estratégia salva com sucesso!' });
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: result.error });
      }
    } catch (err) {
      console.error('Error saving strategy:', err);
      toast({ variant: 'destructive', title: 'Erro ao salvar.' });
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Array helpers ──────

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
        <Header title="Estratégia de Conteúdo" />
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
        <Header title="Estratégia de Conteúdo" />
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
      <Header title={`Estratégia de Conteúdo${tlName ? ` — ${tlName}` : ''}`} />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* 1. Tipos de Conteúdo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tipos de Conteúdo</CardTitle>
              <CardDescription>Distribuição entre Visibilidade (ToFu), Autoridade (MoFu) e Conversão (BoFu).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Visibilidade */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-blue-600 font-medium">Visibilidade (ToFu)</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      className="w-16 h-8 text-center text-sm"
                      value={data.contentTypes.visibility.percentage}
                      onChange={(e) => setData(prev => ({
                        ...prev,
                        contentTypes: {
                          ...prev.contentTypes,
                          visibility: { ...prev.contentTypes.visibility, percentage: Number(e.target.value) },
                        },
                      }))}
                      disabled={isSaving}
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
                <Textarea
                  placeholder="Que tipo de conteúdo gera visibilidade? Temas amplos, trending..."
                  value={data.contentTypes.visibility.description}
                  onChange={(e) => setData(prev => ({
                    ...prev,
                    contentTypes: {
                      ...prev.contentTypes,
                      visibility: { ...prev.contentTypes.visibility, description: e.target.value },
                    },
                  }))}
                  rows={2}
                  disabled={isSaving}
                />
              </div>

              {/* Autoridade */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-purple-600 font-medium">Autoridade (MoFu)</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      className="w-16 h-8 text-center text-sm"
                      value={data.contentTypes.authority.percentage}
                      onChange={(e) => setData(prev => ({
                        ...prev,
                        contentTypes: {
                          ...prev.contentTypes,
                          authority: { ...prev.contentTypes.authority, percentage: Number(e.target.value) },
                        },
                      }))}
                      disabled={isSaving}
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
                <Textarea
                  placeholder="Conteúdos que constroem autoridade e expertise no tema..."
                  value={data.contentTypes.authority.description}
                  onChange={(e) => setData(prev => ({
                    ...prev,
                    contentTypes: {
                      ...prev.contentTypes,
                      authority: { ...prev.contentTypes.authority, description: e.target.value },
                    },
                  }))}
                  rows={2}
                  disabled={isSaving}
                />
              </div>

              {/* Conversão */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-green-600 font-medium">Conversão (BoFu)</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      className="w-16 h-8 text-center text-sm"
                      value={data.contentTypes.conversion.percentage}
                      onChange={(e) => setData(prev => ({
                        ...prev,
                        contentTypes: {
                          ...prev.contentTypes,
                          conversion: { ...prev.contentTypes.conversion, percentage: Number(e.target.value) },
                        },
                      }))}
                      disabled={isSaving}
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
                <Textarea
                  placeholder="Conteúdos que levam à ação — CTAs, cases, ofertas..."
                  value={data.contentTypes.conversion.description}
                  onChange={(e) => setData(prev => ({
                    ...prev,
                    contentTypes: {
                      ...prev.contentTypes,
                      conversion: { ...prev.contentTypes.conversion, description: e.target.value },
                    },
                  }))}
                  rows={2}
                  disabled={isSaving}
                />
              </div>
            </CardContent>
          </Card>

          {/* 2. Pilares de Conteúdo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pilares de Conteúdo</CardTitle>
              <CardDescription>Os pilares temáticos e suas séries de conteúdo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {data.pillars.map((pillar, pIdx) => (
                <div key={pIdx} className="rounded-lg border p-4 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-3">
                      <div className="grid grid-cols-[1fr_2fr] gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Nome do Pilar</Label>
                          <Input
                            placeholder="Ex: Liderança"
                            value={pillar.name}
                            onChange={(e) => setData(prev => ({
                              ...prev,
                              pillars: updateItem(prev.pillars, pIdx, { name: e.target.value }),
                            }))}
                            disabled={isSaving}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Subtítulo</Label>
                          <Input
                            placeholder="Ex: Decisões que transformam equipes"
                            value={pillar.subtitle}
                            onChange={(e) => setData(prev => ({
                              ...prev,
                              pillars: updateItem(prev.pillars, pIdx, { subtitle: e.target.value }),
                            }))}
                            disabled={isSaving}
                          />
                        </div>
                      </div>

                      {/* Color picker */}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Cor do pilar</Label>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {PILLAR_COLORS.map(color => (
                            <button
                              key={color.key}
                              type="button"
                              disabled={isSaving}
                              onClick={() => setData(prev => ({
                                ...prev,
                                pillars: updateItem(prev.pillars, pIdx, { color: color.key }),
                              }))}
                              className={`h-5 w-5 rounded-full transition-all ${color.swatch} ${
                                pillar.color === color.key
                                  ? 'ring-2 ring-offset-2 ring-primary scale-110'
                                  : 'hover:scale-110 opacity-70 hover:opacity-100'
                              }`}
                              title={color.label}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Series */}
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Séries</Label>
                        {pillar.series.map((serie, sIdx) => (
                          <div key={sIdx} className="flex gap-2 items-start">
                            <div className="flex-1 grid grid-cols-3 gap-2">
                              <Input
                                placeholder="Nome da série"
                                value={serie.name}
                                onChange={(e) => {
                                  const newSeries = [...pillar.series];
                                  newSeries[sIdx] = { ...newSeries[sIdx], name: e.target.value };
                                  setData(prev => ({
                                    ...prev,
                                    pillars: updateItem(prev.pillars, pIdx, { series: newSeries }),
                                  }));
                                }}
                                disabled={isSaving}
                              />
                              <Input
                                placeholder="Objetivo"
                                value={serie.objective}
                                onChange={(e) => {
                                  const newSeries = [...pillar.series];
                                  newSeries[sIdx] = { ...newSeries[sIdx], objective: e.target.value };
                                  setData(prev => ({
                                    ...prev,
                                    pillars: updateItem(prev.pillars, pIdx, { series: newSeries }),
                                  }));
                                }}
                                disabled={isSaving}
                              />
                              <Input
                                placeholder="Inputs / Fontes"
                                value={serie.inputs}
                                onChange={(e) => {
                                  const newSeries = [...pillar.series];
                                  newSeries[sIdx] = { ...newSeries[sIdx], inputs: e.target.value };
                                  setData(prev => ({
                                    ...prev,
                                    pillars: updateItem(prev.pillars, pIdx, { series: newSeries }),
                                  }));
                                }}
                                disabled={isSaving}
                              />
                            </div>
                            <Button
                              variant="ghost" size="icon"
                              onClick={() => {
                                const newSeries = removeItem(pillar.series, sIdx);
                                setData(prev => ({
                                  ...prev,
                                  pillars: updateItem(prev.pillars, pIdx, { series: newSeries }),
                                }));
                              }}
                              disabled={isSaving || pillar.series.length <= 1}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline" size="sm"
                          onClick={() => {
                            const newSeries = [...pillar.series, { name: '', objective: '', inputs: '' }];
                            setData(prev => ({
                              ...prev,
                              pillars: updateItem(prev.pillars, pIdx, { series: newSeries }),
                            }));
                          }}
                          disabled={isSaving}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Série
                        </Button>
                      </div>
                    </div>

                    <Button
                      variant="ghost" size="icon"
                      onClick={() => setData(prev => ({ ...prev, pillars: removeItem(prev.pillars, pIdx) }))}
                      disabled={isSaving || data.pillars.length <= 1}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              <Button
                variant="outline" size="sm"
                onClick={() => setData(prev => ({
                  ...prev,
                  pillars: [...prev.pillars, {
                    name: '',
                    subtitle: '',
                    series: [{ name: '', objective: '', inputs: '' }],
                  }],
                }))}
                disabled={isSaving}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Pilar
              </Button>
            </CardContent>
          </Card>

          {/* Save button (sticky) */}
          <div className="sticky bottom-4 flex justify-end">
            <Button size="lg" onClick={handleSave} disabled={isSaving} className="shadow-lg">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Estratégia
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
