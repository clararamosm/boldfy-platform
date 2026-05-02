// src/app/colaborador/rankings/page.tsx
// Sprint 5: Full ranking page with 4 sections —
// Top 10, Monthly Posts, Monthly Conquests, My Conquests.
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { getAuthToken } from '@/lib/auth-client';
import { getRankingPageData, sendCongratulation } from '@/app/actions';
import type { RankingPageData, MonthlyPublisher, MonthlyConquest, ConquestProgress } from '@/app/actions';
import { useT } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { GemBadge } from '@/components/gamification/gem-badge';
import { CoinIcon } from '@/components/coin-icon';
import { Trophy, Heart, Check, FileText, BookOpen, Zap, Diamond, Gift, Flame } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ─── Category config (mirrors conquest-modal) ─────────────────────

const CATEGORY_CONFIG: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
  pub:     { icon: FileText, color: 'text-blue-500',    bgColor: 'bg-blue-500/10' },
  trail:   { icon: BookOpen, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
  mission: { icon: Zap,      color: 'text-orange-500',  bgColor: 'bg-orange-500/10' },
  seq:     { icon: Diamond,  color: 'text-purple-500',  bgColor: 'bg-purple-500/10' },
};

// ─── Helpers ──────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function formatDate(epoch: number): string {
  return new Date(epoch).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

// ─── Skeleton ─────────────────────────────────────────────────────

function RankingSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Card><CardContent className="p-6"><Skeleton className="h-64" /></CardContent></Card>
      <div className="grid md:grid-cols-2 gap-6">
        <Card><CardContent className="p-6"><Skeleton className="h-48" /></CardContent></Card>
        <Card><CardContent className="p-6"><Skeleton className="h-48" /></CardContent></Card>
      </div>
      <Card><CardContent className="p-6"><Skeleton className="h-40" /></CardContent></Card>
    </div>
  );
}

// ─── Section 1: Top 10 by Points ──────────────────────────────────

