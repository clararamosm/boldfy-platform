// src/app/colaborador/recompensas/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, where, addDoc, serverTimestamp, writeBatch, orderBy } from 'firebase/firestore';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Gift, History, Zap, TrendingUp, TrendingDown, PlusCircle, MinusCircle, Loader2, BookOpen, Trophy } from "lucide-react";
import Image from "next/image";
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ActionDialog } from '@/components/dashboard/action-dialog';

type Reward = {
    id: string;
    title: string;
    name: string;
    points: number;
    imageUrl?: string;
    stock: number | 'Ilimitado';
};

type Rescue = {
    id: string;
    rewardName: string;
    date: any;
    status: 'Pendente' | 'Pago';
};

type HistoryItem = {
    id: string;
    icon: React.ReactNode;
    description: string;
    date: any;
    points: number;
    type: 'gain' | 'spend';
    source?: 'missao' | 'trilha' | 'resgate';
};

const RewardCard = ({ reward, onRedeem, disabled, isSubmitting }: { reward: Reward, onRedeem: () => void, disabled: boolean, isSubmitting: boolean }) => (
    <Card className="hover:shadow-lg transition-shadow flex flex-col">
        <CardHeader className="p-0">
            <div className="aspect-video bg-muted flex items-center justify-center rounded-t-lg overflow-hidden">
                {reward.imageUrl ? <Image src={reward.imageUrl} alt={reward.name} width={300} height={168} className="w-full h-full object-cover" data-ai-hint="reward gift" /> : <Gift className="h-12 w-12 text-muted-foreground" />}
            </div>
        </CardHeader>
        <CardContent className="p-4 flex-grow">
            <CardTitle className="text-base font-semibold">{reward.name}</CardTitle>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
            <Badge variant="secondary" className="bg-primary/10 text-primary whitespace-nowrap shrink-0">
                <Zap className="h-3 w-3 mr-1"/> {reward.points.toLocaleString()}
            </Badge>
            <ActionDialog
                title={`Resgatar ${reward.name}?`}
                description={`Isso custará ${reward.points.toLocaleString()} pontos. Esta ação não pode ser desfeita.`}
                trigger={
                    <Button size="sm" disabled={disabled || isSubmitting}>
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : disabled ? 'Pontos insuficientes' : 'Resgatar'}
                    </Button>
                }
                actionText="Confirmar Resgate"
                onAction={onRedeem}
                showCancel
            >
                <p>Você tem certeza que quer resgatar esta recompensa?</p>
            </ActionDialog>
        </CardFooter>
    </Card>
);

const getHistoryIcon = (source: HistoryItem['source'], type: HistoryItem['type']) => {
    if (type === 'spend') return <MinusCircle className="h-6 w-6 text-destructive" />;
    switch (source) {
        case 'missao': return <Trophy className="h-6 w-6 text-green-500" />;
        case 'trilha': return <BookOpen className="h-6 w-6 text-green-500" />;
        default: return <PlusCircle className="h-6 w-6 text-green-500" />;
    }
};

const PointHistoryItem = ({ icon, description, date, points, type }: HistoryItem) => (
    <div className="flex justify-between items-center p-3 rounded-lg hover:bg-muted/50">
        <div className="flex items-center gap-3">
            {icon}
            <div>
                <p className="font-medium">{description}</p>
                <p className="text-sm text-muted-foreground">{date?.toDate().toLocaleDateString()}</p>
            </div>
        </div>
        <Badge variant="secondary" className={`${type === 'gain' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'} whitespace-nowrap shrink-0`}>
            <Zap className="h-3 w-3 mr-1"/> {type === 'gain' ? '+' : '-'}{points.toLocaleString()}
        </Badge>
    </div>
);

const StatCard = ({ title, value, icon: Icon, isLoading }: {title: string, value: string | number, icon: React.ElementType, isLoading: boolean}) => (
    <Card>
        <CardHeader>
            <Icon className="h-6 w-6 text-muted-foreground mb-2" />
            <CardTitle className="text-sm font-medium h-10">{title}</CardTitle>
        </CardHeader>
        <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : <p className="text-2xl font-bold font-headline">{typeof value === 'number' ? value.toLocaleString() : value}</p>}
        </CardContent>
    </Card>
);

