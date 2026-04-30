'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/dashboard/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, User, CheckCircle2, RotateCcw, Send, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { getAuthToken } from '@/lib/auth-client';
import {
  uploadProfilePdf,
  getLinkedInProfile,
  saveProfileEdits,
  publishProfile,
  resetProfile,
} from '@/app/actions/profile-optimizer';
import { ProfilePreview } from '@/components/profile-optimizer/profile-preview';
import { ProfileEditablePreview } from '@/components/profile-optimizer/profile-editable-preview';
import { AlignmentScoreBadge } from '@/components/profile-optimizer/alignment-score-badge';
import type {
  LinkedInProfileOptimization,
  LinkedInProfileSuggestions,
  LinkedInProfileCurrent,
} from '@/lib/linkedin-analytics-types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Helper — converter current para formato de preview read-only
// ---------------------------------------------------------------------------

function currentToPreview(current: LinkedInProfileCurrent): LinkedInProfileSuggestions {
  return {
    headline: current.headline,
    about: current.about,
    topSkills: current.topSkills,
    experiences: current.experiences.map((e) => ({ ...e, action: 'keep' as const })),
    featuredItems: current.featuredItems.map((f) => ({ ...f, action: 'keep' as const, rationale: '' })),
    semanticAlignment: { score: 0, passesAudit: false, issues: [] },
    editedAt: '',
  };
}

// ---------------------------------------------------------------------------
// Página raiz — resolve slugs e delega para o editor
// ---------------------------------------------------------------------------

