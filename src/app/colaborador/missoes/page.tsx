// src/app/colaborador/missoes/page.tsx
'use client';

import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, Upload, Clock, Zap, CalendarDays, Loader2, History, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ActionDialog } from "@/components/dashboard/action-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import React, { useState, useEffect, useCallback } from "react";
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

type MissionStatus = 'completa' | 'pendente' | 'agendada' | 'expirada' | 'cancelada';

type Mission = {
    id: string;
    name: string;
    description: string;
    points: number;
    status: MissionStatus;
    startDate?: any;
    endDate?: any;
    type: 'timed' | 'fixed';
    adminStatus?: string;
};

// ---- Sub-components ----
const MissionCard = ({ name, description, points, status, startDate, endDate }: Mission) => {
    const [fileUploaded, setFileUploaded] = useState(false);

    const uploadForm = (
        <div className="space-y-2">
            <Label htmlFor="submission-file" className="sr-only">Arquivo</Label>
            <Input id="submission-file" type="file" accept="image/*,video/*,.pdf" onChange={(e) => setFileUploaded((e.target.files?.length ?? 0) > 0)} />
            <p className="text-xs text-muted-foreground pt-1">Envie uma imagem, video ou PDF como comprovacao.</p>
        </div>
    );

    const statusInfo: Record<MissionStatus, { icon: React.ReactNode; text: string; color: string; badge?: string; badgeVariant?: string; button: React.ReactNode }> = {
        completa: {
            icon: <CheckCircle className="h-4 w-4 mr-2" />,
            text: "Missao Completa",
            color: "text-green-600",
            badge: "Concluida",
            badgeVariant: "bg-green-100 text-green-700",
            button: <Button disabled variant="secondary">Concluida</Button>
        },
        pendente: {
            icon: null,
            text: "",
            color: "",
            button: (
                <ActionDialog
                    title="Enviar Comprovacao"
                    description={`Envie um anexo para completar a missao "${name}".`}
                    trigger={<Button><Upload className="mr-2 h-4 w-4" /> Enviar Comprovacao</Button>}
                    actionText={fileUploaded ? "Concluir Missao" : "Selecione um arquivo"}
                    showCancel
                >
                    {uploadForm}
                </ActionDialog>
            )
        },
        agendada: {
            icon: <Clock className="h-4 w-4 mr-2" />,
            text: "Missao Agendada",
            color: "text-muted-foreground",
            badge: "Agendada",
            badgeVariant: "bg-blue-100 text-blue-700",
            button: <Button disabled>Em breve</Button>
        },
        expirada: {
            icon: <Clock className="h-4 w-4 mr-2" />,
            text: "Missao Expirada",
            color: "text-orange-600",
            badge: "Expirada",
            badgeVariant: "bg-orange-100 text-orange-700",
            button: <Button disabled variant="outline">Expirada</Button>
        },
        cancelada: {
            icon: <XCircle className="h-4 w-4 mr-2" />,
            text: "Missao Cancelada",
            color: "text-red-600",
            badge: "Cancelada",
            badgeVariant: "bg-red-100 text-red-700",
            button: <Button disabled variant="outline">Cancelada</Button>
        }
    };

    const currentStatus = statusInfo[status];
    const isHistory = status === 'completa' || status === 'expirada' || status === 'cancelada';

    return (
        <Card className={isHistory ? 'opacity-80' : ''}>
            <CardHeader>
                <div className="flex justify-between items-start gap-4">
                    <CardTitle className="font-headline text-lg">{name}</CardTitle>
                    <div className="flex items-center gap-2 shrink-0">
                        {currentStatus.badge && (
                            <Badge variant="secondary" className={currentStatus.badgeVariant}>
                                {currentStatus.badge}
                            </Badge>
                        )}
                        <Badge variant="secondary" className="bg-primary/10 text-primary whitespace-nowrap">
                            <Zap className="h-3 w-3 mr-1"/> {points}
                        </Badge>
                    </div>
                </div>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                {startDate && endDate && (
                    <div className="text-xs text-muted-foreground flex items-center">
                        <CalendarDays className="h-3 w-3 mr-1.5" />
                        <span>Periodo: {startDate.toDate().toLocaleDateString()} - {endDate.toDate().toLocaleDateString()}</span>
                    </div>
                )}
            </CardContent>
            <CardFooter className="flex justify-between items-center">
                {status !== 'pendente' ? (
                    <div className={`text-sm ${currentStatus.color} flex items-center font-medium`}>
                        {currentStatus.icon}
                        {currentStatus.text}
                    </div>
                ) : (
                    <span/>
                )}
                {currentStatus.button}
            </CardFooter>
        </Card>
    );
};

const MissionsPageSkeleton = () => (
    <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
            <Card key={i}>
                <CardHeader>
                    <div className="flex justify-between items-start gap-4">
                        <div className="space-y-2">
                            <Skeleton className="h-6 w-56" />
                            <Skeleton className="h-4 w-72" />
                        </div>
                        <Skeleton className="h-5 w-16" />
                    </div>
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-4 w-48" />
                </CardContent>
                <CardFooter className="flex justify-end items-center">
                    <Skeleton className="h-10 w-44" />
                </CardFooter>
            </Card>
        ))}
    </div>
);

