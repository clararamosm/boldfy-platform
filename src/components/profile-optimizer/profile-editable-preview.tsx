'use client';

import { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type {
  LinkedInProfileSuggestions,
  ProfileExperienceSuggestion,
  ProfileFeaturedItemSuggestion,
  ProfileSemanticAlignment,
} from '@/lib/linkedin-analytics-types';
import { Copy, ExternalLink, Info, Camera, ImagePlus, Loader2, Sparkles, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { AlignmentScoreBadge } from '@/components/profile-optimizer/alignment-score-badge';
import { uploadProfileImage, calculateOptimizedScore } from '@/app/actions/profile-optimizer';
import { getAuthToken } from '@/lib/auth-client';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface ProfileEditablePreviewProps {
  data: LinkedInProfileSuggestions;
  tlName: string;
  tlUserId: string;
  tlAvatarUrl?: string;
  profileAvatarUrl?: string | null;
  profileBannerUrl?: string | null;
  onChange: (updated: LinkedInProfileSuggestions) => void;
  onAvatarUrl?: (url: string) => void;
  onBannerUrl?: (url: string) => void;
  onScoreGenerated?: (alignment: ProfileSemanticAlignment) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function CopyButton({ text, label }: { text: string; label?: string }) {
  const { toast } = useToast();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        toast({ description: label ? `${label} copiado!` : 'Copiado!' });
      }}
      title="Copiar"
    >
      <Copy className="h-3.5 w-3.5" />
    </Button>
  );
}

