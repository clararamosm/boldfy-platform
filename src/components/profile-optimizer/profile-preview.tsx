'use client';

import { cn } from '@/lib/utils';
import type {
  LinkedInProfileSuggestions,
  ProfileExperienceSuggestion,
  ProfileFeaturedItemSuggestion,
} from '@/lib/linkedin-analytics-types';
import { Copy, Download, ExternalLink, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';

interface ProfilePreviewProps {
  suggestions: LinkedInProfileSuggestions;
  tlName: string;
  tlAvatarUrl?: string;
  readOnly?: boolean;
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const { toast } = useToast();

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    toast({ description: label ? `${label} copiado!` : 'Copiado!' });
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
      onClick={copy}
      title="Copiar"
    >
      <Copy className="h-3.5 w-3.5" />
    </Button>
  );
}

export function ProfilePreview({ suggestions, tlName, tlAvatarUrl, readOnly = false }: ProfilePreviewProps) {
  return (
    <TooltipProvider>
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden font-sans text-sm text-gray-800 max-w-2xl mx-auto">
        {/* Banner */}
        <div className="h-24 bg-gradient-to-r from-violet-600 to-purple-500 relative">
          {/* Avatar */}
          <div className="absolute -bottom-8 left-5 h-16 w-16 rounded-full border-4 border-white bg-gray-200 overflow-hidden">
            {tlAvatarUrl ? (
              <img src={tlAvatarUrl} alt={tlName} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xl font-bold text-gray-500">
                {tlName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          {/* Botão Seguir */}
          <div className="absolute bottom-3 right-4 flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="flex items-center gap-1.5 rounded-full bg-violet-700 text-white text-xs font-semibold px-4 py-1.5 cursor-default">
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

        <div className="pt-10 px-5 pb-5 space-y-5">
          {/* Nome + Headline */}
          <div className="group flex items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{tlName}</h2>
              <p className="text-sm text-gray-700 leading-snug mt-0.5">{suggestions.headline}</p>
            </div>
            {!readOnly && <CopyButton text={suggestions.headline} label="Headline" />}
          </div>

          {/* Sobre */}
          <div>
            <SectionHeader title="Sobre" />
            <div className="group relative">
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                {suggestions.about}
              </div>
              {!readOnly && (
                <div className="absolute top-0 right-0">
                  <CopyButton text={suggestions.about} label="Sobre" />
                </div>
              )}
            </div>
          </div>

          {/* Competências */}
          <div>
            <SectionHeader title="Principais competências" />
            <div className="flex flex-wrap gap-2">
              {suggestions.topSkills.map((skill, i) => (
                <div key={i} className="group flex items-center gap-1">
                  <span className="bg-violet-50 text-violet-700 border border-violet-200 rounded-full px-3 py-0.5 text-xs font-medium">
                    {skill}
                  </span>
                  {!readOnly && <CopyButton text={skill} label="Competência" />}
                </div>
              ))}
            </div>
          </div>

          {/* Destaque */}
          {suggestions.featuredItems.length > 0 && (
            <div>
              <SectionHeader title="Destaque" />
              <div className="grid grid-cols-2 gap-3">
                {suggestions.featuredItems.slice(0, 2).map((item, i) => (
                  <FeaturedCard key={i} item={item} readOnly={readOnly} />
                ))}
              </div>
            </div>
          )}

          {/* Experiências */}
          <div>
            <SectionHeader title="Experiência" />
            <div className="space-y-4">
              {suggestions.experiences.map((exp, i) => (
                <ExperienceCard key={i} exp={exp} readOnly={readOnly} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-base font-semibold text-gray-900 mb-2 pb-1 border-b border-gray-100">
      {title}
    </h3>
  );
}

function FeaturedCard({
  item,
  readOnly,
}: {
  item: ProfileFeaturedItemSuggestion;
  readOnly: boolean;
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
      <div className="p-2 flex items-start justify-between gap-1">
        <p className="text-xs font-medium text-gray-700 leading-tight line-clamp-2">{item.title}</p>
        {!readOnly && item.url && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
            onClick={() => {
              navigator.clipboard.writeText(item.url!);
              toast({ description: 'Link copiado!' });
            }}
            title="Copiar link"
          >
            <Copy className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

function ExperienceCard({
  exp,
  readOnly,
}: {
  exp: ProfileExperienceSuggestion;
  readOnly: boolean;
}) {
  const displayDescription =
    exp.action !== 'keep' && exp.rewrittenDescription
      ? exp.rewrittenDescription
      : exp.description;

  const actionBadge =
    exp.action === 'rewrite'
      ? { label: 'Reescrito', cls: 'bg-blue-50 text-blue-700 border-blue-200' }
      : exp.action === 'add_impact'
        ? { label: '+ Impacto', cls: 'bg-amber-50 text-amber-700 border-amber-200' }
        : null;

  return (
    <div className="group flex gap-3">
      <div className="h-9 w-9 shrink-0 rounded bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 uppercase">
        {exp.company.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm leading-tight">{exp.title}</p>
            <p className="text-xs text-gray-500">{exp.company} · {exp.period}</p>
          </div>
          <div className="flex items-center gap-1">
            {actionBadge && (
              <span className={cn('text-xs border rounded-full px-2 py-0.5', actionBadge.cls)}>
                {actionBadge.label}
              </span>
            )}
            {!readOnly && displayDescription && (
              <CopyButton text={displayDescription} label="Experiência" />
            )}
          </div>
        </div>
        {displayDescription && (
          <p className="mt-1 text-xs text-gray-600 leading-relaxed line-clamp-4">
            {displayDescription}
          </p>
        )}
      </div>
    </div>
  );
}
