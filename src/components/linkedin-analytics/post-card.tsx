'use client';

import { ExternalLink, Eye, TrendingUp, Calendar, FileText, Image, LayoutGrid, Video, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LinkedInTopPost } from '@/lib/linkedin-analytics-types';

interface PostCardProps {
  post: LinkedInTopPost;
  metric: 'engagement' | 'impressions';
}

const FORMAT_LABELS: Record<string, string> = {
  foto: 'Foto',
  texto: 'Texto',
  infografico: 'Infográfico',
  infográfico: 'Infográfico',
  carrossel: 'Carrossel',
  carousel: 'Carrossel',
  video: 'Vídeo',
  vídeo: 'Vídeo',
};

const FORMAT_ICONS: Record<string, React.ReactNode> = {
  foto: <Image className="h-3 w-3" />,
  texto: <FileText className="h-3 w-3" />,
  infografico: <Info className="h-3 w-3" />,
  infográfico: <Info className="h-3 w-3" />,
  carrossel: <LayoutGrid className="h-3 w-3" />,
  carousel: <LayoutGrid className="h-3 w-3" />,
  video: <Video className="h-3 w-3" />,
  vídeo: <Video className="h-3 w-3" />,
};

function formatDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString('pt-BR');
}

// Gera uma cor de pilar determinística a partir do nome
function pillarColor(pillar: string): string {
  const colors = [
    'bg-blue-100 text-blue-700',
    'bg-purple-100 text-purple-700',
    'bg-green-100 text-green-700',
    'bg-orange-100 text-orange-700',
    'bg-pink-100 text-pink-700',
    'bg-teal-100 text-teal-700',
  ];
  let hash = 0;
  for (let i = 0; i < pillar.length; i++) hash = pillar.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function PostCard({ post, metric }: PostCardProps) {
  const formatKey = post.format?.toLowerCase() ?? '';
  const formatLabel = FORMAT_LABELS[formatKey];
  const FormatIcon = FORMAT_ICONS[formatKey];
  const isTextPost = formatKey === 'texto' || (!post.mediaUrl && !post.format);

  return (
    <div className="rounded-xl border bg-card p-3 flex flex-col gap-2 hover:shadow-sm transition-shadow">
      {/* Topo: thumbnail + tags */}
      <div className="flex gap-3">
        {/* Thumbnail ou tag de texto */}
        <div className="shrink-0">
          {post.mediaUrl && !isTextPost ? (
            <img
              src={post.mediaUrl}
              alt="Post"
              className="w-16 h-16 rounded-lg object-cover bg-muted"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
              <FileText className="h-6 w-6 text-muted-foreground/50" />
            </div>
          )}
        </div>

        {/* Tags de pilar e formato */}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-1">
            {post.pillar && (
              <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none', pillarColor(post.pillar))}>
                {post.pillar}
              </span>
            )}
            {formatLabel && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full leading-none bg-muted text-muted-foreground flex items-center gap-1">
                {FormatIcon}
                {formatLabel}
              </span>
            )}
          </div>
          {/* Caption truncada — só exibe se disponível */}
          {post.caption && (
            <p className="text-xs text-foreground/80 line-clamp-2 leading-relaxed">
              {post.caption}
            </p>
          )}
        </div>
      </div>

      {/* Métricas */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground border-t pt-2">
        <span className={cn('flex items-center gap-1 font-medium', metric === 'engagement' ? 'text-foreground' : '')}>
          <TrendingUp className="h-3 w-3" />
          {formatNumber(post.engagement)}
        </span>
        <span className={cn('flex items-center gap-1 font-medium', metric === 'impressions' ? 'text-foreground' : '')}>
          <Eye className="h-3 w-3" />
          {formatNumber(post.impressions)}
        </span>
        <span className="flex items-center gap-1 ml-auto">
          <Calendar className="h-3 w-3" />
          {formatDate(post.date)}
        </span>
      </div>

      {/* Link para o LinkedIn */}
      <a
        href={post.url.startsWith('http') ? post.url : `https://${post.url}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium w-fit"
      >
        <ExternalLink className="h-3 w-3" />
        Ver no LinkedIn
      </a>
    </div>
  );
}
