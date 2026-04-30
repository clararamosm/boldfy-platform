'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/dashboard/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, User, CheckCircle2, RotateCcw, Send, Trash2 } from 'lucide-react';
import { getAuthToken } from '@/lib/auth-client';
import {
  uploadProfilePdf,
  getLinkedInProfile,
  saveProfileEdits,
  publishProfile,
  resetProfile,
} from '@/app/actions/profile-optimizer';
import { ProfileEditor } from '@/components/profile-optimizer/profile-editor';
import { ProfilePreview } from '@/components/profile-optimizer/profile-preview';
import { AlignmentScoreBadge } from '@/components/profile-optimizer/alignment-score-badge';
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
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<LinkedInProfileOptimization | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [editedSuggestions, setEditedSuggestions] = useState<LinkedInProfileSuggestions | null>(null);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | undefined>();
  const [profileBannerUrl, setProfileBannerUrl] = useState<string | undefined>();

  // Arquivo de print pendente (para enviar junto com o PDF)
  const [pendingScreenshot, setPendingScreenshot] = useState<File | null>(null);

  // Polling durante 'processing'
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchProfile = useCallback(async () => {
    const token = await getAuthToken();
    const result = await getLinkedInProfile(token, tlId);
    if (result.profile) {
      setProfile(result.profile);
      if (result.profile.avatarUrl) setProfileAvatarUrl(result.profile.avatarUrl);
      if (result.profile.bannerUrl) setProfileBannerUrl(result.profile.bannerUrl);
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

  async function handleUpload() {
    const pdfFile = pdfInputRef.current?.files?.[0];
    if (!pdfFile || pdfFile.type !== 'application/pdf') {
      toast({ variant: 'destructive', description: 'Envie um arquivo PDF.' });
      return;
    }
    if (pdfFile.size > 10 * 1024 * 1024) {
      toast({ variant: 'destructive', description: 'PDF muito grande. Máximo: 10 MB.' });
      return;
    }

    setUploading(true);
    try {
      const pdfBuffer = await pdfFile.arrayBuffer();
      const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');

      // Converter print para base64 se existir
      let screenshotBase64: string | undefined;
      let screenshotMimeType: string | undefined;
      if (pendingScreenshot) {
        const ssBuffer = await pendingScreenshot.arrayBuffer();
        screenshotBase64 = Buffer.from(ssBuffer).toString('base64');
        screenshotMimeType = pendingScreenshot.type;
      }

      const token = await getAuthToken();
      const result = await uploadProfilePdf(token, tlId, pdfBase64, screenshotBase64, screenshotMimeType);
      if (result.error) throw new Error(result.error);

      toast({ description: pendingScreenshot
        ? 'PDF + print enviados! Processando perfil...'
        : 'PDF enviado! Processando perfil...' });

      setProfile({
        current: null,
        suggestions: null,
        edited: null,
        editedAt: null,
        status: 'processing',
        publishedAt: null,
      });
      setPendingScreenshot(null);
    } catch (err) {
      toast({ variant: 'destructive', description: err instanceof Error ? err.message : 'Erro ao enviar.' });
    } finally {
      setUploading(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
      if (screenshotInputRef.current) screenshotInputRef.current.value = '';
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

  async function handleReset() {
    if (!confirm('Tem certeza? Isso apagará todos os dados do perfil e você precisará fazer um novo upload.')) return;
    setResetting(true);
    try {
      const token = await getAuthToken();
      const result = await resetProfile(token, tlId);
      if (result.error) throw new Error(result.error);
      toast({ description: 'Perfil resetado. Faça um novo upload para começar.' });
      setProfile({ current: null, suggestions: null, edited: null, editedAt: null, status: 'empty', publishedAt: null });
      setEditedSuggestions(null);
      setProfileAvatarUrl(undefined);
      setProfileBannerUrl(undefined);
      setPendingScreenshot(null);
    } catch (err) {
      toast({ variant: 'destructive', description: err instanceof Error ? err.message : 'Erro ao resetar.' });
    } finally {
      setResetting(false);
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
            <UploadForm
              pdfInputRef={pdfInputRef}
              screenshotInputRef={screenshotInputRef}
              pendingScreenshot={pendingScreenshot}
              onPendingScreenshot={setPendingScreenshot}
              onUpload={handleUpload}
              uploading={uploading}
            />
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={handleReset} disabled={resetting}>
              {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Começar de novo
            </Button>
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
                Opcionalmente, anexe também um print do perfil (do topo até o Destaque)
                para que a IA extraia as competências fixadas e os cards de destaque com mais precisão.
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
            <UploadForm
              pdfInputRef={pdfInputRef}
              screenshotInputRef={screenshotInputRef}
              pendingScreenshot={pendingScreenshot}
              onPendingScreenshot={setPendingScreenshot}
              onUpload={handleUpload}
              uploading={uploading}
            />
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
        <div className="flex items-center gap-2 flex-wrap">
          {/* Começar de novo */}
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-destructive"
            onClick={handleReset}
            disabled={resetting}
            title="Apaga todos os dados e permite um novo upload"
          >
            {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Começar de novo
          </Button>
          {/* Re-upload */}
          <div>
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                // Apenas seleciona — não dispara upload ainda
                // O usuário pode querer adicionar print antes de enviar
                // O upload é disparado pelo próprio UploadForm inline abaixo
                if (e.target.files?.[0]) handleUpload();
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => pdfInputRef.current?.click()}
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

      {/* Score antes/depois (só quando currentAlignment disponível) */}
      {profile.currentAlignment && activeSuggestions?.semanticAlignment && (
        <div className="rounded-lg border bg-gray-50 p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Score 360Brew — Antes vs. Depois
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Perfil atual</p>
              <AlignmentScoreBadge alignment={profile.currentAlignment} showIssues={false} compact />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-violet-600 font-medium">Perfil otimizado</p>
              <AlignmentScoreBadge alignment={activeSuggestions.semanticAlignment} showIssues={false} compact />
            </div>
          </div>
        </div>
      )}

      {/* Layout split: editor + preview */}
      {activeSuggestions && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Editor */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Editor</h2>
            <ProfileEditor
              initial={activeSuggestions}
              aiSuggestions={aiSuggestions}
              currentProfile={profile.current}
              tlUserId={tlId}
              onChange={setEditedSuggestions}
              onAvatarUrl={setProfileAvatarUrl}
              onBannerUrl={setProfileBannerUrl}
            />
          </div>

          {/* Preview */}
          <div className="space-y-2 sticky top-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Preview</h2>
            <ProfilePreview
              suggestions={activeSuggestions}
              tlName={tlName}
              tlAvatarUrl={tlAvatarUrl}
              profileAvatarUrl={profileAvatarUrl}
              profileBannerUrl={profileBannerUrl}
              readOnly={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componente de upload unificado PDF + print ────────────────────────────────

function UploadForm({
  pdfInputRef,
  screenshotInputRef,
  pendingScreenshot,
  onPendingScreenshot,
  onUpload,
  uploading,
}: {
  pdfInputRef: { current: HTMLInputElement | null };
  screenshotInputRef: { current: HTMLInputElement | null };
  pendingScreenshot: File | null;
  onPendingScreenshot: (f: File | null) => void;
  onUpload: () => void;
  uploading: boolean;
}) {
  const [pendingPdf, setPendingPdf] = useState<File | null>(null);

  return (
    <div className="w-full max-w-sm space-y-3">
      {/* PDF — obrigatório */}
      <div>
        <input
          ref={pdfInputRef as React.RefObject<HTMLInputElement>}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => setPendingPdf(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => pdfInputRef.current?.click()}
          disabled={uploading}
          className={cn(
            'w-full text-sm border rounded-lg px-3 py-2.5 flex items-center justify-center gap-2 transition-colors',
            pendingPdf
              ? 'border-violet-300 bg-violet-50 text-violet-700 font-medium'
              : 'border-gray-200 hover:border-violet-300 text-muted-foreground hover:text-violet-600 bg-gray-50',
          )}
        >
          <Upload className="h-4 w-4 shrink-0" />
          {pendingPdf ? pendingPdf.name : 'Selecionar PDF do perfil'}
        </button>
        <p className="text-[11px] text-muted-foreground mt-1 text-center">
          Exporte no LinkedIn: Perfil → Mais → Salvar como PDF
        </p>
      </div>

      {/* Print — opcional */}
      <div>
        <input
          ref={screenshotInputRef as React.RefObject<HTMLInputElement>}
          type="file"
          accept="image/jpeg,image/png,image/jpg"
          className="hidden"
          onChange={(e) => onPendingScreenshot(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => screenshotInputRef.current?.click()}
          disabled={uploading}
          className={cn(
            'w-full text-xs border border-dashed rounded-lg px-3 py-2 flex items-center justify-center gap-1.5 transition-colors',
            pendingScreenshot
              ? 'border-violet-300 bg-violet-50 text-violet-700'
              : 'border-gray-200 hover:border-violet-300 text-muted-foreground hover:text-violet-600',
          )}
        >
          <Upload className="h-3.5 w-3.5 shrink-0" />
          {pendingScreenshot
            ? pendingScreenshot.name
            : '+ Print do perfil (opcional — melhora competências e destaque)'}
        </button>
      </div>

      {/* Botão de envio — só aparece com PDF selecionado */}
      {pendingPdf && !uploading && (
        <Button
          onClick={onUpload}
          className="w-full gap-2"
        >
          <Upload className="h-4 w-4" />
          {pendingScreenshot ? 'Analisar PDF + print' : 'Analisar PDF'}
        </Button>
      )}

      {uploading && (
        <div className="flex items-center justify-center gap-2 text-sm text-violet-600 py-1">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Enviando e processando...</span>
        </div>
      )}
    </div>
  );
}
