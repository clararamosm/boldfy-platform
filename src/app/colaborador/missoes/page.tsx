// src/app/colaborador/missoes/page.tsx
'use client';

import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, Upload, Clock, Zap, CalendarDays, Loader2, History, XCircle, AlertCircle, HourglassIcon, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ActionDialog } from "@/components/dashboard/action-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import React, { useState, useEffect, useCallback } from "react";
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth, storage } from '@/lib/firebase';
import { collection, query, getDocs, doc, getDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { submitMissionProof, completeMissionSelf } from "@/app/actions";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type MissionStatus = 'completa' | 'pendente' | 'aguardando' | 'rejeitada' | 'agendada' | 'expirada';

type Mission = {
    id: string;
    name: string;
    description: string;
    points: number;
    status: MissionStatus;
    startDate?: any;
    endDate?: any;
    type: 'timed' | 'fixed' | 'trail_content' | 'trail_trigger';
    completionMode?: 'auto' | 'proof';
    submissionFeedback?: string;
    trailId?: string;
    moduleId?: string;
    assignedTo?: string;
};

const formatDate = (d: any) => {
    if (!d) return '';
    const date = d.toDate ? d.toDate() : new Date(d);
    return format(date, "dd/MM/yyyy", { locale: ptBR });
};

// ---- Sub-components ----
const MissionCard = ({ mission, onSubmitProof, onAutoComplete, isSubmitting }: { mission: Mission, onSubmitProof: (missionId: string, file: File) => Promise<void>, onAutoComplete: (missionId: string) => Promise<void>, isSubmitting: boolean }) => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    const handleSubmit = async () => {
        if (!selectedFile) return;
        await onSubmitProof(mission.id, selectedFile);
        setSelectedFile(null);
        setDialogOpen(false);
    };

    const statusConfig: Record<MissionStatus, { icon: React.ReactNode; text: string; color: string; badge?: string; badgeClass?: string; button: React.ReactNode }> = {
        completa: {
            icon: <CheckCircle className="h-4 w-4 mr-2" />,
            text: "Missão Concluída",
            color: "text-green-600",
            badge: "Concluída",
            badgeClass: "bg-green-100 text-green-700",
            button: <Button disabled variant="secondary"><CheckCircle className="mr-2 h-4 w-4" />Concluída</Button>
        },
        aguardando: {
            icon: <HourglassIcon className="h-4 w-4 mr-2" />,
            text: "Aguardando aprovação do admin",
            color: "text-yellow-600",
            badge: "Aguardando",
            badgeClass: "bg-yellow-100 text-yellow-700",
            button: <Button disabled variant="outline"><HourglassIcon className="mr-2 h-4 w-4" />Aguardando aprovação</Button>
        },
        rejeitada: {
            icon: <XCircle className="h-4 w-4 mr-2" />,
            text: mission.submissionFeedback ? `Motivo: ${mission.submissionFeedback}` : "Comprovação rejeitada. Envie novamente.",
            color: "text-red-600",
            badge: "Rejeitada",
            badgeClass: "bg-red-100 text-red-700",
            button: (
                <ActionDialog
                    title="Reenviar Comprovação"
                    description={`Envie um novo anexo para a missão "${mission.name}".`}
                    trigger={<Button variant="destructive"><Upload className="mr-2 h-4 w-4" /> Reenviar</Button>}
                    actionText={selectedFile ? "Enviar Comprovação" : "Selecione um arquivo"}
                    onAction={handleSubmit}
                    showCancel
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                >
                    <div className="space-y-2">
                        <Label htmlFor={`file-${mission.id}`} className="sr-only">Arquivo</Label>
                        <Input id={`file-${mission.id}`} type="file" accept="image/*,video/*,.pdf" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} disabled={isSubmitting} />
                        <p className="text-xs text-muted-foreground">Envie uma imagem, vídeo ou PDF como comprovação.</p>
                        {mission.submissionFeedback && (
                            <div className="bg-red-50 border border-red-200 rounded-md p-2 mt-2">
                                <p className="text-xs text-red-700"><AlertCircle className="h-3 w-3 inline mr-1" />Feedback: {mission.submissionFeedback}</p>
                            </div>
                        )}
                    </div>
                </ActionDialog>
            )
        },
        pendente: {
            icon: null,
            text: mission.completionMode === 'auto' ? "" : "",
            color: "",
            button: mission.completionMode === 'auto' ? (
                <Button onClick={() => onAutoComplete(mission.id)} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                    Concluir
                </Button>
            ) : (
                <ActionDialog
                    title="Enviar Comprovacao"
                    description={`Envie um anexo para completar a missao "${mission.name}".`}
                    trigger={<Button><Upload className="mr-2 h-4 w-4" /> Enviar Comprovacao</Button>}
                    actionText={selectedFile ? "Enviar Comprovacao" : "Selecione um arquivo"}
                    onAction={handleSubmit}
                    showCancel
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                >
                    <div className="space-y-2">
                        <Label htmlFor={`file-${mission.id}`} className="sr-only">Arquivo</Label>
                        <Input id={`file-${mission.id}`} type="file" accept="image/*,video/*,.pdf" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} disabled={isSubmitting} />
                        <p className="text-xs text-muted-foreground">Envie uma imagem, video ou PDF como comprovacao.</p>
                    </div>
                </ActionDialog>
            )
        },
        agendada: {
            icon: <Clock className="h-4 w-4 mr-2" />,
            text: "Missão Agendada",
            color: "text-blue-600",
            badge: "Agendada",
            badgeClass: "bg-blue-100 text-blue-700",
            button: <Button disabled variant="outline">Em breve</Button>
        },
        expirada: {
            icon: <Clock className="h-4 w-4 mr-2" />,
            text: "Missão Expirada",
            color: "text-muted-foreground",
            badge: "Expirada",
            badgeClass: "bg-gray-100 text-gray-600",
            button: <Button disabled variant="outline">Expirada</Button>
        },
    };

    const cfg = statusConfig[mission.status];
    const isHistory = mission.status === 'completa' || mission.status === 'expirada';

    return (
        <Card className={isHistory ? 'opacity-80' : ''}>
            <CardHeader>
                <div className="flex justify-between items-start gap-4">
                    <CardTitle className="font-headline text-lg">{mission.name}</CardTitle>
                    <div className="flex items-center gap-2 shrink-0">
                        {cfg.badge && (
                            <Badge variant="secondary" className={cfg.badgeClass}>
                                {cfg.badge}
                            </Badge>
                        )}
                        <Badge variant="secondary" className="bg-primary/10 text-primary whitespace-nowrap">
                            <Zap className="h-3 w-3 mr-1"/> {mission.points}
                        </Badge>
                    </div>
                </div>
                <CardDescription>{mission.description}</CardDescription>
            </CardHeader>
            <CardContent>
                {mission.startDate && mission.endDate && (
                    <div className="text-xs text-muted-foreground flex items-center">
                        <CalendarDays className="h-3 w-3 mr-1.5" />
                        <span>Período: {formatDate(mission.startDate)} — {formatDate(mission.endDate)}</span>
                    </div>
                )}
            </CardContent>
            <CardFooter className="flex justify-between items-center">
                {cfg.text ? (
                    <div className={`text-sm ${cfg.color} flex items-center font-medium`}>
                        {cfg.icon}
                        <span className="line-clamp-1">{cfg.text}</span>
                    </div>
                ) : (
                    <span/>
                )}
                {cfg.button}
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
export default function ColaboradorMissoesPage() {
    const [missions, setMissions] = useState<Mission[]>([]);
    const [historyMissions, setHistoryMissions] = useState<Mission[]>([]);
    const [trailMissions, setTrailMissions] = useState<Mission[]>([]);
    const [stats, setStats] = useState({ weeklyPoints: 0, fixedProgress: 0, fixedCompleted: 0, fixedTotal: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [userInfo, setUserInfo] = useState<{ uid: string; companyId: string; name: string } | null>(null);
    const { toast } = useToast();

    const fetchMissions = useCallback(async (user: User) => {
        setIsLoading(true);
        try {
            const userDocSnap = await getDoc(doc(db, "users", user.uid));
            if (!userDocSnap.exists()) throw new Error("User not found.");

            const userData = userDocSnap.data();
            const companyId = userData.companyId;
            if (!companyId) throw new Error("CompanyId not found.");

            setUserInfo({
                uid: user.uid,
                companyId,
                name: userData.profile?.name || userData.name || 'Colaborador',
            });

            // Fetch missions
            const missionsSnap = await getDocs(collection(db, "companies", companyId, "missions"));

            // Fetch user's submissions
            const subsSnap = await getDocs(collection(db, "companies", companyId, "missionSubmissions"));
            const userSubs: Record<string, { status: string; feedback?: string }> = {};
            subsSnap.docs.forEach(d => {
                const data = d.data();
                if (data.userId === user.uid) {
                    // Keep the latest submission per mission (pending/approved wins over rejected)
                    const existing = userSubs[data.missionId];
                    if (!existing || data.status === 'pending' || data.status === 'approved') {
                        userSubs[data.missionId] = { status: data.status, feedback: data.adminFeedback };
                    }
                }
            });

            const now = new Date();
            const active: Mission[] = [];
            const history: Mission[] = [];
            const trailActive: Mission[] = [];

            missionsSnap.docs.forEach(docSnap => {
                const data = docSnap.data();

                // Filter trail missions: only show those assigned to this user
                const isTrailMission = data.type === 'trail_content' || data.type === 'trail_trigger';
                if (isTrailMission && data.assignedTo && data.assignedTo !== user.uid) {
                    return;
                }

                const sub = userSubs[docSnap.id];

                // Derive status
                let status: MissionStatus = 'pendente';
                let submissionFeedback: string | undefined;

                // Check if timed/trail mission is in valid period
                const isFixed = data.type === 'fixed';
                const start = data.startDate?.toDate ? data.startDate.toDate() : data.startDate ? new Date(data.startDate) : null;
                const end = data.endDate?.toDate ? data.endDate.toDate() : data.endDate ? new Date(data.endDate) : null;

                if (!isFixed && start && now < start) {
                    status = 'agendada';
                } else if (!isFixed && end && now > end && sub?.status !== 'approved') {
                    status = 'expirada';
                } else if (sub?.status === 'approved') {
                    status = 'completa';
                } else if (sub?.status === 'pending') {
                    status = 'aguardando';
                } else if (sub?.status === 'rejected') {
                    status = 'rejeitada';
                    submissionFeedback = sub.feedback;
                } else {
                    status = 'pendente';
                }

                const mission: Mission = {
                    id: docSnap.id,
                    name: data.name || 'Sem titulo',
                    description: data.description || '',
                    points: data.points || 0,
                    status,
                    startDate: data.startDate || null,
                    endDate: data.endDate || null,
                    type: data.type || 'fixed',
                    completionMode: data.completionMode || 'proof',
                    submissionFeedback,
                    trailId: data.trailId,
                    moduleId: data.moduleId,
                    assignedTo: data.assignedTo,
                };

                if (isTrailMission) {
                    if (status === 'completa' || status === 'expirada') {
                        history.push(mission);
                    } else {
                        trailActive.push(mission);
                    }
                    return;
                }

                if (status === 'completa' || status === 'expirada') {
                    history.push(mission);
                } else {
                    active.push(mission);
                }
            });

            // Sort: pendente/rejeitada first, then aguardando, then agendada
            const statusOrder: Record<string, number> = { pendente: 0, rejeitada: 1, aguardando: 2, agendada: 3 };
            active.sort((a, b) => (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4));

            const historyOrder: Record<string, number> = { completa: 0, expirada: 1 };
            history.sort((a, b) => (historyOrder[a.status] ?? 2) - (historyOrder[b.status] ?? 2));

            const fixedActive = active.filter(m => m.type === 'fixed');
            const completedFixed = history.filter(m => m.type === 'fixed' && m.status === 'completa').length;
            const totalFixed = fixedActive.length + completedFixed;

            setMissions(active);
            setHistoryMissions(history);
            setTrailMissions(trailActive);
            setStats({
                weeklyPoints: 0,
                fixedCompleted: completedFixed,
                fixedTotal: totalFixed,
                fixedProgress: totalFixed > 0 ? (completedFixed / totalFixed) * 100 : 0,
            });
        } catch (error) {
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

    const handleSubmitProof = async (missionId: string, file: File) => {
        if (!userInfo) return;
        setIsSubmitting(true);
        try {
            // Upload file to Storage
            const filePath = `companies/${userInfo.companyId}/missions/${missionId}/${userInfo.uid}/${file.name}`;
            const fileRef = storageRef(storage, filePath);
            await uploadBytes(fileRef, file);
            const downloadUrl = await getDownloadURL(fileRef);

            // Submit via server action
            const result = await submitMissionProof(
                userInfo.uid,
                missionId,
                userInfo.companyId,
                userInfo.name,
                downloadUrl,
                file.name
            );

            if (result.error) {
                toast({ variant: 'destructive', title: 'Erro', description: result.error });
                return;
            }

            toast({ title: 'Comprovação enviada!', description: 'Aguarde a aprovação do admin.' });
            fetchMissions(auth.currentUser!);
        } catch (error) {
            console.error("Error submitting proof:", error);
            toast({ variant: 'destructive', title: 'Erro ao enviar comprovação.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAutoComplete = async (missionId: string) => {
        if (!userInfo) return;
        setIsSubmitting(true);
        try {
            const result = await completeMissionSelf(
                userInfo.uid,
                missionId,
                userInfo.companyId,
                userInfo.name
            );
            if (result.error) {
                toast({ variant: 'destructive', title: 'Erro', description: result.error });
                return;
            }
            toast({ title: 'Missao concluida!', description: 'Pontos adicionados ao seu saldo.' });
            fetchMissions(auth.currentUser!);
        } catch (error) {
            console.error("Error auto-completing mission:", error);
            toast({ variant: 'destructive', title: 'Erro ao concluir missao.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const weeklyMissions = missions.filter(m => m.type === 'timed');
    const fixedMissions = missions.filter(m => m.type === 'fixed');

    const renderMissions = (missionList: Mission[]) => {
        if (isLoading) return <MissionsPageSkeleton />;
        if (missionList.length === 0) {
            return <p className="text-center text-muted-foreground py-8">Nenhuma missão nesta categoria.</p>;
        }
        return (
            <div className="space-y-4">
                {missionList.map(mission => (
                    <MissionCard key={mission.id} mission={mission} onSubmitProof={handleSubmitProof} onAutoComplete={handleAutoComplete} isSubmitting={isSubmitting} />
                ))}
            </div>
        );
    };

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
                            {stats.fixedProgress === 100 && stats.fixedTotal > 0 && <p className="text-xs text-muted-foreground mt-2">Você completou todas as missões fixas!</p>}
                        </div>
                    </CardContent>
                </Card>

                <Tabs defaultValue="semana">
                    <TabsList className="mb-4 grid grid-cols-2 md:flex md:w-auto w-full">
                        <TabsTrigger value="semana">Missoes da Semana</TabsTrigger>
                        <TabsTrigger value="fixas">Missoes Fixas</TabsTrigger>
                        <TabsTrigger value="trilha" className="flex items-center gap-1.5">
                            <Target className="h-3.5 w-3.5" />
                            Missoes de Trilha
                            {trailMissions.length > 0 && (
                                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                                    {trailMissions.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="historico" className="flex items-center gap-1.5">
                            <History className="h-3.5 w-3.5" />
                            Histórico
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
                    <TabsContent value="trilha">
                        {renderMissions(trailMissions)}
                    </TabsContent>
                    <TabsContent value="historico">
                        {isLoading ? (
                            <MissionsPageSkeleton />
                        ) : historyMissions.length === 0 ? (
                            <div className="text-center py-12">
                                <History className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                                <p className="text-muted-foreground font-medium">Nenhuma missão no histórico</p>
                                <p className="text-sm text-muted-foreground mt-1">Missões concluídas ou expiradas aparecerão aqui.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {historyMissions.map(mission => (
                                    <MissionCard key={mission.id} mission={mission} onSubmitProof={handleSubmitProof} onAutoComplete={handleAutoComplete} isSubmitting={isSubmitting} />
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </main>
        </>
    );
}
