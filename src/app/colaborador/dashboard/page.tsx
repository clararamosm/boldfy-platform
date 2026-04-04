// src/app/colaborador/dashboard/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
    collection, getDocs, getDoc, doc, query, where, orderBy, limit
} from 'firebase/firestore';
import { Header } from "@/components/dashboard/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import {
    Trophy, Target, BookOpen, Gift, ChevronRight, Star, TrendingUp
} from 'lucide-react';

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

type Reward = {
    id: string;
    title: string;
    pointsCost: number;
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
const MissionItem = ({ title, points }: { title: string; points: number }) => (
    <Link href="/colaborador/missoes" className="flex items-center justify-between p-3 -mx-3 rounded-lg hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                <Target className="h-4 w-4 text-amber-600" />
            </div>
            <span className="text-sm font-medium">{title}</span>
        </div>
        <div className="flex items-center gap-2">
            <span className="text-xs text-amber-600 font-medium">+{points} pontos</span>
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
export default function InfluencerDashboardPage() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
            if (!user) return;

            try {
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);

                if (!userDocSnap.exists()) return;

                const userData = userDocSnap.data();
                const companyId = userData.companyId;
                if (!companyId) return;

                // Fetch missions, trails, rewards, and trail progress in parallel
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
                    getDocs(collection(db, "users", user.uid, "trailProgress"))
                ]);

                // Process missions
                const missions: Mission[] = missionsSnap.docs.map(d => ({
                    id: d.id,
                    title: d.data().title || d.data().name || 'Sem titulo',
                    points: d.data().points || 0,
                    status: d.data().status || ''
                }));

                // Process trail progress map
                const progressMap: Record<string, number[]> = {};
                progressSnap.docs.forEach(d => {
                    progressMap[d.id] = d.data().completedPhases || [];
                });

                // Process trails with real progress
                const trails: Trail[] = trailsSnap.docs.map(d => {
                    const tData = d.data();
                    const totalPhases = (tData.phases || []).length;
                    const completed = progressMap[d.id] || [];
                    const completedCount = completed.length;
                    const progress = totalPhases > 0 ? Math.round((completedCount / totalPhases) * 100) : 0;
                    return {
                        id: d.id,
                        title: tData.title || 'Sem titulo',
                        totalPhases,
                        completedPhases: completedCount,
                        progress
                    };
                });

                const completedTrails = trails.filter(t => t.progress === 100).length;

                setData({
                    userName: userData.profile?.name || userData.name || user.displayName || 'Colaborador',
                    points: userData.points || 0,
                    activeMissions: missions,
                    trails,
                    availableRewards: rewardsSnap.docs.length,
                    completedTrails,
                    totalTrails: trails.length
                });
            } catch (err) {
                console.error('Dashboard error:', err);
                toast({
                    title: "Erro ao carregar dashboard",
                    description: "Tente novamente mais tarde.",
                    variant: "destructive"
                });
            } finally {
                setIsLoading(false);
            }
        });

        return () => unsubscribe();
    }, [toast]);

    if (isLoading) {
        return (
            <div>
                <Header title="Dashboard" subtitle="Carregando..." />
                <div className="p-6">
                    <DashboardSkeleton />
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div>
                <Header title="Dashboard" subtitle="Erro ao carregar dados" />
                <div className="p-6 text-center text-muted-foreground">
                    Nenhum dado encontrado. Verifique sua conta.
                </div>
            </div>
        );
    }

    return (
        <div>
            <Header
                title={`Ola, ${data.userName}!`}
                subtitle="Acompanhe seu progresso e conquistas"
            />
            <div className="p-6 space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                <Trophy className="h-4 w-4 text-amber-500" />
                                <span className="text-xs font-medium">Pontos</span>
                            </div>
                            <p className="text-2xl font-bold">{data.points}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                <Target className="h-4 w-4 text-green-500" />
                                <span className="text-xs font-medium">Missoes Ativas</span>
                            </div>
                            <p className="text-2xl font-bold">{data.activeMissions.length}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                <BookOpen className="h-4 w-4 text-blue-500" />
                                <span className="text-xs font-medium">Trilhas</span>
                            </div>
                            <p className="text-2xl font-bold">{data.completedTrails}/{data.totalTrails}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                <Gift className="h-4 w-4 text-purple-500" />
                                <span className="text-xs font-medium">Recompensas</span>
                            </div>
                            <p className="text-2xl font-bold">{data.availableRewards}</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Content Grid */}
                <div className="grid md:grid-cols-2 gap-6">
                    {/* Active Missions */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">Missoes Ativas</CardTitle>
                                <Link href="/colaborador/missoes" className="text-xs text-primary hover:underline">
                                    Ver todas
                                </Link>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {data.activeMissions.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    Nenhuma missao ativa no momento
                                </p>
                            ) : (
                                <div className="space-y-1">
                                    {data.activeMissions.slice(0, 4).map(m => (
                                        <MissionItem key={m.id} title={m.title} points={m.points} />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Trails Progress */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">Trilhas de Aprendizado</CardTitle>
                                <Link href="/colaborador/trilhas" className="text-xs text-primary hover:underline">
                                    Ver todas
                                </Link>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {data.trails.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    Nenhuma trilha disponivel
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
