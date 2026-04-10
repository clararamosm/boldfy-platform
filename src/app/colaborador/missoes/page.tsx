// src/app/colaborador/missoes/page.tsx
'use client';

import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { getAuthToken } from '@/lib/auth-client';
import { submitMissionProof, completeMissionSelf } from "@/app/actions";
import { useT } from '@/lib/i18n/context';
import { useFormat } from '@/hooks/use-format-date';

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

const toDate = (d: any): Date | null => {
    if (!d) return null;
    return d.toDate ? d.toDate() : new Date(d);
};

// ---- Status visual config ----
const STATUS_STYLES: Record<MissionStatus, { border: string; badgeClass: string; badgeIcon: React.ReactNode; badgeText?: string }> = {
    pendente: { border: 'border-l-primary', badgeClass: '', badgeIcon: null },
    aguardando: { border: 'border-l-amber-400', badgeClass: 'bg-amber-100 text-amber-700 border-amber-200', badgeIcon: <HourglassIcon className="h-3 w-3" /> },
    rejeitada: { border: 'border-l-red-400', badgeClass: 'bg-red-100 text-red-700 border-red-200', badgeIcon: <XCircle className="h-3 w-3" /> },
    agendada: { border: 'border-l-blue-400', badgeClass: 'bg-blue-100 text-blue-700 border-blue-200', badgeIcon: <Clock className="h-3 w-3" /> },
    completa: { border: 'border-l-green-400', badgeClass: 'bg-green-100 text-green-700 border-green-200', badgeIcon: <CheckCircle className="h-3 w-3" /> },
    expirada: { border: 'border-l-gray-300', badgeClass: 'bg-gray-100 text-gray-500 border-gray-200', badgeIcon: <Clock className="h-3 w-3" /> },
};

