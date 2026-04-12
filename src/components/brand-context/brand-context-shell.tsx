'use client';

import { useState, useEffect, useCallback, type KeyboardEvent } from 'react';
import { Header } from '@/components/dashboard/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { getAuthToken } from '@/lib/auth-client';
import { getCompanyBrandContext, saveCompanyBrandContext, type BrandContextData } from '@/app/actions/content-strategy';
import { Loader2, Plus, X } from 'lucide-react';

// ─── Tag Input Component ──────
function TagInput({
  tags,
  onTagsChange,
  placeholder,
  variant = 'purple',
  disabled = false,
}: {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder: string;
  variant?: 'purple' | 'gray';
  disabled?: boolean;
}) {
  const [inputValue, setInputValue] = useState('');

  const addTag = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onTagsChange([...tags, trimmed]);
    }
    setInputValue('');
  };

  const removeTag = (idx: number) => {
    onTagsChange(tags.filter((_, i) => i !== idx));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  const tagClasses = variant === 'purple'
    ? 'bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300'
    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[32px]">
        {tags.map((tag, idx) => (
          <span
            key={idx}
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${tagClasses}`}
          >
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={() => removeTag(idx)}
                className="ml-0.5 hover:opacity-70"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (inputValue.trim()) addTag(inputValue); }}
        placeholder={placeholder}
        disabled={disabled}
        className="text-sm"
      />
      <p className="text-[11px] text-muted-foreground">Pressione Enter ou vírgula para adicionar</p>
    </div>
  );
}

// ─── State type ──────
type PainSolution = { title: string; description: string };

type Props = {
  companyId: string;
};

export function BrandContextShell({ companyId }: Props) {
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [companyName, setCompanyName] = useState('');

  // Text fields
  const [valueProposition, setValueProposition] = useState('');
  const [tagline, setTagline] = useState('');
  const [positioning, setPositioning] = useState('');
  const [targetAudience, setTargetAudience] = useState('');

  // Tag fields
  const [businessKeywords, setBusinessKeywords] = useState<string[]>([]);
  const [approvedTopics, setApprovedTopics] = useState<string[]>([]);
  const [prohibitedPhrases, setProhibitedPhrases] = useState<string[]>([]);

  // Structured lists
  const [pains, setPains] = useState<PainSolution[]>([{ title: '', description: '' }]);
  const [solutions, setSolutions] = useState<PainSolution[]>([{ title: '', description: '' }]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await getAuthToken();

      const { doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      const compDoc = await getDoc(doc(db, 'companies', companyId));
      if (compDoc.exists()) {
        setCompanyName(compDoc.data()?.companyName || '');
      }

      const result = await getCompanyBrandContext(token, companyId);
      if (result.data) {
        const d = result.data;
        setValueProposition(d.valueProposition || '');
        setTagline(d.tagline || '');
        setPositioning(d.positioning || '');
        setTargetAudience(d.targetAudience || '');

        // Tags — backward compat for string arrays
        setBusinessKeywords(Array.isArray(d.businessKeywords) ? d.businessKeywords : []);
        setApprovedTopics(Array.isArray(d.approvedTopics) ? d.approvedTopics : []);
        setProhibitedPhrases(Array.isArray(d.prohibitedPhrases) ? d.prohibitedPhrases : []);

        // Pains/Solutions — backward compat for old string[] format
        if (Array.isArray(d.pains) && d.pains.length > 0) {
          if (typeof d.pains[0] === 'string') {
            setPains((d.pains as unknown as string[]).map(s => ({ title: s, description: '' })));
          } else {
            setPains(d.pains as PainSolution[]);
          }
        } else {
          setPains([{ title: '', description: '' }]);
        }

        if (Array.isArray(d.solutions) && d.solutions.length > 0) {
          if (typeof d.solutions[0] === 'string') {
            setSolutions((d.solutions as unknown as string[]).map(s => ({ title: s, description: '' })));
          } else {
            setSolutions(d.solutions as PainSolution[]);
          }
        } else {
          setSolutions([{ title: '', description: '' }]);
        }
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
    setIsSaving(true);
    try {
      const token = await getAuthToken();
      const data: BrandContextData = {
        valueProposition,
        tagline,
        positioning,
        businessKeywords,
        pains: pains.filter(p => p.title || p.description),
        solutions: solutions.filter(s => s.title || s.description),
        targetAudience,
        approvedTopics,
        prohibitedPhrases,
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

  // List helpers
  function removeItem<T>(arr: T[], idx: number): T[] {
    return arr.filter((_, i) => i !== idx);
  }

  function updateItem<T>(arr: T[], idx: number, updated: Partial<T>): T[] {
    return arr.map((item, i) => (i === idx ? { ...item, ...updated } : item));
  }

  if (isLoading) {
    return (
      <>
        <Header title="Brand Context" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="max-w-3xl mx-auto space-y-4">
            <Skeleton className="h-8 w-64" />
            {[1, 2, 3, 4, 5].map(i => (
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
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Posicionamento e Proposta */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Posicionamento e Proposta</CardTitle>
              <CardDescription>Como a empresa se posiciona e comunica seu valor.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Proposta de Valor</Label>
                <Textarea
                  placeholder="O que torna a empresa única? Qual problema resolve?"
                  value={valueProposition}
                  onChange={(e) => setValueProposition(e.target.value)}
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label>Tagline</Label>
                <Input
                  placeholder="Frase curta que resume a marca"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label>Posicionamento</Label>
                <Textarea
                  placeholder="Como a empresa se posiciona no mercado..."
                  value={positioning}
                  onChange={(e) => setPositioning(e.target.value)}
                  disabled={isSaving}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Palavras-chave */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Palavras-chave do Negócio</CardTitle>
              <CardDescription>Termos que definem o negócio e orientam o conteúdo.</CardDescription>
            </CardHeader>
            <CardContent>
              <TagInput
                tags={businessKeywords}
                onTagsChange={setBusinessKeywords}
                placeholder="Digite e pressione Enter..."
                variant="purple"
                disabled={isSaving}
              />
            </CardContent>
          </Card>

          {/* Público-alvo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Público-alvo</CardTitle>
              <CardDescription>Descrição do público-alvo ideal da empresa.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Quem é o público ideal? Perfil, cargo, indústria..."
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                disabled={isSaving}
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Dores */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dores do Público</CardTitle>
              <CardDescription>Os problemas e dores que a empresa resolve.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {pains.map((pain, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <div className="flex-1 grid grid-cols-[1fr_2fr] gap-2">
                    <Input
                      placeholder="Dor"
                      value={pain.title}
                      onChange={(e) => setPains(prev => updateItem(prev, idx, { title: e.target.value }))}
                      disabled={isSaving}
                    />
                    <Input
                      placeholder="Descrição"
                      value={pain.description}
                      onChange={(e) => setPains(prev => updateItem(prev, idx, { description: e.target.value }))}
                      disabled={isSaving}
                    />
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => setPains(prev => removeItem(prev, idx))}
                    disabled={isSaving || pains.length <= 1}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline" size="sm"
                onClick={() => setPains(prev => [...prev, { title: '', description: '' }])}
                disabled={isSaving}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Dor
              </Button>
            </CardContent>
          </Card>

          {/* Soluções */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Soluções e Serviços</CardTitle>
              <CardDescription>O que a empresa oferece para resolver as dores.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {solutions.map((sol, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <div className="flex-1 grid grid-cols-[1fr_2fr] gap-2">
                    <Input
                      placeholder="Solução"
                      value={sol.title}
                      onChange={(e) => setSolutions(prev => updateItem(prev, idx, { title: e.target.value }))}
                      disabled={isSaving}
                    />
                    <Input
                      placeholder="Descrição"
                      value={sol.description}
                      onChange={(e) => setSolutions(prev => updateItem(prev, idx, { description: e.target.value }))}
                      disabled={isSaving}
                    />
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => setSolutions(prev => removeItem(prev, idx))}
                    disabled={isSaving || solutions.length <= 1}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline" size="sm"
                onClick={() => setSolutions(prev => [...prev, { title: '', description: '' }])}
                disabled={isSaving}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Solução
              </Button>
            </CardContent>
          </Card>

          {/* Tópicos Aprovados */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tópicos Aprovados</CardTitle>
              <CardDescription>Temas que o conteúdo pode abordar.</CardDescription>
            </CardHeader>
            <CardContent>
              <TagInput
                tags={approvedTopics}
                onTagsChange={setApprovedTopics}
                placeholder="Digite um tópico e pressione Enter..."
                variant="purple"
                disabled={isSaving}
              />
            </CardContent>
          </Card>

          {/* Temas Proibidos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Temas Proibidos</CardTitle>
              <CardDescription>Termos, frases ou temas que não devem ser usados.</CardDescription>
            </CardHeader>
            <CardContent>
              <TagInput
                tags={prohibitedPhrases}
                onTagsChange={setProhibitedPhrases}
                placeholder="Digite e pressione Enter..."
                variant="gray"
                disabled={isSaving}
              />
            </CardContent>
          </Card>

          {/* Save button (sticky) */}
          <div className="sticky bottom-4 flex justify-end">
            <Button size="lg" onClick={handleSave} disabled={isSaving} className="shadow-lg">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Brand Context
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
