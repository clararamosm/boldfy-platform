// src/app/colaborador/dashboard/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';
import {
    collection, getDocs, getDoc, doc, query, where, orderBy, limit
} from 'firebase/firestore';
import { Header } from "@/components/dashboard/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import {
    Trophy, Target, BookOpen, Gift, ChevronRight, Zap, Crown,
    Loader2,
} from 'lucide-react';
import { CoinIcon } from '@/components/coin-icon';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getCompanyRanking, type RankedUser } from '@/app/actions';
import { getAuthToken } from '@/lib/auth-client';
import { useT } from '@/lib/i18n/context';

// ---- Types ----
type Mission = {
    id: string;
    title: string;
    points: number;
    status: string;
};

type Trail = {
    id: string;
    title: string;
    totalPhases: number;
    completedPhases: number;
    progress: number;
};

type DashboardData = {
    userName: string;
    points: number;
    activeMissions: Mission[];
    trails: Trail[];
    availableRewards: number;
    completedTrails: number;
    totalTrails: number;
};

// ---- Sub-components ----
const MissionItem = ({ title, points, pointsLabel }: { title: string; points: number; pointsLabel: string }) => (
    <Link href="/colaborador/missoes" className="flex items-center justify-between p-3 -mx-3 rounded-lg hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Zap className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-medium">{title}</span>
        </div>
        <div className="flex items-center gap-2">
            <span className="text-xs text-primary font-medium">+{points} {pointsLabel}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
    </Link>
);

const TrailItem = ({ title, progress }: { title: string; progress: number }) => (
    <Link href="/colaborador/trilhas" className="block p-3 -mx-3 rounded-lg hover:bg-muted/50 transition-colors">
        <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <BookOpen className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-medium">{title}</span>
            </div>
            <span className="text-xs text-muted-foreground">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
    </Link>
);


// ---- Skeletons ----
const DashboardSkeleton = () => (
    <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
                <Card key={i}>
                    <CardContent className="p-4">
                        <Skeleton className="h-4 w-20 mb-2" />
                        <Skeleton className="h-8 w-16" />
                    </CardContent>
                </Card>
            ))}
        </div>
        <div className="grid md:grid-cols-2 gap-6">
            <Card><CardContent className="p-6"><Skeleton className="h-40" /></CardContent></Card>
            <Card><CardContent className="p-6"><Skeleton className="h-40" /></CardContent></Card>
        </div>
    </div>
);


