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
import { Loader2, Plus, X, User, Trash2 } from 'lucide-react';
import { PILLAR_COLORS } from '@/lib/pillar-colors';

// ─── Helpers ──────

function emptyContentType() {
  return { percentage: 0, description: '', formats: [''], triggers: [''] };
}

function emptyStrategy(): ContentStrategyData {
  return {
    contentTypes: {
      visibility: { ...emptyContentType(), percentage: 40 },
      authority: { ...emptyContentType(), percentage: 40 },
      conversion: { ...emptyContentType(), percentage: 20 },
    },
    pillars: [{
      name: '',
      purpose: '',
      audienceObjective: '',
      businessObjective: '',
      contentExamples: ['', '', ''],
    }],
  };
}

/** Ensure legacy contentType entries have formats/triggers arrays */
function normalizeContentType(ct: { percentage: number; description: string; formats?: string[]; triggers?: string[] }) {
  return {
    ...ct,
    formats: ct.formats?.length ? ct.formats : [''],
    triggers: ct.triggers?.length ? ct.triggers : [''],
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
        // Normalize: ensure new fields exist (migrate from legacy data)
        const loaded = { ...emptyStrategy(), ...result.data };
        // Normalize content types (formats + triggers)
        loaded.contentTypes = {
          visibility: normalizeContentType(loaded.contentTypes.visibility),
          authority: normalizeContentType(loaded.contentTypes.authority),
          conversion: normalizeContentType(loaded.contentTypes.conversion),
        };
        // Normalize pillars
        if (loaded.pillars) {
          loaded.pillars = loaded.pillars.map(p => ({
            ...p,
            purpose: p.purpose || '',
            audienceObjective: p.audienceObjective || '',
            businessObjective: p.businessObjective || '',
            contentExamples: p.contentExamples?.length ? p.contentExamples : ['', '', ''],
          }));
        }
        setData(loaded);
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
      // Clean empty entries before saving
      const cleanCT = (ct: typeof data.contentTypes.visibility) => ({
        ...ct,
        formats: (ct.formats || []).filter(f => f.trim()),
        triggers: (ct.triggers || []).filter(t => t.trim()),
      });
      const clean: ContentStrategyData = {
        ...data,
        contentTypes: {
          visibility: cleanCT(data.contentTypes.visibility),
          authority: cleanCT(data.contentTypes.authority),
          conversion: cleanCT(data.contentTypes.conversion),
        },
        pillars: data.pillars
          .filter(p => p.name || p.purpose || p.audienceObjective || p.businessObjective)
          .map(p => ({
            ...p,
            contentExamples: (p.contentExamples || []).filter(ex => ex.trim()),
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
      const errMsg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: errMsg });
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
              {([
                { key: 'visibility' as const, label: 'Visibilidade (ToFu)', color: 'text-blue-600 border-blue-200 dark:border-blue-900', placeholder: 'Que tipo de conteúdo gera visibilidade? Temas amplos, trending...' },
                { key: 'authority' as const, label: 'Autoridade (MoFu)', color: 'text-purple-600 border-purple-200 dark:border-purple-900', placeholder: 'Conteúdos que constroem autoridade e expertise no tema...' },
                { key: 'conversion' as const, label: 'Conversão (BoFu)', color: 'text-green-600 border-green-200 dark:border-green-900', placeholder: 'Conteúdos que levam à ação — CTAs, cases, ofertas...' },
              ]).map(({ key, label, color, placeholder }) => {
                const ct = data.contentTypes[key];
                const updateCT = (field: string, value: string | number | string[]) => {
                  setData(prev => ({
                    ...prev,
                    contentTypes: {
                      ...prev.contentTypes,
                      [key]: { ...prev.contentTypes[key], [field]: value },
                    },
                  }));
                };
                return (
                  <div key={key} className={`rounded-lg border ${color.split(' ').slice(1).join(' ')} p-4 space-y-3`}>
                    <div className="flex items-center justify-between">
                      <Label className={`font-medium ${color.split(' ')[0]}`}>{label}</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number" min={0} max={100}
                          className="w-16 h-8 text-center text-sm"
                          value={ct.percentage}
                          onChange={(e) => updateCT('percentage', Number(e.target.value))}
                          disabled={isSaving}
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    </div>

                    {/* Descrição */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Descrição</Label>
                      <Textarea
                        placeholder={placeholder}
                        value={ct.description}
                        onChange={(e) => updateCT('description', e.target.value)}
                        rows={2}
                        disabled={isSaving}
                      />
                    </div>

                    {/* Formatos */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Formatos</Label>
                      {(ct.formats || ['']).map((fmt, fIdx) => (
                        <div key={fIdx} className="flex gap-2 items-center">
                          <Input
                            placeholder="Ex: Carousel, Vídeo curto, Infográfico..."
                            value={fmt}
                            onChange={(e) => {
                              const newFormats = [...(ct.formats || [''])];
                              newFormats[fIdx] = e.target.value;
                              updateCT('formats', newFormats);
                            }}
                            disabled={isSaving}
                          />
                          {(ct.formats || []).length > 1 && (
                            <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8"
                              onClick={() => updateCT('formats', (ct.formats || []).filter((_, i) => i !== fIdx))}
                              disabled={isSaving}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button variant="ghost" size="sm" className="text-xs"
                        onClick={() => updateCT('formats', [...(ct.formats || []), ''])}
                        disabled={isSaving}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Adicionar formato
                      </Button>
                    </div>

                    {/* Gatilhos */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Gatilhos</Label>
                      {(ct.triggers || ['']).map((trg, tIdx) => (
                        <div key={tIdx} className="flex gap-2 items-center">
                          <Input
                            placeholder="Ex: Dor do ICP, Trending topic, Novidade do mercado..."
                            value={trg}
                            onChange={(e) => {
                              const newTriggers = [...(ct.triggers || [''])];
                              newTriggers[tIdx] = e.target.value;
                              updateCT('triggers', newTriggers);
                            }}
                            disabled={isSaving}
                          />
                          {(ct.triggers || []).length > 1 && (
                            <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8"
                              onClick={() => updateCT('triggers', (ct.triggers || []).filter((_, i) => i !== tIdx))}
                              disabled={isSaving}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button variant="ghost" size="sm" className="text-xs"
                        onClick={() => updateCT('triggers', [...(ct.triggers || []), ''])}
                        disabled={isSaving}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Adicionar gatilho
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* 2. Pilares de Conteúdo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pilares de Conteúdo</CardTitle>
              <CardDescription>Os pilares temáticos da estratégia de conteúdo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {data.pillars.map((pillar, pIdx) => (
                <div key={pIdx} className="rounded-lg border p-4 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-3">
                      {/* Nome + Cor */}
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

                      {/* Propósito */}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Propósito</Label>
                        <Textarea
                          placeholder="Qual é o propósito desse pilar? Por que ele existe na estratégia?"
                          value={pillar.purpose || ''}
                          onChange={(e) => setData(prev => ({
                            ...prev,
                            pillars: updateItem(prev.pillars, pIdx, { purpose: e.target.value }),
                          }))}
                          rows={2}
                          disabled={isSaving}
                        />
                      </div>

                      {/* Objetivos */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Objetivo da Audiência</Label>
                          <Textarea
                            placeholder="O que a audiência ganha com esse pilar?"
                            value={pillar.audienceObjective || ''}
                            onChange={(e) => setData(prev => ({
                              ...prev,
                              pillars: updateItem(prev.pillars, pIdx, { audienceObjective: e.target.value }),
                            }))}
                            rows={2}
                            disabled={isSaving}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Objetivo de Negócio</Label>
                          <Textarea
                            placeholder="Como esse pilar contribui para os objetivos do negócio?"
                            value={pillar.businessObjective || ''}
                            onChange={(e) => setData(prev => ({
                              ...prev,
                              pillars: updateItem(prev.pillars, pIdx, { businessObjective: e.target.value }),
                            }))}
                            rows={2}
                            disabled={isSaving}
                          />
                        </div>
                      </div>

                      {/* Tipos de conteúdo de exemplo */}
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Tipos de Conteúdo de Exemplo</Label>
                        {(pillar.contentExamples || ['', '', '']).map((example, eIdx) => (
                          <div key={eIdx} className="flex gap-2 items-center">
                            <span className="text-xs text-muted-foreground w-4">{eIdx + 1}.</span>
                            <Input
                              placeholder={
                                eIdx === 0 ? 'Ex: Bastidores de decisão' :
                                eIdx === 1 ? 'Ex: Lições aprendidas' :
                                'Ex: Frameworks práticos'
                              }
                              value={example}
                              onChange={(e) => {
                                const newExamples = [...(pillar.contentExamples || ['', '', ''])];
                                newExamples[eIdx] = e.target.value;
                                setData(prev => ({
                                  ...prev,
                                  pillars: updateItem(prev.pillars, pIdx, { contentExamples: newExamples }),
                                }));
                              }}
                              disabled={isSaving}
                            />
                          </div>
                        ))}
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
                    purpose: '',
                    audienceObjective: '',
                    businessObjective: '',
                    contentExamples: ['', '', ''],
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