// Campo de texto editável inline: clica no texto → vira input/textarea
function InlineText({
  value,
  onChange,
  multiline = false,
  rows = 3,
  placeholder = '',
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    const sharedClass = cn(
      'w-full border border-violet-300 rounded-md bg-violet-50/40 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400 resize-none',
      className,
    );
    if (multiline) {
      return (
        <textarea
          autoFocus
          value={value}
          rows={rows}
          className={sharedClass}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
        />
      );
    }
    return (
      <input
        autoFocus
        value={value}
        className={sharedClass}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
      />
    );
  }

  // Campos multiline usam div (block) para suportar whitespace-pre-line e ocupar toda a largura
  const Tag = multiline ? 'div' : 'span';
  return (
    <Tag
      onClick={() => setEditing(true)}
      title="Clique para editar"
      className={cn(
        'cursor-text hover:bg-violet-50 hover:outline hover:outline-1 hover:outline-violet-200 rounded px-0.5 -mx-0.5 transition-colors',
        multiline && 'whitespace-pre-line w-full',
        !value && 'text-gray-400 italic',
        className,
      )}
    >
      {value || placeholder}
    </Tag>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function ProfileEditablePreview({
  data,
  tlName,
  tlUserId,
  tlAvatarUrl,
  profileAvatarUrl,
  profileBannerUrl,
  onChange,
  onAvatarUrl,
  onBannerUrl,
  onScoreGenerated,
}: ProfileEditablePreviewProps) {
  const { toast } = useToast();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [generatingScore, setGeneratingScore] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // URL de preview local (prioridade: local blob → Storage URL → auth avatar)
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);
  const [localBannerUrl, setLocalBannerUrl] = useState<string | null>(null);
  const avatarSrc = localAvatarUrl || profileAvatarUrl || tlAvatarUrl;
  const bannerSrc = localBannerUrl || profileBannerUrl;

  const hasScore = data.semanticAlignment?.score > 0;

  // ── Upload de foto inline ──────────────────────────────────────────────────

  async function handleImageUpload(
    file: File,
    type: 'avatar' | 'banner',
    setLocalUrl: (url: string) => void,
    setUploading: (v: boolean) => void,
    onUrl?: (url: string) => void,
  ) {
    setUploading(true);
    setLocalUrl(URL.createObjectURL(file)); // preview imediato
    try {
      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const token = await getAuthToken();
      const result = await uploadProfileImage(token, tlUserId, type, base64, file.type);
      if (result.error) throw new Error(result.error);
      if (result.url) onUrl?.(result.url);
      toast({ description: type === 'avatar' ? 'Foto de perfil enviada!' : 'Capa enviada!' });
    } catch (err) {
      toast({ variant: 'destructive', description: err instanceof Error ? err.message : 'Erro ao enviar.' });
      setLocalUrl('');
    } finally {
      setUploading(false);
    }
  }

  // ── Gerar score ────────────────────────────────────────────────────────────

  async function handleGenerateScore() {
    setGeneratingScore(true);
    try {
      const token = await getAuthToken();
      const result = await calculateOptimizedScore(token, tlUserId, data);
      if (result.error) throw new Error(result.error);
      if (result.alignment) {
        const updated: LinkedInProfileSuggestions = { ...data, semanticAlignment: result.alignment };
        onChange(updated);
        onScoreGenerated?.(result.alignment);
        toast({ description: `Score gerado: ${result.alignment.score}/100` });
      }
    } catch (err) {
      toast({ variant: 'destructive', description: err instanceof Error ? err.message : 'Erro ao gerar score.' });
    } finally {
      setGeneratingScore(false);
    }
  }

  // ── Helpers de update ──────────────────────────────────────────────────────

  const update = useCallback(
    (partial: Partial<LinkedInProfileSuggestions>) => {
      onChange({ ...data, ...partial });
    },
    [data, onChange],
  );

  function updateExp(index: number, updated: ProfileExperienceSuggestion) {
    const next = [...data.experiences];
    next[index] = updated;
    update({ experiences: next });
  }

  function updateFeatured(index: number, updated: ProfileFeaturedItemSuggestion) {
    const next = [...data.featuredItems] as ProfileFeaturedItemSuggestion[];
    next[index] = updated;
    update({ featuredItems: next });
  }

  function updateSkill(index: number, value: string) {
    const next = [...data.topSkills];
    next[index] = value;
    update({ topSkills: next.filter((s, i) => s || i < next.length - 1) });
  }

  function addSkill() {
    if (data.topSkills.length >= 5) return;
    update({ topSkills: [...data.topSkills, ''] });
  }

  function removeSkill(index: number) {
    update({ topSkills: data.topSkills.filter((_, i) => i !== index) });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <TooltipProvider>
      <div className="bg-white rounded-xl border-2 border-violet-300 shadow-sm overflow-hidden font-sans text-sm text-gray-800 max-w-2xl mx-auto">

        {/* Banner com botão de câmera */}
        <div className="h-32 relative group/banner bg-gradient-to-r from-violet-600 to-purple-500">
          {bannerSrc && (
            <img src={bannerSrc} alt="Banner" className="h-full w-full object-cover" />
          )}
          {/* Overlay de upload */}
          <button
            type="button"
            className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover/banner:bg-black/30 transition-colors"
            onClick={() => bannerInputRef.current?.click()}
            title="Trocar capa"
          >
            {uploadingBanner ? (
              <Loader2 className="h-6 w-6 text-white animate-spin" />
            ) : (
              <div className="opacity-0 group-hover/banner:opacity-100 transition-opacity flex items-center gap-1.5 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">
                <ImagePlus className="h-3.5 w-3.5" />
                Trocar capa
              </div>
            )}
          </button>
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/jpeg,image/png,image/jpg"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImageUpload(f, 'banner', setLocalBannerUrl, setUploadingBanner, onBannerUrl);
            }}
          />

          {/* Avatar com botão de câmera */}
          <div className="absolute -bottom-8 left-5 group/avatar">
            <div className="h-16 w-16 rounded-full border-4 border-white bg-gray-200 overflow-hidden relative">
              {avatarSrc ? (
                <img src={avatarSrc} alt={tlName} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-xl font-bold text-gray-500">
                  {tlName.charAt(0).toUpperCase()}
                </div>
              )}
              <button
                type="button"
                className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover/avatar:bg-black/40 rounded-full transition-colors"
                onClick={() => avatarInputRef.current?.click()}
                title="Trocar foto"
              >
                {uploadingAvatar ? (
                  <Loader2 className="h-4 w-4 text-white animate-spin" />
                ) : (
                  <Camera className="h-4 w-4 text-white opacity-0 group-hover/avatar:opacity-100 transition-opacity" />
                )}
              </button>
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImageUpload(f, 'avatar', setLocalAvatarUrl, setUploadingAvatar, onAvatarUrl);
              }}
            />
          </div>
        </div>

        <div className="pt-10 px-5 pb-5 space-y-5">

          {/* Nome + Headline + Seguir */}
          <div className="space-y-2">
            <div className="group flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-gray-900">{tlName}</h2>
                <div className="text-sm text-gray-700 leading-snug mt-0.5">
                  <InlineText
                    value={data.headline}
                    onChange={(v) => update({ headline: v })}
                    placeholder="Headline..."
                    className="leading-snug"
                  />
                </div>
              </div>
              <CopyButton text={data.headline} label="Headline" />
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="flex items-center gap-1.5 rounded-full border border-violet-600 text-violet-700 text-xs font-semibold px-4 py-1.5 cursor-default hover:bg-violet-50 transition-colors">
                    Seguir
                    <Info className="h-3 w-3 opacity-70" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  <p className="font-semibold mb-1">Como ativar o botão Seguir:</p>
                  <p>LinkedIn → Configurações → Visibilidade → Seguidores e conexões → &quot;Todos no LinkedIn podem seguir você&quot;</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Sobre */}
          <div>
            <SectionHeader title="Sobre" />
            <div className="group relative">
              <div className="text-sm text-gray-700 leading-relaxed">
                <InlineText
                  value={data.about}
                  onChange={(v) => update({ about: v })}
                  multiline
                  rows={8}
                  placeholder="Seção Sobre..."
                />
              </div>
              <div className="absolute top-0 right-0">
                <CopyButton text={data.about} label="Sobre" />
              </div>
            </div>
          </div>

          {/* Competências */}
          <div>
            <SectionHeader title="Principais competências" />
            <div className="flex flex-wrap gap-2">
              {data.topSkills.map((skill, i) => (
                <div key={i} className="group/skill flex items-center gap-1">
                  <div className="flex items-center bg-violet-50 border border-violet-200 rounded-full px-3 py-0.5 gap-1">
                    <InlineText
                      value={skill}
                      onChange={(v) => updateSkill(i, v)}
                      placeholder={`Competência ${i + 1}`}
                      className="text-xs font-medium text-violet-700 min-w-[60px]"
                    />
                    <button
                      type="button"
                      onClick={() => removeSkill(i)}
                      className="opacity-0 group-hover/skill:opacity-100 transition-opacity text-violet-400 hover:text-violet-700"
                      title="Remover"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <CopyButton text={skill} label="Competência" />
                </div>
              ))}
              {data.topSkills.length < 5 && (
                <button
                  type="button"
                  onClick={addSkill}
                  className="flex items-center gap-1 text-xs text-violet-500 border border-dashed border-violet-300 rounded-full px-3 py-0.5 hover:bg-violet-50 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Adicionar
                </button>
              )}
            </div>
          </div>

          {/* Destaque */}
          <div>
            <SectionHeader title="Destaque" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 2 }).map((_, i) => {
                const item: ProfileFeaturedItemSuggestion = data.featuredItems[i] ?? {
                  title: '',
                  url: '',
                  action: 'add',
                  rationale: '',
                };
                return (
                  <EditableFeaturedCard
                    key={i}
                    index={i}
                    item={item}
                    onChange={(updated) => updateFeatured(i, updated)}
                  />
                );
              })}
            </div>
          </div>

          {/* Experiências */}
          <div>
            <SectionHeader title="Experiência" />
            <div className="space-y-4">
              {data.experiences.map((exp, i) => (
                <EditableExperienceCard
                  key={i}
                  exp={exp}
                  onChange={(updated) => updateExp(i, updated)}
                />
              ))}
            </div>
          </div>

          {/* Rodapé — Score */}
          <div className="pt-2 border-t flex items-center gap-3">
            {hasScore ? (
              <>
                <AlignmentScoreBadge
                  alignment={data.semanticAlignment}
                  showIssues={false}
                  compact
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs text-violet-600"
                  onClick={handleGenerateScore}
                  disabled={generatingScore}
                >
                  {generatingScore ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Recalcular score
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-violet-300 text-violet-700 hover:bg-violet-50"
                onClick={handleGenerateScore}
                disabled={generatingScore}
              >
                {generatingScore ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Gerar score 360Brew
              </Button>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// Sub-componentes internos
// ---------------------------------------------------------------------------

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-base font-semibold text-gray-900 mb-2 pb-1 border-b border-gray-100">
      {title}
    </h3>
  );
}

function EditableFeaturedCard({
  index,
  item,
  onChange,
}: {
  index: number;
  item: ProfileFeaturedItemSuggestion;
  onChange: (updated: ProfileFeaturedItemSuggestion) => void;
}) {
  const { toast } = useToast();

  return (
    <div className="group border rounded-lg overflow-hidden hover:shadow-sm transition-shadow">
      <div className="h-16 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
        ) : (
          <ExternalLink className="h-6 w-6 text-gray-400" />
        )}
      </div>
      <div className="p-2 space-y-1.5">
        <InlineText
          value={item.title}
          onChange={(v) => onChange({ ...item, title: v })}
          placeholder={index === 0 ? 'ex: Agende uma conversa' : 'ex: Episódio mais recente'}
          className="text-xs font-medium text-gray-700 leading-tight"
        />
        <div className="flex items-center gap-1">
          <InlineText
            value={item.url || ''}
            onChange={(v) => onChange({ ...item, url: v })}
            placeholder="https://..."
            className="text-[10px] text-gray-400 flex-1 truncate"
          />
          {item.url && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100"
              onClick={() => {
                navigator.clipboard.writeText(item.url!);
                toast({ description: 'Link copiado!' });
              }}
            >
              <Copy className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function EditableExperienceCard({
  exp,
  onChange,
}: {
  exp: ProfileExperienceSuggestion;
  onChange: (updated: ProfileExperienceSuggestion) => void;
}) {
  const { toast } = useToast();
  const displayDescription = exp.rewrittenDescription ?? exp.description;

  return (
    <div className="group flex gap-3">
      <div className="h-9 w-9 shrink-0 rounded bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 uppercase">
        {exp.company.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="font-semibold text-gray-900 text-sm leading-tight">
              <InlineText
                value={exp.title}
                onChange={(v) => onChange({ ...exp, title: v })}
                placeholder="Cargo..."
              />
            </div>
            <div className="text-xs text-gray-500">
              <InlineText
                value={exp.company}
                onChange={(v) => onChange({ ...exp, company: v })}
                placeholder="Empresa..."
              />
              {' · '}
              <InlineText
                value={exp.period}
                onChange={(v) => onChange({ ...exp, period: v })}
                placeholder="Período..."
              />
            </div>
          </div>
          {displayDescription && (
            <CopyButton text={displayDescription} label="Experiência" />
          )}
        </div>
        {displayDescription !== undefined && (
          <div className="mt-1 text-xs text-gray-600 leading-relaxed">
            <InlineText
              value={displayDescription}
              onChange={(v) =>
                onChange({
                  ...exp,
                  rewrittenDescription: v,
                  action: 'rewrite',
                })
              }
              multiline
              rows={4}
              placeholder="Descrição da experiência..."
            />
          </div>
        )}
      </div>
    </div>
  );
}