const PageSkeleton = () => (
    <>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
            <StatCard title="Pontos Disponíveis" value="0" icon={Zap} isLoading={true} />
            <StatCard title="Pontos Ganhos (Total)" value="0" icon={TrendingUp} isLoading={true} />
            <StatCard title="Pontos Gastos (Total)" value="0" icon={TrendingDown} isLoading={true} />
            <StatCard title="Prêmios Resgatados" value="0" icon={Gift} isLoading={true} />
        </div>
        <Tabs defaultValue="loja">
            <TabsList>
                <TabsTrigger value="loja">Loja</TabsTrigger>
                <TabsTrigger value="meus-resgates">Meus Resgates</TabsTrigger>
                <TabsTrigger value="historico-pontos">Histórico de Pontos</TabsTrigger>
            </TabsList>
            <TabsContent value="loja" className="mt-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {[...Array(4)].map((_, i) => (
                        <Card key={i}>
                            <CardHeader className="p-0"><Skeleton className="aspect-video rounded-t-lg" /></CardHeader>
                            <CardContent className="p-4 space-y-2"><Skeleton className="h-5 w-3/4" /></CardContent>
                            <CardFooter className="flex justify-between items-center">
                                <Skeleton className="h-6 w-16" />
                                <Skeleton className="h-10 w-24" />
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            </TabsContent>
        </Tabs>
    </>
);