// ---- Main Component ----
export default function InfluencerMissoesPage() {
    const [missions, setMissions] = useState<Mission[]>([]);
    const [historyMissions, setHistoryMissions] = useState<Mission[]>([]);
    const [stats, setStats] = useState({ weeklyPoints: 0, fixedProgress: 0, fixedCompleted: 0, fixedTotal: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const deriveMissionStatus = (missionDoc: any, now: Date): { status: MissionStatus; isActive: boolean } => {
        const adminStatus = missionDoc.status;

        // Cancelled missions go to history
        if (adminStatus === 'Cancelada') {
            return { status: 'cancelada', isActive: false };
        }

        // Inactive/past missions go to history
        if (adminStatus === 'Inativa' || adminStatus === 'Passada') {
            return { status: 'expirada', isActive: false };
        }

        // Check if timed mission has expired
        if (missionDoc.endDate && missionDoc.endDate.toDate() < now) {
            return { status: 'expirada', isActive: false };
        }

        // Pending admin approval - show as scheduled
        if (adminStatus === 'Pendente') {
            return { status: 'agendada', isActive: true };
        }

        // Active missions
        if (adminStatus === 'Ativa' || adminStatus === 'Fixa' || adminStatus === 'Agendada') {
            return { status: 'pendente', isActive: true };
        }

        // Completed missions go to history
        if (adminStatus === 'Concluida' || adminStatus === 'Completa') {
            return { status: 'completa', isActive: false };
        }

        return { status: 'pendente', isActive: true };
    };

    const fetchMissions = useCallback(async (user: User) => {
        setIsLoading(true);
        try {
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (!userDocSnap.exists()) throw new Error("User not found.");

            const companyId = userDocSnap.data().companyId;
            if (!companyId) throw new Error("CompanyId not found for user.");

            const missionsQuery = query(collection(db, "companies", companyId, "missions"));
            const missionsSnap = await getDocs(missionsQuery);

            const now = new Date();
            const active: Mission[] = [];
            const history: Mission[] = [];

            missionsSnap.docs.forEach(docSnap => {
                const data = docSnap.data();
                const { status, isActive } = deriveMissionStatus(data, now);

                const mission: Mission = {
                    id: docSnap.id,
                    name: data.title || data.name || 'Sem titulo',
                    description: data.description || '',
                    points: data.points || 0,
                    status,
                    startDate: data.startDate || null,
                    endDate: data.endDate || null,
                    type: data.type || 'fixed',
                    adminStatus: data.status
                };

                if (isActive) {
                    active.push(mission);
                } else {
                    history.push(mission);
                }
            });

            // Sort history: completed first, then expired, then cancelled
            const statusOrder: Record<string, number> = { completa: 0, expirada: 1, cancelada: 2 };
            history.sort((a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3));

            const fixedActive = active.filter(m => m.type === 'fixed');
            const completedFixed = fixedActive.filter(m => m.status === 'completa').length;

            setMissions(active);
            setHistoryMissions(history);
            setStats({
                weeklyPoints: 0,
                fixedCompleted: completedFixed,
                fixedTotal: fixedActive.length,
                fixedProgress: fixedActive.length > 0 ? (completedFixed / fixedActive.length) * 100 : 0,
            });
        } catch (error) {
            console.error("Error fetching missions: ", error);
            toast({ variant: 'destructive', title: 'Erro ao buscar missoes.', description: (error as Error).message });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                fetchMissions(user);
            } else {
                setIsLoading(false);
            }
        });
        return () => unsubscribe();
    }, [fetchMissions]);

    const weeklyMissions = missions.filter(m => m.type === 'timed');
    const fixedMissions = missions.filter(m => m.type === 'fixed');

    const renderMissions = (missionList: Mission[]) => {
        if (isLoading) {
            return <MissionsPageSkeleton />;
        }
        if (missionList.length === 0) {
            return <p className="text-center text-muted-foreground py-8">Nenhuma missao nesta categoria.</p>;
        }
        return (
            <div className="space-y-4">
                {missionList.map(mission => <MissionCard key={mission.id} {...mission} />)}
            </div>
        );
    };

    return (
        <>
            <Header title="Missoes" />
            <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
                <Card>
                    <CardContent className="grid gap-4 md:grid-cols-2 p-4">
                        <div className="p-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                                <Zap className="h-4 w-4"/> Pontos de Missoes da Semana
                            </div>
                            <div className="text-3xl font-bold">{stats.weeklyPoints}</div>
                        </div>
                        <div className="p-2">
                            <div className="flex items-center justify-between gap-2 text-sm font-medium text-muted-foreground mb-2">
                                <span>Progresso em Missoes Fixas</span>
                                <span>{stats.fixedCompleted} / {stats.fixedTotal}</span>
                            </div>
                            <Progress value={stats.fixedProgress} className="h-2" />
                            {stats.fixedProgress === 100 && <p className="text-xs text-muted-foreground mt-2">Voce completou todas as missoes fixas!</p>}
                        </div>
                    </CardContent>
                </Card>

                <Tabs defaultValue="semana">
                    <TabsList className="mb-4">
                        <TabsTrigger value="semana">Missoes da Semana</TabsTrigger>
                        <TabsTrigger value="fixas">Missoes Fixas</TabsTrigger>
                        <TabsTrigger value="historico" className="flex items-center gap-1.5">
                            <History className="h-3.5 w-3.5" />
                            Historico
                            {historyMissions.length > 0 && (
                                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                                    {historyMissions.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="semana">
                        {renderMissions(weeklyMissions)}
                    </TabsContent>
                    <TabsContent value="fixas">
                        {renderMissions(fixedMissions)}
                    </TabsContent>
                    <TabsContent value="historico">
                        {isLoading ? (
                            <MissionsPageSkeleton />
                        ) : historyMissions.length === 0 ? (
                            <div className="text-center py-12">
                                <History className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                                <p className="text-muted-foreground font-medium">Nenhuma missao no historico</p>
                                <p className="text-sm text-muted-foreground mt-1">Missoes concluidas, expiradas ou canceladas aparecerao aqui.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {historyMissions.map(mission => <MissionCard key={mission.id} {...mission} />)}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </main>
        </>
    );
}
