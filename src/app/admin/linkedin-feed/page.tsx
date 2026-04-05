'use client';

import React, { useState, useEffect } from 'react';
import { Header } from "@/components/dashboard/header";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Linkedin, ExternalLink, Video,
  Newspaper, Users,
} from "lucide-react";
import { getCompanyFeed, type FeedPost } from '@/app/actions/posts';
import { getAuthToken } from '@/lib/auth-client';
import { useAuth } from '@/contexts/auth-context';

// ─── Time ago helper ────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'agora';
  if (diffMins < 60) return `${diffMins}min`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

// ─── Feed Post Card (Admin view — no "Voce" badge) ─────────────
function FeedPostCard({ post }: { post: FeedPost }) {
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
            <span className="text-sm font-semibold truncate">{post.authorName}</span>
            {post.authorPosition && (
              <p className="text-xs text-muted-foreground truncate">{post.authorPosition}</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(post.publishedAt)}</p>
          </div>
          {post.linkedinPostUrl && (
            <a
              href={post.linkedinPostUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-muted-foreground hover:text-[#0A66C2] transition-colors p-1"
              title="Ver no LinkedIn"
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
              {expanded ? 'ver menos' : 'ver mais'}
            </button>
          )}
        </div>

        {/* Media preview */}
        {post.mediaUrl && (
          <div className="relative bg-muted/30">
            {post.mediaType?.startsWith('video') ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Video className="h-8 w-8 mr-2" />
                <span className="text-sm">Video publicado</span>
              </div>
            ) : (
              <img
                src={post.mediaUrl}
                alt="Post media"
                className="w-full max-h-[400px] object-cover"
                loading="lazy"
              />
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t bg-muted/20">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Linkedin className="h-3.5 w-3.5 text-[#0A66C2]" />
            <span>Publicado no LinkedIn</span>
          </div>
          {post.linkedinPostUrl && (
            <a
              href={post.linkedinPostUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#0A66C2] hover:underline flex items-center gap-1"
            >
              Abrir post <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

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

// ─── Empty State (Admin version) ────────────────────────────────
function EmptyFeed() {
  return (
    <div className="max-w-2xl mx-auto">
      <Card className="border-dashed">
        <CardContent className="p-8">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="h-16 w-16 rounded-full bg-[#0A66C2]/10 flex items-center justify-center">
              <Newspaper className="h-8 w-8 text-[#0A66C2]" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Nenhum post publicado ainda</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Quando seus colaboradores publicarem posts no LinkedIn pela Boldfy,
                eles aparecerao aqui para voce acompanhar o que a equipe esta compartilhando.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────
export default function AdminLinkedInFeedPage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const fetchFeed = async () => {
      try {
        const token = await getAuthToken();
        const result = await getCompanyFeed(token);

        if (result.error) {
          setError(result.error);
          toast({ variant: 'destructive', title: 'Erro', description: result.error });
        } else {
          setPosts(result.posts || []);
        }
      } catch (err) {
        console.error('Feed error:', err);
        setError('Erro ao carregar feed.');
        toast({ variant: 'destructive', title: 'Erro ao carregar feed' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeed();
  }, [user, toast]);

  const uniqueAuthors = new Set(posts.map(p => p.userId)).size;

  return (
    <>
      <Header title="LinkedIn Feed" subtitle="Acompanhe os posts dos seus colaboradores" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        {/* Stats bar */}
        {!isLoading && posts.length > 0 && (
          <div className="max-w-2xl mx-auto mb-4 flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Newspaper className="h-4 w-4" />
              <span>{posts.length} post{posts.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              <span>{uniqueAuthors} colaborador{uniqueAuthors !== 1 ? 'es' : ''}</span>
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
          <EmptyFeed />
        ) : (
          <div className="space-y-4 max-w-2xl mx-auto">
            {posts.map((post) => (
              <FeedPostCard
                key={`${post.userId}-${post.id}`}
                post={post}
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
