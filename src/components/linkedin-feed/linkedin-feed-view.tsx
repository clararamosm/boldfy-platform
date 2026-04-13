// src/components/linkedin-feed/linkedin-feed-view.tsx
// Shared LinkedIn Feed view — used by colaborador, thoughtleader, and admin pages.
'use client';

import React, { useState, useEffect, useCallback, memo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Header } from "@/components/dashboard/header";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Linkedin, ExternalLink, Video,
  Newspaper, Users, Heart, MessageCircle,
} from "lucide-react";
import { getCompanyFeed, markFeedAsRead, getFeedPostMetrics, type FeedPost } from '@/app/actions/posts';
import { getAuthToken } from '@/lib/auth-client';
import { useT, useLocale } from '@/lib/i18n/context';
import { interpolate } from '@/lib/i18n/interpolate';

// ─── Time ago helper ────────────────────────────────────────────
function timeAgo(dateStr: string, nowLabel: string, locale: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return nowLabel;
  if (diffMins < 60) return `${diffMins}min`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString(locale === 'en' ? 'en-US' : 'pt-BR', { day: '2-digit', month: 'short' });
}

// ─── Feed Post Card (memoized) ──────────────────────────────────
const FeedPostCard = memo(function FeedPostCard({
  post,
  currentUserId,
  showYouBadge,
  reactions,
  comments,
}: {
  post: FeedPost;
  currentUserId: string;
  showYouBadge: boolean;
  reactions?: number;
  comments?: number;
}) {
  const t = useT();
  const locale = useLocale();
  const isOwn = showYouBadge && post.userId === currentUserId;
  const isLong = post.caption.length > 400;
  const [expanded, setExpanded] = useState(false);

  const displayCaption = expanded
    ? post.caption
    : post.caption.length > 400
      ? post.caption.substring(0, 400)
      : post.caption;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Author header */}
        <div className="flex items-start gap-3 p-4 pb-2">
          <Avatar className="h-10 w-10">
            <AvatarImage src={post.authorAvatar} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {post.authorName.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold truncate">{post.authorName}</span>
              {isOwn && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                  {t.linkedinFeed.you}
                </Badge>
              )}
            </div>
            {post.authorPosition && (
              <p className="text-xs text-muted-foreground truncate">{post.authorPosition}</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(post.publishedAt, t.linkedinFeed.now, locale)}</p>
          </div>
          {post.linkedinPostUrl && (
            <a
              href={post.linkedinPostUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-muted-foreground hover:text-[#0A66C2] transition-colors p-1"
              title={t.linkedinFeed.viewOnLinkedin}
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>

        {/* Caption */}
        <div className="px-4 pb-3">
          <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
            {displayCaption}
            {isLong && !expanded && '...'}
          </p>
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-primary font-medium mt-1 hover:underline"
            >
              {expanded ? t.linkedinFeed.seeLess : t.linkedinFeed.seeMore}
            </button>
          )}
        </div>

        {/* Media preview */}
        {post.mediaUrl && (
          <div className="relative bg-muted/30">
            {post.mediaType?.startsWith('video') ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Video className="h-8 w-8 mr-2" />
                <span className="text-sm">{t.linkedinFeed.videoPublished}</span>
              </div>
            ) : (
              <img
                src={post.mediaUrl}
                alt="Post media"
                className="w-full object-contain"
                loading="lazy"
              />
            )}
          </div>
        )}

        {/* Engagement metrics */}
        {(reactions != null || comments != null) && (
          <div className="flex items-center gap-3 px-4 py-2 text-xs text-muted-foreground">
            {reactions != null && (
              <span className="flex items-center gap-1">
                <Heart className="h-3.5 w-3.5 text-rose-500" />
                {reactions} {reactions === 1 ? 'reacao' : 'reacoes'}
              </span>
            )}
            {reactions != null && comments != null && <span>·</span>}
            {comments != null && (
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3.5 w-3.5 text-blue-500" />
                {comments} {comments === 1 ? 'comentario' : 'comentarios'}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t bg-muted/20">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Linkedin className="h-3.5 w-3.5 text-[#0A66C2]" />
            <span>{t.linkedinFeed.publishedOnLinkedin}</span>
          </div>
          {post.linkedinPostUrl && (
            <a
              href={post.linkedinPostUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#0A66C2] hover:underline flex items-center gap-1"
            >
              {t.linkedinFeed.openPost} <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

// ─── Skeleton ───────────────────────────────────────────────────
function FeedSkeleton() {
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {[1, 2, 3].map(i => (
        <Card key={i}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Empty State ────────────────────────────────────────────────
function EmptyFeed({ variant }: { variant: 'colaborador' | 'admin' }) {
  const t = useT();
  return (
    <div className="max-w-2xl mx-auto">
      <Card className="border-dashed">
        <CardContent className="p-8">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="h-16 w-16 rounded-full bg-[#0A66C2]/10 flex items-center justify-center">
              <Newspaper className="h-8 w-8 text-[#0A66C2]" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{t.linkedinFeed.emptyTitle}</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                {variant === 'admin' ? t.linkedinFeed.emptyDescription : t.linkedinFeed.emptyDescriptionCollab}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Props ──────────────────────────────────────────────────────
export interface LinkedInFeedViewProps {
  /** Show header title — pass custom or defaults to t.nav.linkedinFeed */
  title?: string;
  /** Show subtitle in header */
  subtitle?: string;
  /** Show "Você" badge on current user's posts (disable for admin) */
  showYouBadge?: boolean;
  /** Empty state variant */
  emptyVariant?: 'colaborador' | 'admin';
}

// ─── Main Component ─────────────────────────────────────────────
export default function LinkedInFeedView({
  title,
  subtitle,
  showYouBadge = true,
  emptyVariant = 'colaborador',
}: LinkedInFeedViewProps) {
  const t = useT();
  const { user: authUser } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metricsMap, setMetricsMap] = useState<Record<string, { reactions: number; comments: number }>>({});
  const { toast } = useToast();

  const fetchFeed = useCallback(async () => {
    try {
      const token = await getAuthToken();
      const result = await getCompanyFeed(token);

      if (result.error) {
        setError(result.error);
        toast({ variant: 'destructive', title: t.common.error, description: result.error });
      } else {
        const feedPosts = result.posts || [];
        setPosts(feedPosts);
        markFeedAsRead(token).catch(() => {});

        // Async fetch metrics for posts that have linkedinPostId
        const postsForMetrics = feedPosts
          .filter((p) => p.linkedinPostId)
          .map((p) => ({ id: p.id, userId: p.userId, linkedinPostId: p.linkedinPostId }));

        if (postsForMetrics.length > 0) {
          getFeedPostMetrics(token, postsForMetrics)
            .then((res) => {
              if (res.metrics) setMetricsMap(res.metrics);
            })
            .catch(() => {}); // Silently fail — metrics are optional
        }
      }
    } catch (err) {
      console.error('Feed error:', err);
      setError(t.linkedinFeed.loadError || t.linkedinFeed.errorLoading || 'Erro ao carregar feed');
      toast({ variant: 'destructive', title: t.linkedinFeed.loadError || t.linkedinFeed.errorLoading || 'Erro' });
    } finally {
      setIsLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    if (authUser?.uid) fetchFeed();
  }, [authUser?.uid, fetchFeed]);

  // Count unique authors
  const uniqueAuthors = new Set(posts.map(p => p.userId)).size;

  return (
    <>
      <Header title={title || t.nav.linkedinFeed} subtitle={subtitle} />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        {/* Stats bar */}
        {!isLoading && posts.length > 0 && (
          <div className="max-w-2xl mx-auto mb-4 flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Newspaper className="h-4 w-4" />
              <span>{interpolate(t.linkedinFeed.postsCount, { count: posts.length, plural: posts.length !== 1 ? 's' : '' })}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              <span>{interpolate(t.linkedinFeed.collaboratorsCount, { count: uniqueAuthors, plural: uniqueAuthors !== 1 ? 'es' : '' })}</span>
            </div>
          </div>
        )}

        {/* Feed */}
        {isLoading ? (
          <FeedSkeleton />
        ) : error ? (
          <div className="max-w-2xl mx-auto">
            <Card className="border-destructive/30">
              <CardContent className="p-6 text-center text-destructive">
                <p>{error}</p>
              </CardContent>
            </Card>
          </div>
        ) : posts.length === 0 ? (
          <EmptyFeed variant={emptyVariant} />
        ) : (
          <div className="space-y-4 max-w-2xl mx-auto">
            {posts.map((post) => (
              <FeedPostCard
                key={`${post.userId}-${post.id}`}
                post={post}
                currentUserId={authUser?.uid || ''}
                showYouBadge={showYouBadge}
                reactions={metricsMap[post.id]?.reactions}
                comments={metricsMap[post.id]?.comments}
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