// ---- Main Component ----
export default function ColaboradorDashboardPage() {
    const { user: authUser } = useAuth();
    const [data, setData] = useState<DashboardData | null>(null);
    const [ranking, setRanking] = useState<(RankedUser & { isCurrentUser?: boolean })[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const t = useT();

    const fetchDashboard = useCallback(async (uid: string) => {
        try {
            const userDocRef = doc(db, "users", uid);
            const userDocSnap = await getDoc(userDocRef);

            if (!userDocSnap.exists()) return;

            const userData = userDocSnap.data();
            const companyId = userData.companyId;
            if (!companyId) return;

            const [missionsSnap, trailsSnap, rewardsSnap, progressSnap] = await Promise.all([
                getDocs(query(
                    collection(db, "companies", companyId, "missions"),
                    where("status", "==", "Ativa"),
                    limit(5)
                )),
                getDocs(query(
                    collection(db, "companies", companyId, "trails"),
                    where("active", "==", true),
                    orderBy("order", "asc")
                )),
                getDocs(collection(db, "companies", companyId, "rewards")),
                getDocs(collection(db, "users", uid, "trailProgress"))
            ]);

            const missions: Mission[] = missionsSnap.docs.map(d => ({
                id: d.id,
                title: d.data().title || d.data().name || 'Sem titulo',
                points: d.data().points || 0,
                status: d.data().status || ''
            }));

            const progressMap: Record<string, number[]> = {};
            progressSnap.docs.forEach(d => {
                progressMap[d.id] = d.data().completedPhases || [];
            });

            const trails: Trail[] = trailsSnap.docs.map(d => {
                const tData = d.data();
                const totalPhases = (tData.phases || []).length;
                const completed = progressMap[d.id] || [];
                const completedCount = completed.length;
                const progress = totalPhases > 0 ? Math.round((completedCount / totalPhases) * 100) : 0;
                return { id: d.id, title: tData.title || 'Sem titulo', totalPhases, completedPhases: completedCount, progress };
            });

            const completedTrails = trails.filter(tr => tr.progress === 100).length;

            setData({
                userName: userData.profile?.name || userData.name || 'Colaborador',
                points: userData.points || 0,
                activeMissions: missions,
                trails,
                availableRewards: rewardsSnap.docs.length,
                completedTrails,
                totalTrails: trails.length
            });

            setIsLoading(false);

            // Non-blocking: Ranking
            const token = await getAuthToken();

            try {
                const rankResult = await getCompanyRanking(token, uid);
                if (!rankResult.error) {
                    setRanking(rankResult.ranking.map(u => ({ ...u, isCurrentUser: u.id === uid })));
                }
            } catch (err) {
                console.error('Ranking error:', err);
            }

        } catch (err) {
            console.error('Dashboard error:', err);
            toast({
                title: t.colabDashboard.loadingError,
                description: t.colabDashboard.loadingErrorDescription,
                variant: "destructive"
            });
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        if (authUser?.uid) fetchDashboard(authUser.uid);
    }, [authUser?.uid, fetchDashboard]);

    if (isLoading) {
        return (
            <div>
                <Header title={t.nav.dashboard} subtitle={t.common.loading} />
                <div className="p-6">
                    <DashboardSkeleton />
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div>
                <Header title={t.nav.dashboard} subtitle={t.colabDashboard.loadingError} />
                <div className="p-6 text-center text-muted-foreground">
                    {t.colabDashboard.noData}
                </div>
            </div>
        );
    }

    return (
        <div>
            <Header
                title={t.colabDashboard.greeting.replace('{name}', data.userName)}
                subtitle={t.colabDashboard.subtitle}
            />
            <div className="p-6 space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                <CoinIcon size="lg" />
                                <span className="text-xs font-medium">{t.colabDashboard.points}</span>
                            </div>
                            <p className="text-2xl font-bold">{data.points}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                <Zap className="h-4 w-4 text-primary" />
                                <span className="text-xs font-medium">{t.colabDashboard.activeMissions}</span>
                            </div>
                            <p className="text-2xl font-bold">{data.activeMissions.length}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                <BookOpen className="h-4 w-4 text-primary" />
                                <span className="text-xs font-medium">{t.colabDashboard.trails}</span>
                            </div>
                            <p className="text-2xl font-bold">{data.completedTrails}/{data.totalTrails}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                <Gift className="h-4 w-4 text-primary" />
                                <span className="text-xs font-medium">{t.colabDashboard.rewards}</span>
                            </div>
                            <p className="text-2xl font-bold">{data.availableRewards}</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Content Grid — Missions, Trails + Ranking sidebar */}
                <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-6">
                    {/* Active Missions */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">{t.colabDashboard.activeMissionsTitle}</CardTitle>
                                <Link href="/colaborador/missoes" className="text-xs text-primary hover:underline">
                                    {t.common.seeAll}
                                </Link>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {data.activeMissions.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    {t.colabDashboard.noActiveMissions}
                                </p>
                            ) : (
                                <div className="space-y-1">
                                    {data.activeMissions.slice(0, 4).map(m => (
                                        <MissionItem key={m.id} title={m.title} points={m.points} pointsLabel={t.common.points} />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Trails Progress */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">{t.colabDashboard.learningTrails}</CardTitle>
                                <Link href="/colaborador/trilhas" className="text-xs text-primary hover:underline">
                                    {t.common.seeAll}
                                </Link>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {data.trails.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    {t.colabDashboard.noTrails}
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {data.trails.slice(0, 4).map(tr => (
                                        <TrailItem key={tr.id} title={tr.title} progress={tr.progress} />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Ranking — compact sidebar */}
                    <Card className="md:col-span-2 lg:col-span-1">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Trophy className="h-5 w-5 text-primary" />
                                Ranking
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {ranking.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    {t.colabRankings?.noParticipants || 'Nenhum participante'}
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {/* Top 3 — linear order: 1º, 2º, 3º */}
                                    <div className="flex items-end justify-center gap-3 pb-3 border-b">
                                        {ranking.length >= 1 && (
                                            <div className="flex flex-col items-center gap-1 -mt-2">
                                                <Crown className="h-4 w-4 text-yellow-500" />
                                                <Avatar className={`h-12 w-12 border-2 border-primary ${ranking[0].isCurrentUser ? 'ring-2 ring-primary/30' : ''}`}>
                                                    <AvatarImage src={ranking[0].avatarUrl} />
                                                    <AvatarFallback className="text-xs font-bold">{ranking[0].name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                <span className="text-[10px] font-bold text-primary">1º</span>
                                            </div>
                                        )}
                                        {ranking.length >= 2 && (
                                            <div className="flex flex-col items-center gap-1">
                                                <Avatar className="h-10 w-10 border-2 border-muted">
                                                    <AvatarImage src={ranking[1].avatarUrl} />
                                                    <AvatarFallback className="text-xs">{ranking[1].name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                <span className="text-[10px] font-bold text-muted-foreground">2º</span>
                                            </div>
                                        )}
                                        {ranking.length >= 3 && (
                                            <div className="flex flex-col items-center gap-1">
                                                <Avatar className="h-10 w-10 border-2 border-muted">
                                                    <AvatarImage src={ranking[2].avatarUrl} />
                                                    <AvatarFallback className="text-xs">{ranking[2].name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                <span className="text-[10px] font-bold text-muted-foreground">3º</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Full list */}
                                    <div className="space-y-1.5">
                                        {ranking.slice(0, 10).map((user, idx) => (
                                            <div
                                                key={user.id}
                                                className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md ${user.isCurrentUser ? 'bg-primary/5' : ''} ${user.points === 0 ? 'opacity-40' : ''}`}
                                            >
                                                <span className="text-xs font-semibold text-muted-foreground w-5 text-right">{idx + 1}</span>
                                                <Avatar className="h-7 w-7">
                                                    <AvatarImage src={user.avatarUrl} />
                                                    <AvatarFallback className="text-[10px]">{user.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                <span className={`text-sm flex-1 truncate ${user.isCurrentUser ? 'font-semibold' : ''}`}>
                                                    {user.isCurrentUser ? (t.colabRankings?.you || 'Você') : user.name}
                                                </span>
                                                <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px] h-5 px-1.5 shrink-0">
                                                    <CoinIcon size="xs" className="mr-0.5" />
                                                    {user.points.toLocaleString()}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
