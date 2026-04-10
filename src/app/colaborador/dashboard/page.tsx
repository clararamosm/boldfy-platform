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
    Trophy, Target, BookOpen, Gift, ChevronRight,
    Linkedin, Heart, MessageCircle, TrendingUp, ExternalLink,
    Loader2, Unplug, CalendarDays
} from 'lucide-react';
import { getLinkedInDashboardMetrics, type PostWithMetrics, type DashboardMetrics } from '@/app/actions/linkedin';
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
            <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                <Target className="h-4 w-4 text-amber-600" />
            </div>
            <span className="text-sm font-medium">{title}</span>
        </div>
        <div className="flex items-center gap-2">
            <span className="text-xs text-amber-600 font-medium">+{points} {pointsLabel}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
    </Link>
);

const TrailItem = ({ title, progress }: { title: string; progress: number }) => (
    <Link href="/colaborador/trilhas" className="block p-3 -mx-3 rounded-lg hover:bg-muted/50 transition-colors">
        <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <BookOpen className="h-4 w-4 text-blue-600" />
                </div>
                <span className="text-sm font-medium">{title}</span>
            </div>
            <span className="text-xs text-muted-foreground">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
    </Link>
);

// ---- LinkedIn Post Card ----
const LinkedInPostCard = ({ post }: { post: PostWithMetrics }) => {
    const captionPreview = post.caption.length > 120
        ? post.caption.substring(0, 120) + '...'
        : post.caption;

    const publishDate = post.publishedAt
        ? new Date(post.publishedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
        : '';

    return (
        <div className="flex items-start gap-3 p-3 -mx-3 rounded-lg hover:bg-muted/50 transition-colors">
            <div className="h-9 w-9 rounded-full bg-[#0A66C2]/10 flex items-center justify-center shrink-0">
                <Linkedin className="h-4 w-4 text-[#0A66C2]" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground line-clamp-2">{captionPreview}</p>
                <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-muted-foreground">{publishDate}</span>
                    <div className="flex items-center gap-1 text-xs text-rose-500">
                        <Heart className="h-3 w-3" />
                        <span>{post.metrics.totalReactions}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-blue-500">
                        <MessageCircle className="h-3 w-3" />
                        <span>{post.metrics.comments}</span>
                    </div>
                    {post.linkedinPostUrl && (
                        <a
                            href={post.linkedinPostUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-[#0A66C2] transition-colors"
                        >
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
};

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

const LinkedInSkeleton = () => (
    <Card className="border-[#0A66C2]/20">
        <CardHeader className="pb-3">
            <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
                {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
            </div>
            <div className="space-y-3">
                {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-14" />
                ))}
            </div>
        </CardContent>
    </Card>
);

// ---- Main Component ----
export default function ColaboradorDashboardPage() {
    const { user: authUser } = useAuth();
    const [data, setData] = useState<DashboardData | null>(null);
    const [linkedinMetrics, setLinkedinMetrics] = useState<DashboardMetrics | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [linkedinLoading, setLinkedinLoading] = useState(true);
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

            // Fetch LinkedIn metrics (non-blocking)
            try {
                const token = await getAuthToken();
                const metrics = await getLinkedInDashboardMetrics(token, uid);
                setLinkedinMetrics(metrics);
            } catch (err) {
                console.error('LinkedIn metrics error:', err);
                setLinkedinMetrics(null);
            } finally {
                setLinkedinLoading(false);
            }

        } catch (err) {
            console.error('Dashboard error:', err);
            toast({
                title: t.colabDashboard.loadingError,
                description: t.colabDashboard.loadingErrorDescription,
                variant: "destructive"
            });
            setIsLoading(false);
            setLinkedinLoading(false);
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

    const hasLinkedin = linkedinMetrics && !linkedinMetrics.error;
    const hasPosts = hasLinkedin && linkedinMetrics.totals.totalPosts > 0;

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
                                <Trophy className="h-4 w-4 text-amber-500" />
                                <span className="text-xs font-medium">{t.colabDashboard.points}</span>
                            </div>
                            <p className="text-2xl font-bold">{data.points}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                <Target className="h-4 w-4 text-green-500" />
                                <span className="text-xs font-medium">{t.colabDashboard.activeMissions}</span>
                            </div>
                            <p className="text-2xl font-bold">{data.activeMissions.length}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                <BookOpen className="h-4 w-4 text-blue-500" />
                                <span className="text-xs font-medium">{t.colabDashboard.trails}</span>
                            </div>
                            <p className="text-2xl font-bold">{data.completedTrails}/{data.totalTrails}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                <Gift className="h-4 w-4 text-purple-500" />
                                <span className="text-xs font-medium">{t.colabDashboard.rewards}</span>
                            </div>
                            <p className="text-2xl font-bold">{data.availableRewards}</p>
                        </CardContent>
                    </Card>
                </div>

                {/* LinkedIn Metrics Section */}
                {linkedinLoading ? (
                    <LinkedInSkeleton />
                ) : linkedinMetrics?.error === 'LinkedIn nao conectado.' ? (
                    <Card className="border-dashed border-[#0A66C2]/30">
                        <CardContent className="p-6">
                            <div className="flex flex-col items-center text-center gap-3 py-4">
                                <div className="h-12 w-12 rounded-full bg-[#0A66C2]/10 flex items-center justify-center">
                                    <Linkedin className="h-6 w-6 text-[#0A66C2]" />
                                </div>
                                <div>
                                    <p className="font-semibold">{t.colabDashboard.connectLinkedin}</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {t.colabDashboard.connectLinkedinDescription}
                                    </p>
                                </div>
                                <Button asChild variant="outline" className="mt-2 border-[#0A66C2] text-[#0A66C2] hover:bg-[#0A66C2]/5">
                                    <Link href="/colaborador/configuracoes">
                                        <Linkedin className="mr-2 h-4 w-4" /> {t.colabDashboard.connectButton}
                                    </Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ) : linkedinMetrics?.error ? (
                    <Card className="border-dashed border-amber-300">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-3 text-amber-700">
                                <Unplug className="h-5 w-5 shrink-0" />
                                <div>
                                    <p className="font-medium text-sm">{linkedinMetrics.error}</p>
                                    <Link href="/colaborador/configuracoes" className="text-xs text-[#0A66C2] hover:underline mt-1 inline-block">
                                        {t.colabDashboard.goToSettings}
                                    </Link>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ) : hasPosts ? (
                    <Card className="border-[#0A66C2]/20">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Linkedin className="h-5 w-5 text-[#0A66C2]" />
                                    <CardTitle className="text-lg">{t.colabDashboard.linkedinPerformance}</CardTitle>
                                </div>
                                <Link href="/colaborador/calendario" className="text-xs text-primary hover:underline">
                                    {t.colabDashboard.seeCalendar}
                                </Link>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Metric Summary Cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="bg-[#0A66C2]/5 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-[#0A66C2]">{linkedinMetrics!.totals.totalPosts}</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">{t.colabDashboard.publishedPosts}</p>
                                </div>
                                <div className="bg-rose-50 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-rose-600">{linkedinMetrics!.totals.totalReactions}</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">{t.colabDashboard.totalReactions}</p>
                                </div>
                                <div className="bg-blue-50 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-blue-600">{linkedinMetrics!.totals.totalComments}</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">{t.colabDashboard.comments}</p>
                                </div>
                                <div className="bg-green-50 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-green-600">{linkedinMetrics!.totals.avgReactionsPerPost}</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">{t.colabDashboard.avgReactionsPerPost}</p>
                                </div>
                            </div>

                            {/* Recent Posts */}
                            <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t.colabDashboard.recentPosts}</p>
                                <div className="space-y-1">
                                    {linkedinMetrics!.posts.slice(0, 5).map(post => (
                                        <LinkedInPostCard key={post.id} post={post} />
                                    ))}
                                </div>
                            </div>

                            {linkedinMetrics!.posts.length > 5 && (
                                <div className="text-center pt-1">
                                    <Link href="/colaborador/calendario" className="text-xs text-[#0A66C2] hover:underline">
                                        {t.colabDashboard.seeAllPosts.replace('{count}', String(linkedinMetrics!.totals.totalPosts))}
                                    </Link>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ) : hasLinkedin ? (
                    <Card className="border-[#0A66C2]/20">
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <Linkedin className="h-5 w-5 text-[#0A66C2]" />
                                <CardTitle className="text-lg">{t.colabDashboard.linkedinPerformance}</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col items-center text-center gap-3 py-6">
                                <div className="h-12 w-12 rounded-full bg-[#0A66C2]/10 flex items-center justify-center">
                                    <CalendarDays className="h-6 w-6 text-[#0A66C2]" />
                                </div>
                                <div>
                                    <p className="font-medium">{t.colabDashboard.noPostsYet}</p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {t.colabDashboard.noPostsDescription}
                                    </p>
                                </div>
                                <Button asChild variant="outline" className="mt-1">
                                    <Link href="/colaborador/calendario/novo">
                                        <CalendarDays className="mr-2 h-4 w-4" /> {t.colabDashboard.createPost}
                                    </Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ) : null}

                {/* Content Grid */}
                <div className="grid md:grid-cols-2 gap-6">
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
                                    {data.trails.slice(0, 4).map(t => (
                                        <TrailItem key={t.id} title={t.title} progress={t.progress} />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