// ---- Sub-components ----
const MissionCard = ({ mission, onSubmitProof, onAutoComplete, isSubmitting }: { mission: Mission, onSubmitProof: (missionId: string, file: File) => Promise<void>, onAutoComplete: (missionId: string) => Promise<void>, isSubmitting: boolean }) => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const t = useT();
    const { fmtDate } = useFormat();
    const formatDate = (d: any) => {
        const date = toDate(d);
        return date ? fmtDate(date, 'dd/MM/yyyy') : '';
    };

    const handleSubmit = async () => {
        if (!selectedFile) return;
        await onSubmitProof(mission.id, selectedFile);
        setSelectedFile(null);
        setDialogOpen(false);
    };

    const style = STATUS_STYLES[mission.status];
    const isHistory = mission.status === 'completa' || mission.status === 'expirada';

    const statusBadgeText: Record<MissionStatus, string> = {
        pendente: '',
        aguardando: t.colabMissions.waiting,
        rejeitada: t.colabMissions.rejected,
        agendada: t.colabMissions.scheduled,
        completa: t.colabMissions.completed,
        expirada: t.colabMissions.expired,
    };

    // Action button (compact)
    const renderAction = () => {
        if (isHistory) return null;

        if (mission.status === 'agendada') return null;

        if (mission.status === 'aguardando') return null;

        if (mission.status === 'rejeitada') {
            return (
                <ActionDialog
                    title={t.colabMissions.resubmitProof}
                    description={t.colabMissions.resubmitDescription.replace('{name}', mission.name)}
                    trigger={
                        <Button size="sm" variant="destructive" className="h-8 text-xs">
                            <Upload className="mr-1.5 h-3.5 w-3.5" /> {t.colabMissions.resubmitProof}
                        </Button>
                    }
                    actionText={selectedFile ? t.colabMissions.submitProof : t.colabMissions.selectFile}
                    onAction={handleSubmit}
                    showCancel
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                >
                    <div className="space-y-2">
                        <Label htmlFor={`file-${mission.id}`} className="sr-only">{t.colabMissions.fileLabel}</Label>
                        <Input id={`file-${mission.id}`} type="file" accept="image/*,video/*,.pdf" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} disabled={isSubmitting} />
                        <p className="text-xs text-muted-foreground">{t.colabMissions.fileHelp}</p>
                        {mission.submissionFeedback && (
                            <div className="bg-red-50 border border-red-200 rounded-md p-2 mt-2">
                                <p className="text-xs text-red-700"><AlertCircle className="h-3 w-3 inline mr-1" />{t.colabMissions.feedbackLabel.replace('{feedback}', mission.submissionFeedback)}</p>
                            </div>
                        )}
                    </div>
                </ActionDialog>
            );
        }

        // pendente
        if (mission.completionMode === 'auto') {
            return (
                <Button size="sm" className="h-8 text-xs" onClick={() => onAutoComplete(mission.id)} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="mr-1.5 h-3.5 w-3.5" />}
                    {t.colabMissions.conclude}
                </Button>
            );
        }

        return (
            <ActionDialog
                title={t.colabMissions.submitProofTitle}
                description={t.colabMissions.submitProofDescription.replace('{name}', mission.name)}
                trigger={
                    <Button size="sm" className="h-8 text-xs">
                        <Upload className="mr-1.5 h-3.5 w-3.5" /> {t.colabMissions.submitProof}
                    </Button>
                }
                actionText={selectedFile ? t.colabMissions.submitProof : t.colabMissions.selectFile}
                onAction={handleSubmit}
                showCancel
                open={dialogOpen}
                onOpenChange={setDialogOpen}
            >
                <div className="space-y-2">
                    <Label htmlFor={`file-${mission.id}`} className="sr-only">{t.colabMissions.fileLabel}</Label>
                    <Input id={`file-${mission.id}`} type="file" accept="image/*,video/*,.pdf" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} disabled={isSubmitting} />
                    <p className="text-xs text-muted-foreground">{t.colabMissions.fileHelp}</p>
                </div>
            </ActionDialog>
        );
    };

    return (
        <Card className={`border-l-4 ${style.border} ${isHistory ? 'opacity-60' : ''} transition-all hover:shadow-sm`}>
            <div className="p-4 space-y-2.5">
                {/* Row 1: Title + Points */}
                <div className="flex items-start justify-between gap-3">
                    <h3 className="font-headline text-sm font-semibold leading-tight line-clamp-1">{mission.name}</h3>
                    <Badge variant="secondary" className="bg-primary/10 text-primary whitespace-nowrap shrink-0 text-xs h-6">
                        <Zap className="h-3 w-3 mr-1" /> {mission.points} pts
                    </Badge>
                </div>

                {/* Row 2: Description (compact) */}
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{mission.description}</p>

                {/* Row 3: Tags + Date + Action */}
                <div className="flex items-center justify-between gap-2 pt-0.5">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                        {/* Status badge */}
                        {statusBadgeText[mission.status] && (
                            <Badge variant="outline" className={`text-[11px] h-5 px-2 gap-1 ${style.badgeClass}`}>
                                {style.badgeIcon}
                                {statusBadgeText[mission.status]}
                            </Badge>
                        )}

                        {/* Type tag */}
                        {(mission.type === 'trail_content' || mission.type === 'trail_trigger') && (
                            <Badge variant="outline" className="text-[11px] h-5 px-2 gap-1 bg-purple-50 text-purple-700 border-purple-200">
                                <Target className="h-3 w-3" />
                                Trilha
                            </Badge>
                        )}

                        {/* Date */}
                        {mission.startDate && mission.endDate && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1 shrink-0">
                                <CalendarDays className="h-3 w-3" />
                                {formatDate(mission.startDate)} — {formatDate(mission.endDate)}
                            </span>
                        )}
                    </div>

                    {/* Action button */}
                    <div className="shrink-0">
                        {renderAction()}
                    </div>
                </div>

                {/* Rejection feedback (if applicable) */}
                {mission.status === 'rejeitada' && mission.submissionFeedback && (
                    <div className="bg-red-50 border border-red-200 rounded-md px-3 py-1.5 mt-1">
                        <p className="text-[11px] text-red-700 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            <span className="line-clamp-1">{mission.submissionFeedback}</span>
                        </p>
                    </div>
                )}
            </div>
        </Card>
    );
};

