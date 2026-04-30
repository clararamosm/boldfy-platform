'use client';

import { useState, useCallback, useEffect } from 'react';
import type {
  LinkedInProfileSuggestions,
  ProfileExperienceSuggestion,
  ProfileFeaturedItemSuggestion,
  ProfileSemanticAlignment,
} from '@/lib/linkedin-analytics-types';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Sparkles, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { recalculateAlignmentScore } from '@/app/actions/profile-optimizer';
import { getAuthToken } from '@/lib/auth-client';
import { AlignmentScoreBadge } from './alignment-score-badge';

interface ProfileEditorProps {
  initial: LinkedInProfileSuggestions;
  aiSuggestions: LinkedInProfileSuggestions; // original da IA, para botão "Aplicar sugestão"
  tlUserId: string;
  onChange: (updated: LinkedInProfileSuggestions) => void;
}

export function ProfileEditor({ initial, aiSuggestions, tlUserId, onChange }: ProfileEditorProps) {
  const [data, setData] = useState<LinkedInProfileSuggestions>(initial);
  const [alignment, setAlignment] = useState<ProfileSemanticAlignment>(initial.semanticAlignment);
  const [scoreLoading, setScoreLoading] = useState(false);

  // Notificar pai sempre que data muda
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
    // Recalcular score com debounce implícito — só nos campos que afetam score
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

  return (
    <div className="space-y-4">
      {/* Score badge */}
      <AlignmentScoreBadge alignment={alignment} showIssues={true} />
      {scoreLoading && (
        <p className="text-xs text-muted-foreground animate-pulse">Recalculando score...</p>
      )}

      {/* Gap analysis */}
      {data.gapAnalysis && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
          <p className="text-xs font-semibold text-amber-800 mb-1">Gap Analysis do Perfil Atual</p>
          <p className="text-sm text-amber-700 whitespace-pre-line">{data.gapAnalysis}</p>
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

        {/* Headline */}
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
              <DiffBadge original={aiSuggestions.headline} edited={data.headline} />
            )}
          </div>
          {/* Original */}
          <OriginalField label="Headline atual" value={initial.headline} />
        </TabsContent>

        {/* Sobre */}
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
          <OriginalField label="Sobre atual" value={initial.about} />
        </TabsContent>

        {/* Competências */}
        <TabsContent value="skills" className="space-y-3 pt-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Competências (5 máximo)</Label>
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
          {/* Originais */}
          {initial.topSkills.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground mb-1">Competências atuais:</p>
              <div className="flex flex-wrap gap-1.5">
                {initial.topSkills.map((s, i) => (
                  <span key={i} className="bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 text-xs">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Experiências */}
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

        {/* Destaque */}
        <TabsContent value="featured" className="space-y-3 pt-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Destaque (2 itens)</Label>
            <AiSuggestionButton onClick={() => applyAiSuggestion('featuredItems')} />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => {
              const item = data.featuredItems[i] || { title: '', url: '', imageUrl: undefined, action: 'add', rationale: '' };
              return (
                <div key={i} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      {i === 0 ? 'Item 1 — Book a Call' : 'Item 2 — Material rico'}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Título</Label>
                      <Input
                        value={item.title}
                        onChange={(e) => {
                          const next = [...data.featuredItems] as ProfileFeaturedItemSuggestion[];
                          next[i] = { ...item, title: e.target.value };
                          update({ featuredItems: next });
                        }}
                        placeholder={i === 0 ? 'ex: Agende uma conversa' : 'ex: Assista ao episódio mais recente'}
                        className="text-sm mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">URL</Label>
                      <Input
                        value={item.url || ''}
                        onChange={(e) => {
                          const next = [...data.featuredItems] as ProfileFeaturedItemSuggestion[];
                          next[i] = { ...item, url: e.target.value };
                          update({ featuredItems: next });
                        }}
                        placeholder="https://..."
                        className="text-sm mt-1"
                        type="url"
                      />
                    </div>
                  </div>
                  {aiSuggestions.featuredItems[i]?.rationale && (
                    <p className="text-xs text-muted-foreground italic">
                      Sugestão da IA: {aiSuggestions.featuredItems[i].rationale}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
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

function OriginalField({ label, value }: { label: string; value: string }) {
  const [open, setOpen] = useState(false);
  if (!value) return null;
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {label}
      </button>
      {open && (
        <div className="mt-1 p-3 bg-gray-50 rounded border text-xs text-gray-600 whitespace-pre-line">
          {value}
        </div>
      )}
    </div>
  );
}

function DiffBadge({ original, edited }: { original: string; edited: string }) {
  return (
    <span className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
      Modificado
    </span>
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
  const displayDesc =
    exp.action !== 'keep' && exp.rewrittenDescription ? exp.rewrittenDescription : exp.description;

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
          <div className="space-y-1 pt-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Descrição</Label>
              {aiSuggestion && aiSuggestion.rewrittenDescription && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-violet-600 gap-1"
                  onClick={() =>
                    onChange({
                      ...exp,
                      rewrittenDescription: aiSuggestion.rewrittenDescription,
                      action: aiSuggestion.action,
                    })
                  }
                >
                  <Sparkles className="h-3 w-3" />
                  IA
                </Button>
              )}
            </div>
            <Textarea
              value={displayDesc}
              onChange={(e) =>
                onChange({
                  ...exp,
                  rewrittenDescription: e.target.value,
                  action: exp.action === 'keep' ? 'rewrite' : exp.action,
                })
              }
              rows={4}
              className="resize-none text-xs"
              placeholder="Descreva o impacto desta experiência..."
            />
          </div>
        </div>
      )}
    </div>
  );
}