export default function StrategistPerfilPage() {
  const searchParams = useSearchParams();
  const companySlug = searchParams.get('c');
  const tlSlug = searchParams.get('tl');

  const [tlId, setTlId] = useState<string | null>(null);
  const [tlName, setTlName] = useState('');
  const [tlAvatarUrl, setTlAvatarUrl] = useState<string | undefined>();
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    if (!companySlug || !tlSlug) { setTlId(null); return; }
    const resolve = async () => {
      setIsResolving(true);
      try {
        const token = await getAuthToken();
        const { resolveSlugs } = await import('@/app/actions/content-pipeline');
        const result = await resolveSlugs(token, companySlug, tlSlug);
        if (result.tlId) {
          setTlId(result.tlId);
          setTlName(result.tlName ?? '');
        } else setTlId(null);
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
              <User className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Selecione um Thought Leader para otimizar o perfil.
              </p>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  if (isResolving || !tlId) {
    return (
      <>
        <Header title="Otimizador de Perfil" />
        <main className="flex-1 overflow-auto p-4 md:p-6 flex items-center justify-center">
          {isResolving
            ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            : <p className="text-sm text-muted-foreground">Thought Leader não encontrado.</p>}
        </main>
      </>
    );
  }

  return (
    <>
      <Header title="Otimizador de Perfil" />
      <ProfileOptimizerEditor tlId={tlId} tlName={tlName} tlAvatarUrl={tlAvatarUrl} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Editor principal
// ---------------------------------------------------------------------------

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
  const screenshotInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<LinkedInProfileOptimization | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [pendingScreenshot, setPendingScreenshot] = useState<File | null>(null);

  // Fotos do perfil (URLs do Storage — para passar para o preview)
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [profileBannerUrl, setProfileBannerUrl] = useState<string | null>(null);

  // Estado local de edição (sincronizado com profile.edited)
  const [editedSuggestions, setEditedSuggestions] = useState<LinkedInProfileSuggestions | null>(null);

  // Polling ref
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────

  async function fetchProfile() {
    try {
      const token = await getAuthToken();
      const result = await getLinkedInProfile(token, tlId);
      if (result.profile) {
        setProfile(result.profile);
        setProfileAvatarUrl(result.profile.avatarUrl ?? null);
        setProfileBannerUrl(result.profile.bannerUrl ?? null);
        if (result.profile.edited) {
          setEditedSuggestions(result.profile.edited);
        }
      }
    } catch (err) {
      toast({ variant: 'destructive', description: 'Erro ao carregar perfil.' });
    }
  }

  useEffect(() => {
    setLoading(true);
    fetchProfile().finally(() => setLoading(false));
  }, [tlId]);

  // Polling durante status=processing
  useEffect(() => {
    if (profile?.status === 'processing') {
      pollingRef.current = setInterval(async () => {
        const token = await getAuthToken();
        const result = await getLinkedInProfile(token, tlId);
        if (result.profile && result.profile.status !== 'processing') {
          setProfile(result.profile);
          setProfileAvatarUrl(result.profile.avatarUrl ?? null);
          setProfileBannerUrl(result.profile.bannerUrl ?? null);
          if (result.profile.edited) setEditedSuggestions(result.profile.edited);
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      }, 3000);
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [profile?.status, tlId]);

  // ── Upload ───────────────────────────────────────────────────────────────

  async function handleUpload(pdfFile: File, screenshotFile: File | null) {
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

      let screenshotBase64: string | undefined;
      let screenshotMimeType: string | undefined;
      if (screenshotFile) {
        const ssBuffer = await screenshotFile.arrayBuffer();
        screenshotBase64 = Buffer.from(ssBuffer).toString('base64');
        screenshotMimeType = screenshotFile.type;
      }

      const token = await getAuthToken();
      const result = await uploadProfilePdf(token, tlId, pdfBase64, screenshotBase64, screenshotMimeType);
      if (result.error) throw new Error(result.error);

      toast({ description: screenshotFile ? 'PDF + print enviados!' : 'PDF enviado! Lendo perfil...' });
      setEditedSuggestions(null);
      setProfile({ current: null, suggestions: null, edited: null, editedAt: null, status: 'processing', publishedAt: null });
      setPendingScreenshot(null);
    } catch (err) {
      toast({ variant: 'destructive', description: err instanceof Error ? err.message : 'Erro ao enviar.' });
    } finally {
      setUploading(false);
      if (screenshotInputRef.current) screenshotInputRef.current.value = '';
    }
  }

  // ── Salvar ───────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!editedSuggestions) return;
    setSaving(true);
    try {
      const token = await getAuthToken();
      const result = await saveProfileEdits(token, tlId, editedSuggestions);
      if (result.error) throw new Error(result.error);
      toast({ description: 'Rascunho salvo!' });
    } catch (err) {
      toast({ variant: 'destructive', description: err instanceof Error ? err.message : 'Erro ao salvar.' });
    } finally {
      setSaving(false);
    }
  }

  // ── Publicar ─────────────────────────────────────────────────────────────

  async function handlePublish() {
    if (saving) return;
    // Salva primeiro, depois publica
    if (editedSuggestions) {
      setSaving(true);
      try {
        const token = await getAuthToken();
        await saveProfileEdits(token, tlId, editedSuggestions);
      } catch {
        toast({ variant: 'destructive', description: 'Erro ao salvar antes de publicar.' });
        setSaving(false);
        return;
      }
      setSaving(false);
    }

    setPublishing(true);
    try {
      const token = await getAuthToken();
      const result = await publishProfile(token, tlId);
      if (result.error) throw new Error(result.error);
      toast({ description: 'Perfil publicado para o Thought Leader!' });
      await fetchProfile();
    } catch (err) {
      toast({ variant: 'destructive', description: err instanceof Error ? err.message : 'Erro ao publicar.' });
    } finally {
      setPublishing(false);
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  async function handleReset() {
    setResetting(true);
    try {
      const token = await getAuthToken();
      const result = await resetProfile(token, tlId);
      if (result.error) throw new Error(result.error);
      setProfile({ current: null, suggestions: null, edited: null, editedAt: null, status: 'empty', publishedAt: null });
      setEditedSuggestions(null);
      setProfileAvatarUrl(null);
      setProfileBannerUrl(null);
      toast({ description: 'Perfil resetado.' });
    } catch (err) {
      toast({ variant: 'destructive', description: err instanceof Error ? err.message : 'Erro ao resetar.' });
    } finally {
      setResetting(false);
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="flex-1 overflow-auto p-4 md:p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  // ── Estado vazio ──────────────────────────────────────────────────────────

  if (!profile || profile.status === 'empty') {
    return (
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-sm mx-auto mt-12 flex flex-col items-center gap-6">
          <div className="h-16 w-16 rounded-full bg-violet-50 flex items-center justify-center">
            <User className="h-8 w-8 text-violet-400" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold mb-1">Enviar PDF do perfil</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Exporte o perfil do LinkedIn como PDF e envie aqui. O sistema lê o perfil e prepara os campos para edição.
            </p>
            <a
              href="https://www.linkedin.com/help/linkedin/answer/4281"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-violet-600 hover:underline block mb-6"
            >
              Como exportar o PDF no LinkedIn →
            </a>
          </div>
          <UploadForm
            screenshotInputRef={screenshotInputRef}
            pendingScreenshot={pendingScreenshot}
            onPendingScreenshot={setPendingScreenshot}
            onUpload={handleUpload}
            uploading={uploading}
          />
        </div>
      </main>
    );
  }

  // ── Estado de processamento ────────────────────────────────────────────────

  if (profile.status === 'processing') {
    return (
      <main className="flex-1 overflow-auto p-4 md:p-6 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500 mx-auto" />
          <p className="text-sm font-medium text-gray-700">Lendo o perfil...</p>
          <p className="text-xs text-muted-foreground">Isso leva alguns segundos</p>
        </div>
      </main>
    );
  }

  // ── Estado de erro ────────────────────────────────────────────────────────

  if (profile.status === 'error') {
    return (
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-sm mx-auto mt-12 flex flex-col items-center gap-4">
          <div className="text-center">
            <h2 className="text-lg font-semibold mb-1 text-red-600">Erro ao processar</h2>
            {profile.errorMessage && (
              <p className="text-xs text-muted-foreground bg-red-50 border border-red-200 rounded p-2 mt-2">
                {profile.errorMessage}
              </p>
            )}
          </div>
          <UploadForm
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
        </div>
      </main>
    );
  }

  // ── Estado ready / published ──────────────────────────────────────────────

  const currentPreview = profile.current ? currentToPreview(profile.current) : null;
  const activeEdited = editedSuggestions;

  return (
    <main className="flex-1 overflow-auto p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4">

        {/* Barra de ações */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saving || !editedSuggestions}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
            {saving ? 'Salvando...' : 'Salvar rascunho'}
          </Button>

          <Button
            size="sm"
            className="gap-2 bg-violet-600 hover:bg-violet-700"
            onClick={handlePublish}
            disabled={publishing || saving || !editedSuggestions}
          >
            {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {publishing ? 'Publicando...' : profile.status === 'published' ? 'Republicar' : 'Publicar para TL'}
          </Button>

          {profile.status === 'published' && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
              <CheckCircle2 className="h-3 w-3" />
              Publicado
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            <ReUploadButton
              screenshotInputRef={screenshotInputRef}
              pendingScreenshot={pendingScreenshot}
              onPendingScreenshot={setPendingScreenshot}
              onUpload={handleUpload}
              uploading={uploading}
            />
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={handleReset} disabled={resetting}>
              {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Resetar
            </Button>
          </div>
        </div>

        {/* Comparativo lado a lado */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* ANTES — read-only */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Antes</span>
              <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">Perfil atual</span>
              {profile.currentAlignment && (
                <AlignmentScoreBadge alignment={profile.currentAlignment} showIssues={false} compact />
              )}
            </div>
            {currentPreview ? (
              <div className="opacity-80 grayscale">
                <ProfilePreview
                  suggestions={currentPreview}
                  tlName={tlName}
                  tlAvatarUrl={tlAvatarUrl}
                  profileAvatarUrl={profileAvatarUrl ?? undefined}
                  profileBannerUrl={profileBannerUrl ?? undefined}
                  readOnly={true}
                  variant="before"
                />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed bg-gray-50 p-8 text-center text-sm text-muted-foreground">
                Perfil original não disponível
              </div>
            )}
          </div>

          {/* DEPOIS — editável */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Depois</span>
              <span className="text-xs bg-violet-50 text-violet-700 border border-violet-200 rounded-full px-2 py-0.5">
                Editável
              </span>
              {(activeEdited?.semanticAlignment?.score ?? 0) > 0 && activeEdited?.semanticAlignment && (
                <AlignmentScoreBadge alignment={activeEdited.semanticAlignment} showIssues={false} compact />
              )}
            </div>
            {activeEdited ? (
              <ProfileEditablePreview
                data={activeEdited}
                tlName={tlName}
                tlUserId={tlId}
                tlAvatarUrl={tlAvatarUrl}
                profileAvatarUrl={profileAvatarUrl}
                profileBannerUrl={profileBannerUrl}
                onChange={setEditedSuggestions}
                onAvatarUrl={setProfileAvatarUrl}
                onBannerUrl={setProfileBannerUrl}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/30 p-8 text-center text-sm text-muted-foreground">
                Aguardando leitura do perfil...
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// UploadForm — PDF + print opcional
// ---------------------------------------------------------------------------

type UploadHandler = (pdf: File, screenshot: File | null) => void;

function UploadForm({
  screenshotInputRef,
  pendingScreenshot,
  onPendingScreenshot,
  onUpload,
  uploading,
}: {
  screenshotInputRef: { current: HTMLInputElement | null };
  pendingScreenshot: File | null;
  onPendingScreenshot: (f: File | null) => void;
  onUpload: UploadHandler;
  uploading: boolean;
}) {
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [pendingPdf, setPendingPdf] = useState<File | null>(null);

  return (
    <div className="w-full max-w-sm space-y-3">
      {/* PDF */}
      <div>
        <input
          ref={pdfInputRef}
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

      {/* Botão de envio */}
      {pendingPdf && !uploading && (
        <Button onClick={() => onUpload(pendingPdf, pendingScreenshot)} className="w-full gap-2">
          <Upload className="h-4 w-4" />
          {pendingScreenshot ? 'Enviar PDF + print' : 'Enviar PDF'}
        </Button>
      )}

      {uploading && (
        <div className="flex items-center justify-center gap-2 text-sm text-violet-600 py-1">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Enviando e lendo perfil...</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReUploadButton — dropdown no modo ready/published
// ---------------------------------------------------------------------------

function ReUploadButton({
  screenshotInputRef,
  pendingScreenshot,
  onPendingScreenshot,
  onUpload,
  uploading,
}: {
  screenshotInputRef: { current: HTMLInputElement | null };
  pendingScreenshot: File | null;
  onPendingScreenshot: (f: File | null) => void;
  onUpload: UploadHandler;
  uploading: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => setOpen((v) => !v)}
        disabled={uploading}
      >
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
        Re-enviar PDF
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-20 bg-white border rounded-xl shadow-xl p-4 w-80">
          <UploadForm
            screenshotInputRef={screenshotInputRef}
            pendingScreenshot={pendingScreenshot}
            onPendingScreenshot={onPendingScreenshot}
            onUpload={(pdf, ss) => { onUpload(pdf, ss); setOpen(false); }}
            uploading={uploading}
          />
        </div>
      )}
    </div>
  );
}