const MissionsPageSkeleton = () => (
    <div className="grid gap-3 sm:grid-cols-2">
        {[...Array(4)].map((_, i) => (
            <Card key={i} className="border-l-4 border-l-muted">
                <div className="p-4 space-y-2.5">
                    <div className="flex justify-between items-start gap-3">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-6 w-16 rounded-full" />
                    </div>
                    <Skeleton className="h-3 w-full" />
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-5 w-20 rounded-full" />
                        <Skeleton className="h-5 w-24 rounded-full" />
                    </div>
                </div>
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
    const t = useT();

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
            toast({ variant: 'destructive', title: t.colabMissions.toastFetchError, description: (error as Error).message });
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
            const token = await getAuthToken();
            const result = await submitMissionProof(
                token,
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

            toast({ title: t.colabMissions.toastProofSent, description: t.colabMissions.toastProofSentDescription });
            fetchMissions(auth.currentUser!);
        } catch (error) {
            console.error("Error submitting proof:", error);
            toast({ variant: 'destructive', title: t.colabMissions.toastProofError });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAutoComplete = async (missionId: string) => {
        if (!userInfo) return;
        setIsSubmitting(true);
        try {
            const token = await getAuthToken();
            const result = await completeMissionSelf(
                token,
                userInfo.uid,
                missionId,
                userInfo.companyId,
                userInfo.name
            );
            if (result.error) {
                toast({ variant: 'destructive', title: 'Erro', description: result.error });
                return;
            }
            toast({ title: t.colabMissions.toastCompleted, description: t.colabMissions.toastCompletedDescription });
            fetchMissions(auth.currentUser!);
        } catch (error) {
            console.error("Error auto-completing mission:", error);
            toast({ variant: 'destructive', title: t.colabMissions.toastCompleteError });
        } finally {
            setIsSubmitting(false);
        }
    };

    const weeklyMissions = missions.filter(m => m.type === 'timed');
    const fixedMissions = missions.filter(m => m.type === 'fixed');

    const renderMissions = (missionList: Mission[]) => {
        if (isLoading) return <MissionsPageSkeleton />;
        if (missionList.length === 0) {
            return <p className="text-center text-muted-foreground py-8">{t.colabMissions.noMissions}</p>;
        }
        return (
            <div className="grid gap-3 sm:grid-cols-2">
                {missionList.map(mission => (
                    <MissionCard key={mission.id} mission={mission} onSubmitProof={handleSubmitProof} onAutoComplete={handleAutoComplete} isSubmitting={isSubmitting} />
                ))}
            </div>
        );
    };

    return (
        <>
            <Header title={t.colabMissions.title} />
            <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
                <Card>
                    <CardContent className="grid gap-4 md:grid-cols-2 p-4">
                        <div className="p-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                                <Zap className="h-4 w-4"/> {t.colabMissions.weeklyPoints}
                            </div>
                            <div className="text-3xl font-bold">{stats.weeklyPoints}</div>
                        </div>
                        <div className="p-2">
                            <div className="flex items-center justify-between gap-2 text-sm font-medium text-muted-foreground mb-2">
                                <span>{t.colabMissions.fixedProgress}</span>
                                <span>{stats.fixedCompleted} / {stats.fixedTotal}</span>
                            </div>
                            <Progress value={stats.fixedProgress} className="h-2" />
                            {stats.fixedProgress === 100 && stats.fixedTotal > 0 && <p className="text-xs text-muted-foreground mt-2">{t.colabMissions.allFixedCompleted}</p>}
                        </div>
                    </CardContent>
                </Card>

                <Tabs defaultValue="semana">
                    <TabsList className="mb-4 grid grid-cols-2 md:flex md:w-auto w-full">
                        <TabsTrigger value="semana">{t.colabMissions.tabWeekly}</TabsTrigger>
                        <TabsTrigger value="fixas">{t.colabMissions.tabFixed}</TabsTrigger>
                        <TabsTrigger value="trilha" className="flex items-center gap-1.5">
                            <Target className="h-3.5 w-3.5" />
                            {t.colabMissions.tabTrail}
                            {trailMissions.length > 0 && (
                                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                                    {trailMissions.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="historico" className="flex items-center gap-1.5">
                            <History className="h-3.5 w-3.5" />
                            {t.colabMissions.tabHistory}
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
                                <p className="text-muted-foreground font-medium">{t.colabMissions.noHistory}</p>
                                <p className="text-sm text-muted-foreground mt-1">{t.colabMissions.noHistoryDescription}</p>
                            </div>
                        ) : (
                            <div className="grid gap-3 sm:grid-cols-2">
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
