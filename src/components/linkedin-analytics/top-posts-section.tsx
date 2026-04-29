'use client';

import { PostCard } from './post-card';
import type { LinkedInTopPost } from '@/lib/linkedin-analytics-types';

interface TopPostsSectionProps {
  topByEngagement: LinkedInTopPost[];
  topByImpressions: LinkedInTopPost[];
}

export function TopPostsSection({ topByEngagement, topByImpressions }: TopPostsSectionProps) {
  if (!topByEngagement.length && !topByImpressions.length) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        Nenhum post encontrado nos dados deste mês.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Top por Engajamento */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          🏆 Top 3 por Engajamento
        </h3>
        <div className="space-y-2">
          {topByEngagement.length > 0
            ? topByEngagement.map((post, i) => (
                <PostCard key={`eng-${i}`} post={post} metric="engagement" />
              ))
            : <p className="text-xs text-muted-foreground">Sem dados disponíveis.</p>
          }
        </div>
      </div>

      {/* Top por Impressões */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          👁 Top 3 por Impressões
        </h3>
        <div className="space-y-2">
          {topByImpressions.length > 0
            ? topByImpressions.map((post, i) => (
                <PostCard key={`imp-${i}`} post={post} metric="impressions" />
              ))
            : <p className="text-xs text-muted-foreground">Sem dados disponíveis.</p>
          }
        </div>
      </div>
    </div>
  );
}
