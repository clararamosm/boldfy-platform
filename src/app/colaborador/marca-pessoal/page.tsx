// src/app/colaborador/marca-pessoal/page.tsx
// Personal brand identity page for collaborators.
// Moved out of settings into its own route.
'use client';

import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Header } from '@/components/dashboard/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { useT } from '@/lib/i18n/context';
import { Loader2 } from 'lucide-react';

type BrandingData = {
  voice: string;
  expertise: string;
  value: string;
  position: string;
  languageStyle: string;
  contentPillars: string;
};

function BrandingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

export default function MarcaPessoalPage() {
  const t = useT();
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const currentUserId = authUser?.uid || null;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [branding, setBranding] = useState<BrandingData>({
    voice: '', expertise: '', value: '', position: '', languageStyle: '', contentPillars: '',
  });

  const fetchData = useCallback(async (userId: string) => {
    try {
      setIsLoading(true);
      const snap = await getDoc(doc(db, 'users', userId));
      if (snap.exists()) {
        const data = snap.data();
        setBranding({
          voice: data.voice || '',
          expertise: data.expertise || '',
          value: data.value || '',
          position: data.position || '',
          languageStyle: data.languageStyle || '',
          contentPillars: Array.isArray(data.contentPillars)
            ? data.contentPillars.join(', ')
            : (data.contentPillars || ''),
        });
      }
    } catch (error) {
      console.error('Error fetching branding data:', error);
      toast({ variant: 'destructive', title: 'Erro ao carregar', description: 'Tente novamente.' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (currentUserId) fetchData(currentUserId);
  }, [currentUserId, fetchData]);

  const handleSave = async () => {
    if (!currentUserId) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Usuário não identificado.' });
      return;
    }

    setIsSaving(true);
    try {
      await setDoc(doc(db, 'users', currentUserId), {
        voice: branding.voice,
        expertise: branding.expertise,
        value: branding.value,
        position: branding.position,
        languageStyle: branding.languageStyle,
        contentPillars: branding.contentPillars.split(',').map(s => s.trim()).filter(Boolean),
      }, { merge: true });

      toast({ title: 'Marca pessoal salva', description: 'Suas preferências foram atualizadas.' });
    } catch (error) {
      console.error('Error saving branding:', error);
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: 'Tente novamente.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header title="Marca Pessoal" />
      <main className="flex-1 p-6 md:p-10">
        <div className="mx-auto max-w-4xl space-y-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Marca Pessoal</h1>
            <p className="text-muted-foreground">
              Configure sua identidade de marca. A IA usa essas informações para gerar conteúdo alinhado com o seu estilo.
            </p>
          </div>

          {isLoading ? (
            <BrandingSkeleton />
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Identidade de Marca</CardTitle>
                  <CardDescription>
                    Defina como você se comunica e quais temas você aborda.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="voice">Tom de voz</Label>
                    <Textarea
                      id="voice"
                      placeholder="Como você se comunica? Ex: informal e direto, técnico e analítico, inspiracional com humor..."
                      value={branding.voice}
                      onChange={e => setBranding({ ...branding, voice: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Descreva livremente como você fala e escreve. A IA vai calibrar o tom do conteúdo com base nisso.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expertise">Áreas de expertise</Label>
                    <Textarea
                      id="expertise"
                      placeholder="Ex: Marketing Digital, Vendas B2B, Liderança..."
                      value={branding.expertise}
                      onChange={e => setBranding({ ...branding, expertise: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="value">Proposta de valor</Label>
                    <Textarea
                      id="value"
                      placeholder="O que você oferece de único para sua audiência?"
                      value={branding.value}
                      onChange={e => setBranding({ ...branding, value: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="position">Cargo / Posição</Label>
                    <Input
                      id="position"
                      placeholder="Ex: CEO, Diretor de Marketing, Consultor..."
                      value={branding.position}
                      onChange={e => setBranding({ ...branding, position: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="languageStyle">Estilo de linguagem</Label>
                    <Textarea
                      id="languageStyle"
                      placeholder="Preferências de escrita: usa gírias? é formal? escreve curto? usa analogias?"
                      value={branding.languageStyle}
                      onChange={e => setBranding({ ...branding, languageStyle: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contentPillars">Pilares de conteúdo</Label>
                    <Textarea
                      id="contentPillars"
                      placeholder="Os 2-4 temas que você aborda no LinkedIn, separados por vírgula"
                      value={branding.contentPillars}
                      onChange={e => setBranding({ ...branding, contentPillars: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Separe por vírgula. A IA garante que todo conteúdo se encaixe nesses pilares.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t.common.saving}</>
                  ) : (
                    t.common.saveChanges
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