function Top10Section({
  ranking,
  currentUserRank,
  monthlyPrizeName,
  userId,
  t,
}: {
  ranking: RankingPageData['ranking'];
  currentUserRank: number | null;
  monthlyPrizeName: string | null;
  userId: string;
  t: ReturnType<typeof useT>;
}) {
  const rt = t.gamification?.ranking as Record<string, string> | undefined;

  const top3 = ranking.slice(0, 3);
  const rest = ranking.slice(3, 10);

  // Reorder top 3 for visual: [2nd, 1st, 3rd]
  const podiumOrder = top3.length >= 3
    ? [top3[1], top3[0], top3[2]]
    : top3;
  const podiumHeights = ['h-28', 'h-36', 'h-24'];
  const podiumPositions = top3.length >= 3 ? [2, 1, 3] : [1, 2, 3];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            {rt?.top10Title || 'Top 10 por Pontos'}
          </CardTitle>
          {monthlyPrizeName && (
            <Badge variant="secondary" className="gap-1">
              <Gift className="h-3 w-3" />
              {rt?.monthlyPrize || 'Prêmio do Mês'}: {monthlyPrizeName}
            </Badge>
          )}
        </div>
        {currentUserRank && (
          <p className="text-sm text-muted-foreground">
            {rt?.yourPosition || 'Você'}: {(rt?.position || '{pos}º').replace('{pos}', String(currentUserRank))}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {ranking.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">{rt?.top10Empty || 'Nenhum participante ainda.'}</p>
        ) : (
          <>
            {/* Podium — top 3 */}
            {top3.length > 0 && (
              <div className="flex items-end justify-center gap-3 mb-6 pt-4">
                {podiumOrder.map((user, idx) => {
                  if (!user) return null;
                  const pos = podiumPositions[idx];
                  const isMe = user.id === userId;
                  return (
                    <div
                      key={user.id}
                      className={cn(
                        'flex flex-col items-center gap-2 flex-1 max-w-[140px]',
                        isMe && 'ring-2 ring-primary/30 rounded-xl p-2 bg-primary/5',
                      )}
                    >
                      <div className="relative">
                        <Avatar className={cn('border-2', pos === 1 ? 'h-16 w-16 border-amber-400' : 'h-12 w-12 border-muted')}>
                          {user.avatarUrl ? (
                            <AvatarImage src={user.avatarUrl} alt={user.name} />
                          ) : null}
                          <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
                        </Avatar>
                        <span className={cn(
                          'absolute -bottom-1 -right-1 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center',
                          pos === 1 ? 'bg-amber-400 text-white' : pos === 2 ? 'bg-gray-300 text-gray-700' : 'bg-orange-300 text-orange-800',
                        )}>
                          {pos}
                        </span>
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-semibold truncate max-w-[120px]">{user.name}</p>
                        <div className="flex items-center justify-center gap-1 mt-0.5">
                          <CoinIcon size="xs" />
                          <span className="text-xs font-bold text-primary">{user.points}</span>
                        </div>
                      </div>
                      {user.level && user.level > 1 && (
                        <GemBadge level={user.level} size="sm" animated />
                      )}
                      <div className={cn('w-full rounded-t-lg bg-gradient-to-t', podiumHeights[idx],
                        pos === 1 ? 'from-amber-100 to-amber-50' : pos === 2 ? 'from-gray-100 to-gray-50' : 'from-orange-100 to-orange-50',
                      )} />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Positions 4-10 */}
            {rest.length > 0 && (
              <div className="space-y-2">
                {rest.map((user, idx) => {
                  const pos = idx + 4;
                  const isMe = user.id === userId;
                  return (
                    <div
                      key={user.id}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                        isMe ? 'bg-primary/5 border border-primary/20' : 'hover:bg-muted/50',
                      )}
                    >
                      <span className="text-sm font-bold text-muted-foreground w-6 text-center">{pos}</span>
                      <Avatar className="h-8 w-8">
                        {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
                        <AvatarFallback className="text-[10px]">{getInitials(user.name)}</AvatarFallback>
                      </Avatar>
                      <span className={cn('flex-1 text-sm font-medium truncate', isMe && 'text-primary')}>
                        {user.name} {isMe && <span className="text-xs text-muted-foreground">({rt?.yourPosition || 'Você'})</span>}
                      </span>
                      {user.level && user.level > 1 && <GemBadge level={user.level} size="sm" />}
                      <div className="flex items-center gap-1">
                        <CoinIcon size="xs" />
                        <span className="text-sm font-semibold">{user.points}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Section 2: Monthly Posts ─────────────────────────────────────

function MonthlyPostsSection({
  publishers,
  t,
}: {
  publishers: MonthlyPublisher[];
  t: ReturnType<typeof useT>;
}) {
  const rt = t.gamification?.ranking as Record<string, string> | undefined;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-500" />
          {rt?.monthlyPostsTitle || 'Quem Mais Publicou no Mês'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {publishers.length === 0 ? (
          <p className="text-center text-muted-foreground py-6 text-sm">{rt?.monthlyPostsEmpty || 'Nenhuma publicação este mês.'}</p>
        ) : (
          <div className="space-y-3">
            {publishers.map((pub, idx) => (
              <div key={pub.id} className="flex items-center gap-3">
                <span className="text-sm font-bold text-muted-foreground w-5 text-center">{idx + 1}</span>
                <Avatar className="h-8 w-8">
                  {pub.avatarUrl ? <AvatarImage src={pub.avatarUrl} alt={pub.name} /> : null}
                  <AvatarFallback className="text-[10px]">{getInitials(pub.name)}</AvatarFallback>
                </Avatar>
                <span className="flex-1 text-sm font-medium truncate">{pub.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {(rt?.postsCount || '{count} publicações').replace('{count}', String(pub.postCount))}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Section 3: Monthly Conquests ─────────────────────────────────

function MonthlyConquestsSection({
  conquests,
  userId,
  onCongratulate,
  t,
}: {
  conquests: MonthlyConquest[];
  userId: string;
  onCongratulate: (toUserId: string, conquestId: string) => Promise<void>;
  t: ReturnType<typeof useT>;
}) {
  const rt = t.gamification?.ranking as Record<string, string> | undefined;
  const conquestLabels = t.gamification?.conquests as Record<string, string> | undefined;

  const [congratulatedMap, setCongratulatedMap] = useState<Record<string, boolean>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

  // Initialize from server data
  useEffect(() => {
    const initial: Record<string, boolean> = {};
    conquests.forEach(c => {
      if (c.congratulatedByMe) initial[`${c.userId}_${c.conquestId}`] = true;
    });
    setCongratulatedMap(initial);
  }, [conquests]);

  const handleCongratulate = async (toUserId: string, conquestId: string) => {
    const key = `${toUserId}_${conquestId}`;
    setLoadingMap(prev => ({ ...prev, [key]: true }));
    // Optimistic update
    setCongratulatedMap(prev => ({ ...prev, [key]: true }));

    try {
      await onCongratulate(toUserId, conquestId);
    } catch {
      // Revert on failure
      setCongratulatedMap(prev => ({ ...prev, [key]: false }));
    } finally {
      setLoadingMap(prev => ({ ...prev, [key]: false }));
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Flame className="h-5 w-5 text-amber-500" />
          {rt?.monthlyConquestsTitle || 'Conquistas do Mês'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {conquests.length === 0 ? (
          <p className="text-center text-muted-foreground py-6 text-sm">{rt?.monthlyConquestsEmpty || 'Nenhuma conquista este mês.'}</p>
        ) : (
          <div className="space-y-3">
            {conquests.map((c) => {
              const key = `${c.userId}_${c.conquestId}`;
              const isCongratulated = congratulatedMap[key] || false;
              const isLoading = loadingMap[key] || false;
              const isMe = c.userId === userId;
              const label = conquestLabels?.[c.conquestId] || c.conquestLabel;

              return (
                <div key={`${c.userId}-${c.conquestId}-${c.conquestDate}`} className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    {c.avatarUrl ? <AvatarImage src={c.avatarUrl} alt={c.userName} /> : null}
                    <AvatarFallback className="text-[10px]">{getInitials(c.userName)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {(rt?.conquestBy || '{name} conquistou').replace('{name}', c.userName)}
                    </p>
                    <p className="text-xs text-muted-foreground">{label} · {formatDate(c.conquestDate)}</p>
                  </div>
                  {!isMe && (
                    <Button
                      variant={isCongratulated ? 'ghost' : 'outline'}
                      size="sm"
                      disabled={isCongratulated || isLoading}
                      onClick={() => handleCongratulate(c.userId, c.conquestId)}
                      className={cn('gap-1 text-xs', isCongratulated && 'text-green-600')}
                    >
                      {isCongratulated ? (
                        <>
                          <Check className="h-3 w-3" />
                          {rt?.congratulated || 'Parabenizado!'}
                        </>
                      ) : (
                        <>
                          <Heart className="h-3 w-3" />
                          {rt?.congratulate || 'Parabenizar'}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Section 4: My Conquests ──────────────────────────────────────

function MyConquestsSection({
  conquests,
  t,
}: {
  conquests: ConquestProgress[];
  t: ReturnType<typeof useT>;
}) {
  const rt = t.gamification?.ranking as Record<string, string> | undefined;
  const conquestLabels = t.gamification?.conquests as Record<string, string> | undefined;
  const dashboardT = t.gamification?.dashboard as Record<string, string> | undefined;

  // Group by category
  const categories = ['pub', 'trail', 'mission', 'seq'];
  const categoryNames: Record<string, string> = {
    pub: dashboardT?.pubCategory || 'Publicações',
    trail: dashboardT?.trailCategory || 'Trilhas',
    mission: dashboardT?.missionCategory || 'Missões',
    seq: dashboardT?.seqCategory || 'Sequência',
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Trophy className="h-5 w-5 text-purple-500" />
          {rt?.myConquestsTitle || 'Minhas Conquistas'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {categories.map(cat => {
            const catConquests = conquests.filter(c => c.category === cat);
            if (catConquests.length === 0) return null;
            const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.pub;
            const CatIcon = config.icon;

            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn('rounded-full p-1.5', config.bgColor)}>
                    <CatIcon className={cn('h-4 w-4', config.color)} />
                  </div>
                  <span className="text-sm font-semibold">{categoryNames[cat]}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {catConquests.map(cq => {
                    const label = conquestLabels?.[cq.conquestId] || cq.conquestId;
                    return (
                      <div
                        key={cq.conquestId}
                        className={cn(
                          'flex flex-col items-center gap-1 p-3 rounded-xl border text-center transition-all',
                          cq.completed
                            ? 'border-primary/20 bg-primary/5'
                            : 'border-muted opacity-50',
                        )}
                      >
                        <div className={cn(
                          'rounded-full p-2',
                          cq.completed ? config.bgColor : 'bg-muted',
                        )}>
                          <CatIcon className={cn('h-5 w-5', cq.completed ? config.color : 'text-muted-foreground')} />
                        </div>
                        <span className="text-xs font-medium leading-tight">{label}</span>
                        {cq.completed ? (
                          <Badge variant="default" className="text-[10px] px-1.5 py-0">
                            <Check className="h-2.5 w-2.5 mr-0.5" />
                            OK
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {(rt?.progress || '{current}/{target}')
                              .replace('{current}', String(cq.current))
                              .replace('{target}', String(cq.target))}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────

export default function RankingsPage() {
  const { user } = useAuth();
  const t = useT();
  const { toast } = useToast();
  const rt = t.gamification?.ranking as Record<string, string> | undefined;

  const [data, setData] = useState<RankingPageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async (uid: string) => {
    try {
      const token = await getAuthToken();
      const result = await getRankingPageData(token, uid);
      if (result.error) {
        toast({ variant: 'destructive', title: rt?.fetchError || 'Erro ao carregar ranking.', description: result.error });
      }
      setData(result);
    } catch (err) {
      console.error('Error fetching ranking data:', err);
      toast({ variant: 'destructive', title: rt?.fetchError || 'Erro ao carregar ranking.' });
    } finally {
      setIsLoading(false);
    }
  }, [toast, rt]);

  useEffect(() => {
    if (user?.uid) fetchData(user.uid);
  }, [user?.uid, fetchData]);

  const handleCongratulate = useCallback(async (toUserId: string, conquestId: string) => {
    if (!user?.uid) return;
    try {
      const token = await getAuthToken();
      const result = await sendCongratulation(token, user.uid, toUserId, conquestId);
      if (!result.success) {
        toast({
          variant: 'destructive',
          title: rt?.congratulateError || 'Erro ao parabenizar',
          description: result.error,
        });
        throw new Error(result.error); // triggers revert in optimistic UI
      }
    } catch (err) {
      // Re-throw so the section component can revert
      throw err;
    }
  }, [user?.uid, toast, rt]);

  if (isLoading) {
    return <RankingSkeleton />;
  }

  if (!data) return null;

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{rt?.pageTitle || 'Rankings & Conquistas'}</h1>
        <p className="text-sm text-muted-foreground">{rt?.pageSubtitle || 'Acompanhe o desempenho do time'}</p>
      </div>

      {/* Section 1: Top 10 */}
      <Top10Section
        ranking={data.ranking}
        currentUserRank={data.currentUserRank}
        monthlyPrizeName={data.monthlyPrizeName}
        userId={user?.uid || ''}
        t={t}
      />

      {/* Sections 2 & 3: Monthly Posts + Monthly Conquests side by side */}
      <div className="grid md:grid-cols-2 gap-6">
        <MonthlyPostsSection publishers={data.monthlyPublishers} t={t} />
        <MonthlyConquestsSection
          conquests={data.monthlyConquests}
          userId={user?.uid || ''}
          onCongratulate={handleCongratulate}
          t={t}
        />
      </div>

      {/* Section 4: My Conquests */}
      <MyConquestsSection conquests={data.myConquests} t={t} />
    </div>
  );
}
