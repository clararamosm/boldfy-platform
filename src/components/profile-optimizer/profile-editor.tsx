'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  LinkedInProfileSuggestions,
  LinkedInProfileCurrent,
  ProfileExperienceSuggestion,
  ProfileFeaturedItemSuggestion,
  ProfileSemanticAlignment,
} from '@/lib/linkedin-analytics-types';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, ChevronDown, ChevronUp, ImagePlus, X, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { recalculateAlignmentScore } from '@/app/actions/profile-optimizer';
import { getAuthToken } from '@/lib/auth-client';
import { AlignmentScoreBadge } from './alignment-score-badge';

interface ProfileEditorProps {
  initial: LinkedInProfileSuggestions;
  aiSuggestions: LinkedInProfileSuggestions;
  currentProfile?: LinkedInProfileCurrent | null; // perfil extraído do PDF (original)
  tlUserId: string;
  onChange: (updated: LinkedInProfileSuggestions) => void;
}

export function ProfileEditor({ initial, aiSuggestions, currentProfile, tlUserId, onChange }: ProfileEditorProps) {
  const [data, setData] = useState<LinkedInProfileSuggestions>(initial);
  const [alignment, setAlignment] = useState<ProfileSemanticAlignment>(initial.semanticAlignment);
  const [scoreLoading, setScoreLoading] = useState(false);

  useEffect(() => {
    onChange({ ...data, semanticAlignment: alignment });
  }, [data, alignment]);

  const recalcScore = useCallback(
    async (updated: LinkedInProfileSuggestions) => {
      setScoreLoading(true);
      try {
        const token = await getAuthToken();
        const result = await recalculateAlignmentScore(token, tlUserId, {
          headline: updated.headline,
          about: updated.about,
          topSkills: updated.topSkills,
          experiences: updated.experiences,
        });
        if (result.alignment) setAlignment(result.alignment);
      } finally {
        setScoreLoading(false);
      }
    },
    [tlUserId],
  );

  function update(partial: Partial<LinkedInProfileSuggestions>) {
    const next = { ...data, ...partial };
    setData(next);
    if (
      partial.headline !== undefined ||
      partial.about !== undefined ||
      partial.topSkills !== undefined ||
      partial.experiences !== undefined
    ) {
      recalcScore(next);
    }
  }

  function applyAiSuggestion(field: keyof LinkedInProfileSuggestions) {
    update({ [field]: aiSuggestions[field] } as Partial<LinkedInProfileSuggestions>);
  }

  // Parsear gap analysis em itens de checklist
  const gapItems = parseGapAnalysis(data.gapAnalysis);

  return (
    <div className="space-y-4">
      {/* Score badge — deixa claro que é do perfil otimizado */}
      <AlignmentScoreBadge alignment={alignment} showIssues={true} />
      {scoreLoading && (
        <p className="text-xs text-muted-foreground animate-pulse">Recalculando score...</p>
      )}

      {/* Gap Analysis como checklist */}
      {gapItems.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <CheckSquare className="h-3.5 w-3.5 text-amber-700" />
            <p className="text-xs font-semibold text-amber-800">Gap Analysis do Perfil Atual</p>
          </div>
          <ul className="space-y-1.5">
            {gapItems.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-amber-700">
                <span className="shrink-0 mt-0.5 h-4 w-4 rounded border border-amber-400 bg-white flex items-center justify-center text-amber-500 font-bold text-[10px]">
                  {i + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Abas */}
      <Tabs defaultValue="headline">
        <TabsList className="grid grid-cols-5 h-auto">
          <TabsTrigger value="headline" className="text-xs py-1.5">Headline</TabsTrigger>
          <TabsTrigger value="about" className="text-xs py-1.5">Sobre</TabsTrigger>
          <TabsTrigger value="skills" className="text-xs py-1.5">Competências</TabsTrigger>
          <TabsTrigger value="experiences" className="text-xs py-1.5">Experiências</TabsTrigger>
          <TabsTrigger value="featured" className="text-xs py-1.5">Destaque</TabsTrigger>
        </TabsList>

        {/* ── Headline ── */}
        <TabsContent value="headline" className="space-y-3 pt-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Headline otimizado</Label>
            <AiSuggestionButton onClick={() => applyAiSuggestion('headline')} />
          </div>
          <Textarea
            value={data.headline}
            onChange={(e) => update({ headline: e.target.value })}
            rows={2}
            className="resize-none"
            placeholder="Headline otimizado..."
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{data.headline.length} caracteres</span>
            {data.headline !== aiSuggestions.headline && (
              <span className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
                Modificado
              </span>
            )}
          </div>
          {/* Toggle: headline atual do perfil original */}
          <ToggleOriginal
            label="Ver headline atual (do PDF)"
            value={currentProfile?.headline || initial.headline}
          />
        </TabsContent>

        {/* ── Sobre ── */}
        <TabsContent value="about" className="space-y-3 pt-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Seção Sobre otimizada</Label>
            <AiSuggestionButton onClick={() => applyAiSuggestion('about')} />
          </div>
          <Textarea
            value={data.about}
            onChange={(e) => update({ about: e.target.value })}
            rows={12}
            className="resize-none text-sm"
            placeholder="Seção Sobre otimizada..."
          />
          <p className="text-xs text-muted-foreground">{data.about.length} caracteres</p>
          <ToggleOriginal
            label="Ver Sobre atual (do PDF)"
            value={currentProfile?.about || initial.about}
          />
        </TabsContent>

        {/* ── Competências ── */}
        <TabsContent value="skills" className="space-y-3 pt-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Competências otimizadas (5 máximo)</Label>
            <AiSuggestionButton onClick={() => applyAiSuggestion('topSkills')} />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-4 text-right">{i + 1}.</span>
                <Input
                  value={data.topSkills[i] || ''}
                  onChange={(e) => {
                    const next = [...data.topSkills];
                    next[i] = e.target.value;
                    update({ topSkills: next.filter(Boolean) });
                  }}
                  placeholder={`Competência ${i + 1}`}
                  className="text-sm"
                />
              </div>
            ))}
          </div>
          {/* Toggle: competências atuais do PDF */}
          {(currentProfile?.topSkills || initial.topSkills).length > 0 && (
            <ToggleOriginal
              label="Ver competências atuais (do PDF)"
              value={(currentProfile?.topSkills || initial.topSkills).join('\n')}
              renderContent={(val) => (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {val.split('\n').filter(Boolean).map((s, i) => (
                    <span key={i} className="bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 text-xs">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            />
          )}
        </TabsContent>

        {/* ── Experiências ── */}
        <TabsContent value="experiences" className="space-y-3 pt-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Experiências</Label>
            <AiSuggestionButton onClick={() => applyAiSuggestion('experiences')} />
          </div>
          <div className="space-y-3">
            {data.experiences.map((exp, i) => (
              <ExperienceEditorItem
                key={i}
                exp={exp}
                aiSuggestion={aiSuggestions.experiences[i]}
                onChange={(updated) => {
                  const next = [...data.experiences];
                  next[i] = updated;
                  update({ experiences: next });
                }}
              />
            ))}
          </div>
        </TabsContent>

        {/* ── Destaque ── */}
        <TabsContent value="featured" className="space-y-3 pt-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Destaque (2 itens)</Label>
            <AiSuggestionButton onClick={() => applyAiSuggestion('featuredItems')} />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => {
              const item = data.featuredItems[i] || { title: '', url: '', imageUrl: undefined, action: 'add', rationale: '' };
              return (
                <FeaturedEditorItem
                  key={i}
                  index={i}
                  item={item}
                  aiRationale={aiSuggestions.featuredItems[i]?.rationale}
                  onChange={(updated) => {
                    const next = [...data.featuredItems] as ProfileFeaturedItemSuggestion[];
                    next[i] = updated;
                    update({ featuredItems: next });
                  }}
                />
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Converte o texto do gapAnalysis em array de itens (por número ou por parágrafo) */
function parseGapAnalysis(text: string): string[] {
  if (!text) return [];
  // Tenta split por padrão "1. ", "2. " etc
  const numbered = text.split(/\n?\d+\.\s+/).filter(Boolean);
  if (numbered.length > 1) return numbered.map((s) => s.trim());
  // Fallback: split por newlines duplos ou simples
  return text.split(/\n{1,2}/).map((s) => s.trim()).filter(Boolean);
}

// ── Componentes auxiliares ───────────────────────────────────────────────────

function AiSuggestionButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-violet-600" onClick={onClick}>
      <Sparkles className="h-3.5 w-3.5" />
      Aplicar sugestão da IA
    </Button>
  );
}

function ToggleOriginal({
  label,
  value,
  renderContent,
}: {
  label: string;
  value: string;
  renderContent?: (val: string) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (!value) return null;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {label}
      </button>
      {open && (
        <div className="mt-1 p-3 bg-gray-50 rounded border text-xs text-gray-600">
          {renderContent ? renderContent(value) : <span className="whitespace-pre-line">{value}</span>}
        </div>
      )}
    </div>
  );
}

function ExperienceEditorItem({
  exp,
  aiSuggestion,
  onChange,
}: {
  exp: ProfileExperienceSuggestion;
  aiSuggestion?: ProfileExperienceSuggestion;
  onChange: (updated: ProfileExperienceSuggestion) => void;
}) {
  const [open, setOpen] = useState(exp.isCurrent || exp.action !== 'keep');
  // Toggle entre 'atual' (description original) e 'reescrito' (rewrittenDescription)
  const [showRewritten, setShowRewritten] = useState(exp.action !== 'keep');

  const hasRewrite = !!(aiSuggestion?.rewrittenDescription || exp.rewrittenDescription);
  const displayDesc = showRewritten && exp.rewrittenDescription
    ? exp.rewrittenDescription
    : exp.description;

  const actionColors: Record<string, string> = {
    keep: 'bg-gray-100 text-gray-600',
    rewrite: 'bg-blue-50 text-blue-700',
    add_impact: 'bg-amber-50 text-amber-700',
  };
  const actionLabels: Record<string, string> = {
    keep: 'Mantido',
    rewrite: 'Reescrito',
    add_impact: '+Impacto',
  };

  return (
    <div className={cn('border rounded-lg overflow-hidden', exp.isCurrent && 'border-violet-200')}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{exp.title}</p>
            <p className="text-xs text-muted-foreground">{exp.company} · {exp.period}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {exp.isCurrent && (
            <span className="text-xs bg-violet-50 text-violet-700 border border-violet-200 rounded-full px-2 py-0.5">
              Atual
            </span>
          )}
          <span className={cn('text-xs rounded-full px-2 py-0.5', actionColors[exp.action])}>
            {actionLabels[exp.action]}
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t">
          {/* Toggle atual ↔ reescrito */}
          {hasRewrite && (
            <div className="flex items-center gap-1 pt-3">
              <button
                type="button"
                onClick={() => setShowRewritten(false)}
                className={cn(
                  'text-xs px-3 py-1 rounded-l-full border transition-colors',
                  !showRewritten
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50',
                )}
              >
                Atual
              </button>
              <button
                type="button"
                onClick={() => setShowRewritten(true)}
                className={cn(
                  'text-xs px-3 py-1 rounded-r-full border-t border-r border-b transition-colors',
                  showRewritten
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50',
                )}
              >
                Reescrito
              </button>
              {aiSuggestion?.rewrittenDescription && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-6 text-xs text-violet-600 gap-1"
                  onClick={() => {
                    onChange({
                      ...exp,
                      rewrittenDescription: aiSuggestion.rewrittenDescription,
                      action: aiSuggestion.action,
                    });
                    setShowRewritten(true);
                  }}
                >
                  <Sparkles className="h-3 w-3" />
                  IA
                </Button>
              )}
            </div>
          )}
          <div className="space-y-1">
            {!hasRewrite && (
              <div className="flex items-center justify-between pt-3">
                <Label className="text-xs">Descrição</Label>
                {aiSuggestion?.rewrittenDescription && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-violet-600 gap-1"
                    onClick={() => {
                      onChange({
                        ...exp,
                        rewrittenDescription: aiSuggestion.rewrittenDescription,
                        action: aiSuggestion.action,
                      });
                      setShowRewritten(true);
                    }}
                  >
                    <Sparkles className="h-3 w-3" />
                    IA
                  </Button>
                )}
              </div>
            )}
            <Textarea
              value={displayDesc}
              readOnly={!showRewritten && hasRewrite}
              onChange={(e) => {
                if (showRewritten || !hasRewrite) {
                  onChange({
                    ...exp,
                    rewrittenDescription: e.target.value,
                    action: exp.action === 'keep' ? 'rewrite' : exp.action,
                  });
                }
              }}
              rows={4}
              className={cn('resize-none text-xs', !showRewritten && hasRewrite && 'bg-gray-50 text-gray-500')}
              placeholder="Descreva o impacto desta experiência..."
            />
          </div>
        </div>
      )}
    </div>
  );
}

function FeaturedEditorItem({
  index,
  item,
  aiRationale,
  onChange,
}: {
  index: number;
  item: ProfileFeaturedItemSuggestion;
  aiRationale?: string;
  onChange: (updated: ProfileFeaturedItemSuggestion) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleImageFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      onChange({ ...item, imageUrl: e.target?.result as string });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase">
          {index === 0 ? 'Item 1 — Book a Call' : 'Item 2 — Material rico'}
        </span>
      </div>

      {/* Preview da imagem */}
      <div
        className={cn(
          'relative h-24 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden transition-colors',
          item.imageUrl ? 'border-transparent' : 'border-gray-200 hover:border-violet-300 bg-gray-50',
        )}
        onClick={() => fileInputRef.current?.click()}
      >
        {item.imageUrl ? (
          <>
            <img src={item.imageUrl} alt="Preview" className="h-full w-full object-cover" />
            <button
              type="button"
              className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
              onClick={(e) => {
                e.stopPropagation();
                onChange({ ...item, imageUrl: undefined });
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <ImagePlus className="h-6 w-6" />
            <span className="text-xs">Clique para adicionar imagem (JPEG/PNG)</span>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/jpg"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImageFile(file);
          }}
        />
      </div>

      <div className="space-y-2">
        <div>
          <Label className="text-xs">Título</Label>
          <Input
            value={item.title}
            onChange={(e) => onChange({ ...item, title: e.target.value })}
            placeholder={index === 0 ? 'ex: Agende uma conversa' : 'ex: Assista ao episódio mais recente'}
            className="text-sm mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">URL</Label>
          <Input
            value={item.url || ''}
            onChange={(e) => onChange({ ...item, url: e.target.value })}
            placeholder="https://..."
            className="text-sm mt-1"
            type="url"
          />
        </div>
      </div>

      {aiRationale && (
        <p className="text-xs text-muted-foreground italic">
          Sugestão da IA: {aiRationale}
        </p>
      )}
    </div>
  );
}
