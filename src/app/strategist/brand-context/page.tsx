// src/app/strategist/brand-context/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/dashboard/header';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { getAuthToken } from '@/lib/auth-client';
import { getCompanyBrandContext, saveCompanyBrandContext, type BrandContextData } from '@/app/actions/content-strategy';
import { Loader2, Building2 } from 'lucide-react';

function splitToArray(val: string): string[] {
  return val.split(',').map(s => s.trim()).filter(Boolean);
}

function arrayToString(val?: string[] | string): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  return val.join(', ');
}

export default function StrategistBrandContextPage() {
  const searchParams = useSearchParams();
  const companyId = searchParams.get('companyId');
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [form, setForm] = useState({
    valueProposition: '',
    tagline: '',
    businessKeywords: '',
    solutions: '',
    targetPainPoints: '',
    targetAudience: '',
    approvedTopics: '',
    prohibitedPhrases: '',
  });

  const fetchData = useCallback(async () => {
    if (!companyId) return;
    setIsLoading(true);
    try {
      const token = await getAuthToken();

      // Fetch company name from Firestore client-side
      const { doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      const compDoc = await getDoc(doc(db, 'companies', companyId));
      if (compDoc.exists()) {
        setCompanyName(compDoc.data()?.companyName || '');
      }

      const result = await getCompanyBrandContext(token, companyId);
      if (result.data) {
        const d = result.data;
        setForm({
          valueProposition: d.valueProposition || '',
          tagline: d.tagline || '',
          businessKeywords: arrayToString(d.businessKeywords),
          solutions: arrayToString(d.solutions),
          targetPainPoints: arrayToString(d.targetPainPoints),
          targetAudience: d.targetAudience || '',
          approvedTopics: arrayToString(d.approvedTopics),
          prohibitedPhrases: arrayToString(d.prohibitedPhrases),
        });
      } else if (result.error) {
        toast({ variant: 'destructive', title: 'Erro', description: result.error });
      }
    } catch (err) {
      console.error('Error loading brand context:', err);
      toast({ variant: 'destructive', title: 'Erro ao carregar dados.' });
    } finally {
      setIsLoading(false);
    }
  }, [companyId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    if (!companyId) return;
    setIsSaving(true);
    try {
      const token = await getAuthToken();
      const data: BrandContextData = {
        valueProposition: form.valueProposition,
        tagline: form.tagline,
        businessKeywords: splitToArray(form.businessKeywords),
        solutions: splitToArray(form.solutions),
        targetPainPoints: splitToArray(form.targetPainPoints),
        targetAudience: form.targetAudience,
        approvedTopics: splitToArray(form.approvedTopics),
        prohibitedPhrases: splitToArray(form.prohibitedPhrases),
      };
      const result = await saveCompanyBrandContext(token, companyId, data);
      if (result.success) {
        toast({ title: 'Brand Context salvo com sucesso!' });
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: result.error });
      }
    } catch (err) {
      console.error('Error saving brand context:', err);
      toast({ variant: 'destructive', title: 'Erro ao salvar.' });
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  if (!companyId) {
    return (
      <>
        <Header title="Brand Context" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Selecione uma empresa no menu lateral.</p>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <Header title="Brand Context" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="max-w-3xl mx-auto space-y-4">
            <Skeleton className="h-8 w-64" />
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header title={`Brand Context${companyName ? ` — ${companyName}` : ''}`} />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Brand Context</CardTitle>
              <CardDescription>
                Informações da marca da empresa que orientam a criação de conteúdo. Estes dados são compartilhados com o admin da empresa.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="valueProposition">Proposta de Valor</Label>
                <Textarea
                  id="valueProposition"
                  placeholder="O que torna a empresa única? Qual problema resolve?"
                  value={form.valueProposition}
                  onChange={(e) => updateField('valueProposition', e.target.value)}
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tagline">Tagline</Label>
                <Input
                  id="tagline"
                  placeholder="Frase curta que resume a marca"
                  value={form.tagline}
                  onChange={(e) => updateField('tagline', e.target.value)}
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessKeywords">Palavras-chave do Negócio</Label>
                <Textarea
                  id="businessKeywords"
                  placeholder="liderança, inovação, tecnologia, B2B"
                  value={form.businessKeywords}
                  onChange={(e) => updateField('businessKeywords', e.target.value)}
                  disabled={isSaving}
                />
                <p className="text-xs text-muted-foreground">Separadas por vírgula</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="solutions">Soluções / Serviços</Label>
                <Textarea
                  id="solutions"
                  placeholder="Consultoria estratégica, Plataforma SaaS, Treinamento"
                  value={form.solutions}
                  onChange={(e) => updateField('solutions', e.target.value)}
                  disabled={isSaving}
                />
                <p className="text-xs text-muted-foreground">Separadas por vírgula</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetPainPoints">Dores do Público-alvo</Label>
                <Textarea
                  id="targetPainPoints"
                  placeholder="Falta de visibilidade, processos manuais, baixo engajamento"
                  value={form.targetPainPoints}
                  onChange={(e) => updateField('targetPainPoints', e.target.value)}
                  disabled={isSaving}
                />
                <p className="text-xs text-muted-foreground">Separadas por vírgula</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetAudience">Público-alvo</Label>
                <Textarea
                  id="targetAudience"
                  placeholder="Descrição do público-alvo ideal"
                  value={form.targetAudience}
                  onChange={(e) => updateField('targetAudience', e.target.value)}
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="approvedTopics">Tópicos Aprovados</Label>
                <Textarea
                  id="approvedTopics"
                  placeholder="Temas que o conteúdo pode abordar"
                  value={form.approvedTopics}
                  onChange={(e) => updateField('approvedTopics', e.target.value)}
                  disabled={isSaving}
                />
                <p className="text-xs text-muted-foreground">Separados por vírgula</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prohibitedPhrases">Frases / Temas Proibidos</Label>
                <Textarea
                  id="prohibitedPhrases"
                  placeholder="Termos ou frases que não devem ser usados"
                  value={form.prohibitedPhrases}
                  onChange={(e) => updateField('prohibitedPhrases', e.target.value)}
                  disabled={isSaving}
                />
                <p className="text-xs text-muted-foreground">Separados por vírgula</p>
              </div>
            </CardContent>
            <CardFooter className="border-t px-6 py-4">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Brand Context
              </Button>
            </CardFooter>
          </Card>
        </div>
      </main>
    </>
  );
}
