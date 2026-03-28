// src/app/influencer/missoes/page.tsx
'use client';

import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, Upload, Clock, Zap, CalendarDays, Loader2 } from "lucide-react";
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

type MissionStatus = 'completa' | 'pendente' | 'agendada';

type Mission = {
    id: string;
    name: string;
    description: string;
    points: number;
    status: MissionStatus;
    startDate?: any;
    endDate?: any;
    type: 'timed' | 'fixed';
};

const MissionCard = ({ name, description, points, status, startDate, endDate }: Mission) => {
    const [fileUploaded, setFileUploaded] = useState(false);

    const uploadForm = (
        <div className="space-y-2">
            <Label htmlFor="submission-file" className="sr-only">Arquivo</Label>
            <Input id="submission-file" type="file" accept="image/*,video/*,.pdf" onChange={(e) => setFileUploaded(e.target.files.length > 0)} />
            <p className="text-xs text-muted-foreground pt-1">Envie uma imagem, vídeo ou PDF como comprovação.</p>
        </div>
    );

    const statusInfo = {
        completa: {
            icon: <CheckCircle className="h-4 w-4 mr-2" />,
            text: "Missão Completa",
            color: "text-green-600",
            button: <Button disabled variant="secondary">Concluída</Button>
        },
        pendente: {
            icon: null,
            text: "",
            color: "",
            button: (
                <ActionDialog
                    title="Enviar Comprovação"
                    description={`Envie um anexo para completar a missão "${name}".`}
                    trigger={<Button><Upload className="mr-2 h-4 w-4" /> Enviar Comprovação</Button>}
                    actionText={fileUploaded ? "Concluir Missão" : "Selecione um arquivo"}
                    showCancel
                >
                    {uploadForm}
                </ActionDialog>
            )
        },
        agendada: {
            icon: <Clock className="h-4 w-4 mr-2" />,
            text: "Missão Agendada",
            color: "text-muted-foreground",
            button: <Button disabled>Em breve</Button>
        }
    }

    const currentStatus = statusInfo[status];

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start gap-4">
                    <CardTitle className="font-headline text-lg">{name}</CardTitle>
                    <Badge variant="secondary" className="bg-primary/10 text-primary whitespace-nowrap shrink-0">
                        <Zap className="h-3 w-3 mr-1"/> {points}
                    </Badge>
                </div>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                {startDate && endDate && (
                    <div className="text-xs text-muted-foreground flex items-center">
                        <CalendarDays className="h-3 w-3 mr-1.5" />
                        <span>Período: {startDate.toDate().toLocaleDateString()} - {endDate.toDate().toLocaleDateString()}</span>
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
    )};
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
)

export default function InfluencerMissoesPage() {
    const [missions, setMissions] = useState<Mission[]>([]);
    const [stats, setStats] = useState({ weeklyPoints: 0, fixedProgress: 0, fixedCompleted: 0, fixedTotal: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const deriveMissionStatus = (missionDoc: any): MissionStatus => {
        const adminStatus = missionDoc.status;
        // If mission is Pendente in admin (awaiting approval), show as agendada to influencer
        if (adminStatus === 'Pendente') return 'agendada';
        // If mission is Inativa or Passada, don't show (filtered out)
        // If mission is Ativa or Fixa, it's available for the influencer
        if (adminStatus === 'Ativa' || adminStatus === 'Fixa' || adminStatus === 'Agendada') return 'pendente';
        return 'pendente';
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
            const allMissions = missionsSnap.docs
                .map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        status: deriveMissionStatus(data),
                    } as Mission;
                })
                .filter(m => {
                    // Only show active/fixed/scheduled missions to influencers (not Inativa or Passada)
                    const adminStatus = missionsSnap.docs.find(d => d.id === m.id)?.data().status;
                    if (adminStatus === 'Inativa' || adminStatus === 'Passada') return false;
                    // For timed missions, only show if end date hasn't passed
                    if (m.type === 'timed' && m.endDate?.toDate() < now) return false;
                    return true;
                });

            const timedMissions = allMissions.filter(m => m.type === 'timed');
            const fixedMissions = allMissions.filter(m => m.type === 'fixed');
            const completedFixed = fixedMissions.filter(m => m.status === 'completa').length;

            setMissions(allMissions);
            setStats({
                weeklyPoints: 0,
                fixedCompleted: completedFixed,
                fixedTotal: fixedMissions.length,
                fixedProgress: fixedMissions.length > 0 ? (completedFixed / fixedMissions.length) * 100 : 0,
            });
        } catch(error) {
            console.error("Error fetching missions: ", error);
            toast({ variant: 'destructive', title: 'Erro ao buscar missões.', description: (error as Error).message });
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
            return <p className="text-center text-muted-foreground py-8">Nenhuma missão nesta categoria.</p>;
        }
        return (
            <div className="space-y-4">
                {missionList.map(mission => <MissionCard key={mission.id} {...mission} />)}
            </div>
        )
    }

    return (
        <>
            <Header title="Missões" />
            <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
                <Card>
                    <CardContent className="grid gap-4 md:grid-cols-2 p-4">
                        <div className="p-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                                <Zap className="h-4 w-4"/> Pontos de Missões da Semana
                            </div>
                            <div className="text-3xl font-bold">{stats.weeklyPoints}</div>
                        </div>
                        <div className="p-2">
                            <div className="flex items-center justify-between gap-2 text-sm font-medium text-muted-foreground mb-2">
                                <span>Progresso em Missões Fixas</span>
                                <span>{stats.fixedCompleted} / {stats.fixedTotal}</span>
                            </div>
                            <Progress value={stats.fixedProgress} className="h-2" />
                            {stats.fixedProgress === 100 && <p className="text-xs text-muted-foreground mt-2">Você completou todas as missões fixas!</p>}
                        </div>
                    </CardContent>
                </Card>

                <Tabs defaultValue="semana">
                    <TabsList className="mb-4">
                        <TabsTrigger value="semana">Missões da Semana</TabsTrigger>
                        <TabsTrigger value="fixas">Missões Fixas</TabsTrigger>
                    </TabsList>
                    <TabsContent value="semana">
                        {renderMissions(weeklyMissions)}
                    </TabsContent>
                    <TabsContent value="fixas">
                        {renderMissions(fixedMissions)}
                    </TabsContent>
                </Tabs>
            </main>
        </>
    );
}