export default function InfluencerRecompensasPage() {
    const { toast } = useToast();
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [rescues, setRescues] = useState<Rescue[]>([]);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [stats, setStats] = useState({ available: 0, gained: 0, spent: 0, redeemed: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [userInfo, setUserInfo] = useState<{uid: string, companyId: string, name: string} | null>(null);

    const fetchData = useCallback(async (userId: string) => {
        setIsLoading(true);
        try {
            // Get user doc to find companyId and name
            const userDocRef = doc(db, 'users', userId);
            const userDocSnap = await getDoc(userDocRef);

            if (!userDocSnap.exists()) {
                toast({ variant: 'destructive', title: "Erro", description: "Usuário não encontrado." });
                setIsLoading(false);
                return;
            }

            const userData = userDocSnap.data();
            const companyId = userData.companyId;

            if (!companyId) {
                toast({ variant: 'destructive', title: "Erro", description: "Empresa não associada ao usuário." });
                setIsLoading(false);
                return;
            }

            setUserInfo({ uid: userId, companyId, name: userData.name || '' });

            // Fetch rewards from companies/{companyId}/rewards
            const rewardsSnapshot = await getDocs(collection(db, 'companies', companyId, 'rewards'));
            const rewardsData: Reward[] = rewardsSnapshot.docs.map((docSnap) => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    title: data.title || '',
                    name: data.name || '',
                    points: data.points || 0,
                    imageUrl: data.imageUrl,
                    stock: data.stock ?? 'Ilimitado',
                };
            });
            setRewards(rewardsData);

            // Fetch rescues from users/{userId}/rescues
            const rescuesQuery = query(
                collection(db, 'users', userId, 'rescues'),
                orderBy('date', 'desc')
            );
            const rescuesSnapshot = await getDocs(rescuesQuery);
            const rescuesData: Rescue[] = rescuesSnapshot.docs.map((docSnap) => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    rewardName: data.rewardName || '',
                    date: data.date?.toDate(),
                    status: data.status || 'Pendente',
                };
            });
            setRescues(rescuesData);

            // Fetch history from users/{userId}/pointsHistory
            const historyQuery = query(
                collection(db, 'users', userId, 'pointsHistory'),
                orderBy('date', 'desc')
            );
            const historySnapshot = await getDocs(historyQuery);
            const historyData: HistoryItem[] = historySnapshot.docs.map((docSnap) => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    icon: getHistoryIcon(data.source, data.type),
                    description: data.description || '',
                    date: data.date,
                    points: data.points || 0,
                    type: data.type || 'gain',
                    source: data.source,
                };
            });
            setHistory(historyData);

            // Calculate stats
            const available = userData.points || 0;
            const gained = historyData
                .filter((item) => item.type === 'gain')
                .reduce((sum, item) => sum + item.points, 0);
            const spent = historyData
                .filter((item) => item.type === 'spend')
                .reduce((sum, item) => sum + item.points, 0);
            const redeemed = rescuesData.length;

            setStats({ available, gained, spent, redeemed });
        } catch (error) {
            console.error("Erro ao buscar dados de recompensas:", error);
            toast({
                variant: 'destructive',
                title: "Erro ao carregar dados",
                description: "Não foi possível carregar as recompensas. Tente novamente.",
            });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
            if (user) {
                fetchData(user.uid);
            } else {
                setIsLoading(false);
                toast({
                    variant: 'destructive',
                    title: "Usuário não autenticado",
                    description: "Faça login para acessar as recompensas.",
                });
            }
        });
        return () => unsubscribe();
    }, [fetchData, toast]);

    const handleRedeem = async (reward: Reward) => {
        if (!userInfo) return;
        if (stats.available < reward.points) {
            toast({ variant: 'destructive', title: "Pontos insuficientes!" });
            return;
        }

        setIsSubmitting(true);
        try {
            const batch = writeBatch(db);

            // Create rescue doc
            const rescueRef = doc(collection(db, 'users', userInfo.uid, 'rescues'));
            batch.set(rescueRef, {
                rewardName: reward.name,
                rewardId: reward.id,
                date: serverTimestamp(),
                status: 'Pendente',
                points: reward.points,
            });

            // Create history entry
            const historyRef = doc(collection(db, 'users', userInfo.uid, 'pointsHistory'));
            batch.set(historyRef, {
                description: `Resgate: ${reward.name}`,
                date: serverTimestamp(),
                points: reward.points,
                type: 'spend',
                source: 'resgate',
            });

            // Update user points
            const userRef = doc(db, 'users', userInfo.uid);
            batch.update(userRef, {
                points: stats.available - reward.points,
            });

            await batch.commit();

            toast({ title: "Recompensa resgatada com sucesso!" });
            fetchData(userInfo.uid);
        } catch (error) {
            console.error("Erro ao resgatar recompensa:", error);
            toast({ variant: 'destructive', title: "Erro ao resgatar recompensa." });
        } finally {
            setIsSubmitting(false);
        }
    }

    if (isLoading || !userInfo) {
        return (
            <>
                <Header title="Recompensas" />
                <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
                    <PageSkeleton />
                </main>
            </>
        )
    }

    return (
        <>
            <Header title="Recompensas" />
            <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
                <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
                    <StatCard title="Pontos Disponíveis" value={stats.available} icon={Zap} isLoading={isLoading} />
                    <StatCard title="Pontos Ganhos (Total)" value={stats.gained} icon={TrendingUp} isLoading={isLoading} />
                    <StatCard title="Pontos Gastos (Total)" value={stats.spent} icon={TrendingDown} isLoading={isLoading} />
                    <StatCard title="Prêmios Resgatados" value={stats.redeemed} icon={Gift} isLoading={isLoading} />
                </div>

                <Tabs defaultValue="loja">
                    <TabsList>
                        <TabsTrigger value="loja">Loja</TabsTrigger>
                        <TabsTrigger value="meus-resgates">Meus Resgates</TabsTrigger>
                        <TabsTrigger value="historico-pontos">Histórico de Pontos</TabsTrigger>
                    </TabsList>

                    <TabsContent value="loja" className="mt-4">
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {rewards.length > 0 ? (
                                rewards.map(reward => <RewardCard key={reward.id} reward={reward} onRedeem={() => handleRedeem(reward)} disabled={stats.available < reward.points} isSubmitting={isSubmitting} />)
                            ) : (
                                <p className="text-muted-foreground col-span-full text-center py-8">Nenhuma recompensa disponível no momento.</p>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="meus-resgates" className="mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="font-headline flex items-center gap-2">
                                    <History className="h-5 w-5 text-muted-foreground" />
                                    Meus Resgates
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {rescues.length > 0 ? (
                                    rescues.map(rescue => (
                                        <div key={rescue.id} className="flex justify-between items-center p-3 rounded-lg hover:bg-muted/50">
                                            <div>
                                                <p className="font-medium">{rescue.rewardName}</p>
                                                <p className="text-sm text-muted-foreground">{rescue.date?.toLocaleDateString()}</p>
                                            </div>
                                            <Badge variant={rescue.status === 'Pendente' ? 'destructive' : 'default'} className={rescue.status === 'Pago' ? "bg-green-600 hover:bg-green-700" : ""}>{rescue.status}</Badge>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-muted-foreground text-center py-8">Você ainda não resgatou nenhuma recompensa.</p>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="historico-pontos" className="mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="font-headline flex items-center gap-2">
                                    <History className="h-5 w-5 text-muted-foreground" />
                                    Histórico de Pontos
                                </CardTitle>
                                <CardDescription>Acompanhe aqui seus pontos ganhos e gastos.</CardDescription>
                            </CardHeader>
                            <CardContent className="divide-y divide-border -mt-2">
                                {history.length > 0 ? (
                                    history.map(item => <PointHistoryItem key={item.id} {...item} />)
                                ) : (
                                    <p className="text-muted-foreground text-center py-8">Nenhuma transação de pontos registrada.</p>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
        </>
    );
}
