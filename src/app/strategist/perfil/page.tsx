'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/dashboard/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, User, CheckCircle2, RotateCcw, Send } from 'lucide-react';
import { getAuthToken } from '@/lib/auth-client';
import {
  uploadProfilePdf,
  getLinkedInProfile,
  saveProfileEdits,
  publishProfile,
} from '@/app/actions/profile-optimizer';
import { ProfileEditor } from '@/components/profile-optimizer/profile-editor';
import { ProfilePreview } from '@/components/profile-optimizer/profile-preview';
import type {
  LinkedInProfileOptimization,
  LinkedInProfileSuggestions,
} from '@/lib/linkedin-analytics-types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function StrategistPerfilPage() {
  const searchParams = useSearchParams();
  const companySlug = searchParams.get('c');
  const tlSlug = searchParams.get('tl');

  const [tlId, setTlId] = useState<string | null>(null);
  const [tlName, setTlName] = useState('');
  const [tlAvatarUrl, setTlAvatarUrl] = useState<string | undefined>();
  const [isResolving, setIsResolving] = useState(false);

  // Resolver slug → ID
  useEffect(() => {
    if (!companySlug || !tlSlug) { setTlId(null); return; }
    const resolve = async () => {
      setIsResolving(true);
      try {
        const token = await getAuthToken();
        const { resolveSlugs } = await import('@/app/actions/content-pipeline');
        const result = await resolveSlugs(token, companySlug, tlSlug);
        if (result.tlId) { setTlId(result.tlId); setTlName(result.tlName ?? ''); }
        else setTlId(null);
      } catch { setTlId(null); }
      finally { setIsResolving(false); }
    };
    resolve();
  }, [companySlug, tlSlug]);

  if (!tlSlug || !companySlug) {
    return (
      <>
        <Header title="Otimizador de Perfil" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Card>
            <CardContent className="py-14 text-center">
              <User className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                Selecione um perfil no menu lateral para otimizar.
              </p>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  if (isResolving || (!tlId && tlSlug)) {
    return (
      <>
        <Header title="Otimizador de Perfil" />
        <main className="flex-1 overflow-auto p-4 md:p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </main>
      </>
    );
  }

  if (!tlId) {
    return (
      <>
        <Header title="Otimizador de Perfil" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Card>
            <CardContent className="py-14 text-center">
              <p className="text-sm text-muted-foreground">Perfil não encontrado.</p>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <Header title={`Perfil${tlName ? ` — ${tlName}` : ''}`} />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <ProfileOptimizerEditor tlId={tlId} tlName={tlName} tlAvatarUrl={tlAvatarUrl} />
      </main>
    </>
  );
}

// ── Editor principal ─────────────────────────────────────────────────────────

function ProfileOptimizerEditor({
  tlId,
  tlName,
  tlAvatarUrl,
}: {
  tlId: string;
  tlName: string;
  tlAvatarUrl?: string;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<LinkedInProfileOptimization | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [editedSuggestions, setEditedSuggestions] = useState<LinkedInProfileSuggestions | null>(null);

  // Polling durante 'processing'
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchProfile = useCallback(async () => {
    const token = await getAuthToken();
    const result = await getLinkedInProfile(token, tlId);
    if (result.profile) {
      setProfile(result.profile);
      // Inicializar editedSuggestions com edited (se existir) ou suggestions
      if (result.profile.edited) setEditedSuggestions(result.profile.edited);
      else if (result.profile.suggestions) setEditedSuggestions(result.profile.suggestions);
    }
  }, [tlId]);

  useEffect(() => {
    setLoading(true);
    fetchProfile().finally(() => setLoading(false));
  }, [tlId]);

  // Polling quando status = processing
  useEffect(() => {
    if (profile?.status === 'processing') {
      pollingRef.current = setInterval(async () => {
        const token = await getAuthToken();
        const result = await getLinkedInProfile(token, tlId);
        if (result.profile && result.profile.status !== 'processing') {
          setProfile(result.profile);
          if (result.profile.edited) setEditedSuggestions(result.profile.edited);
          else if (result.profile.suggestions) setEditedSuggestions(result.profile.suggestions);
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      }, 3000);
    }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [profile?.status, tlId]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      toast({ variant: 'destructive', description: 'Envie um arquivo PDF.' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: 'destructive', description: 'Arquivo muito grande. Máximo: 10 MB.' });
      return;
    }

    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const token = await getAuthToken();
      const result = await uploadProfilePdf(token, tlId, base64);
      if (result.error) throw new Error(result.error);

      toast({ description: 'PDF enviado! Processando perfil...' });
      setProfile({
        current: null,
        suggestions: null,
        edited: null,
        editedAt: null,
        status: 'processing',
        publishedAt: null,
      });
    } catch (err) {
      toast({ variant: 'destructive', description: err instanceof Error ? err.message : 'Erro ao enviar PDF.' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSave() {
    if (!editedSuggestions) return;
    setSaving(true);
    try {
      const token = await getAuthToken();
      const result = await saveProfileEdits(token, tlId, editedSuggestions);
      if (result.error) throw new Error(result.error);
      toast({ description: 'Edições salvas!' });
    } catch (err) {
      toast({ variant: 'destructive', description: err instanceof Error ? err.message : 'Erro ao salvar.' });
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      const token = await getAuthToken();
      // Salvar edições antes de publicar
      if (editedSuggestions) {
        await saveProfileEdits(token, tlId, editedSuggestions);
      }
      const result = await publishProfile(token, tlId);
      if (result.error) throw new Error(result.error);
      toast({ description: 'Perfil publicado para o TL! ✓' });
      await fetchProfile();
    } catch (err) {
      toast({ variant: 'destructive', description: err instanceof Error ? err.message : 'Erro ao publicar.' });
    } finally {
      setPublishing(false);
    }
  }

  // ── Render ──

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Estado de erro
  if (profile?.status === 'error') {
    return (
      <div className="max-w-xl mx-auto mt-8">
        <Card>
          <CardContent className="py-12 flex flex-col items-center text-center gap-5">
            <div className="h-16 w-16 rounded-full bg-red-50 flex items-center justify-center">
              <Upload className="h-8 w-8 text-red-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold mb-1 text-red-600">Erro no processamento</h2>
              <p className="text-sm text-muted-foreground max-w-sm mb-2">
                Ocorreu um erro ao analisar o PDF. Verifique os logs do servidor.
              </p>
              {profile.errorMessage && (
                <p className="text-xs font-mono bg-red-50 text-red-700 rounded p-2 max-w-sm text-left break-all">
                  {profile.errorMessage}
                </p>
              )}
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                variant="outline"
                className="gap-2"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? 'Enviando...' : 'Tentar novamente'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Estado vazio
  if (!profile || profile.status === 'empty') {
    return (
      <div className="max-w-xl mx-auto mt-8">
        <Card>
          <CardContent className="py-12 flex flex-col items-center text-center gap-5">
            <div className="h-16 w-16 rounded-full bg-violet-50 flex items-center justify-center">
              <Upload className="h-8 w-8 text-violet-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold mb-1">Enviar PDF do Perfil</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Exporte o perfil do LinkedIn do TL como PDF e envie aqui.
                A IA vai analisar e gerar sugestões de otimização para o algoritmo 360Brew.
              </p>
              <a
                href="https://www.linkedin.com/in/"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-violet-600 hover:underline block mt-2"
              >
                Como exportar o PDF no LinkedIn →
              </a>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="gap-2"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? 'Enviando...' : 'Selecionar PDF'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Estado processing
  if (profile.status === 'processing') {
    return (
      <div className="max-w-xl mx-auto mt-8">
        <Card>
          <CardContent className="py-12 flex flex-col items-center text-center gap-5">
            <Loader2 className="h-12 w-12 animate-spin text-violet-600" />
            <div>
              <h2 className="text-lg font-semibold mb-1">Analisando perfil...</h2>
              <p className="text-sm text-muted-foreground">
                A IA está lendo o PDF, verificando o Brand Context e gerando sugestões de otimização.
                Isso pode levar até 1 minuto.
              </p>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground w-full max-w-xs text-left">
              {[
                'PDF recebido',
                'Extraindo perfil atual...',
                'Lendo Brand Context e pilares...',
                'Gerando sugestões de otimização...',
                'Calculando score 360Brew...',
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  {i === 0 ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin text-violet-400 shrink-0" />
                  )}
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Estado ready / published
  const activeSuggestions = editedSuggestions || profile.suggestions;
  const aiSuggestions = profile.suggestions!;

  return (
    <div className="space-y-4">
      {/* Barra de ações */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {profile.status === 'published' && (
            <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Publicado para o TL
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Re-upload */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Re-enviar PDF
            </Button>
          </div>
          {/* Salvar rascunho */}
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {saving ? 'Salvando...' : 'Salvar rascunho'}
          </Button>
          {/* Publicar */}
          <Button size="sm" className="gap-2" onClick={handlePublish} disabled={publishing}>
            {publishing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {publishing ? 'Publicando...' : 'Publicar para TL'}
          </Button>
        </div>
      </div>

      {/* Layout split: editor + preview */}
      {activeSuggestions && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Editor */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Editor</h2>
            <ProfileEditor
              initial={activeSuggestions}
              aiSuggestions={aiSuggestions}
              tlUserId={tlId}
              onChange={setEditedSuggestions}
            />
          </div>

          {/* Preview */}
          <div className="space-y-2 sticky top-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Preview</h2>
            <ProfilePreview
              suggestions={activeSuggestions}
              tlName={tlName}
              tlAvatarUrl={tlAvatarUrl}
              readOnly={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}
