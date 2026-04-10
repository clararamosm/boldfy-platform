// src/app/colaborador/missoes/page.tsx
'use client';

import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Upload, Clock, CalendarDays, Loader2, History, XCircle, AlertCircle, HourglassIcon, Target, ChevronDown, ChevronRight, Trophy, BookOpen } from "lucide-react";
import { CoinIcon } from "@/components/coin-icon";
import { Badge } from "@/components/ui/badge";
import { ActionDialog } from "@/components/dashboard/action-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import React, { useState, useEffect, useCallback } from "react";
import { db, auth, storage } from '@/lib/firebase';
import { collection, query, getDocs, doc, getDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { getAuthToken } from '@/lib/auth-client';
import { submitMissionProof, completeMissionSelf } from "@/app/actions";
import { useT } from '@/lib/i18n/context';
import { useFormat } from '@/hooks/use-format-date';
import { useAuth } from '@/contexts/auth-context';

// ─── Types ──────────────────────────────────────
type MissionStatus = 'completa' | 'pendente' | 'aguardando' | 'rejeitada' | 'agendada' | 'expirada';

type FirestoreDate = { toDate?: () => Date } | string | null;

type Mission = {
    id: string;
    name: string;
    description: string;
    points: number;
    status: MissionStatus;
    startDate?: FirestoreDate;
    endDate?: FirestoreDate;
    type: 'timed' | 'fixed' | 'trail_content' | 'trail_trigger';
    completionMode?: 'auto' | 'proof';
    submissionFeedback?: string;
    trailId?: string;
    moduleId?: string;
    assignedTo?: string;
};

const toDate = (d: FirestoreDate | undefined): Date | null => {
    if (!d) return null;
    if (typeof d === 'object' && d !== null && 'toDate' in d && typeof d.toDate === 'function') return d.toDate();
    if (typeof d === 'string') return new Date(d);
    return null;
};

// ─── Weekly Mission Card (full card with border) ──────
const WeeklyMissionCard = ({ mission, onSubmitProof, onAutoComplete, isSubmitting }: {
    mission: Mission;
    onSubmitProof: (missionId: string, file: File) => Promise<void>;
    onAutoComplete: (missionId: string) => Promise<void>;
    isSubmitting: boolean;
}) => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const t = useT();
    const { fmtDate } = useFormat();

    const formatDate = (d: FirestoreDate | undefined) => {
        const date = toDate(d);
        return date ? fmtDate(date, 'dd/MM/yyyy') : '';
    };

    const handleSubmit = async () => {
        if (!selectedFile) return;
        await onSubmitProof(mission.id, selectedFile);
        setSelectedFile(null);
        setDialogOpen(false);
    };

    const isActive = mission.status === 'pendente' || mission.status === 'rejeitada';
    const isHistory = mission.status === 'completa' || mission.status === 'expirada';

    // Border style: active = full colored border, scheduled/waiting = no special border
    const borderClass = isActive
        ? 'border-2 border-primary/60 shadow-sm'
        : mission.status === 'aguardando'
            ? 'border border-amber-300/50'
            : 'border';

    const statusConfig: Record<string, { badgeClass: string; icon: React.ReactNode; label: string }> = {
        aguardando: { badgeClass: 'bg-amber-100 text-amber-700 border-amber-200', icon: <HourglassIcon className="h-3 w-3" />, label: t.colabMissions.waiting },
        rejeitada: { badgeClass: 'bg-red-100 text-red-700 border-red-200', icon: <XCircle className="h-3 w-3" />, label: t.colabMissions.rejected },
        agendada: { badgeClass: 'bg-blue-100 text-blue-700 border-blue-200', icon: <Clock className="h-3 w-3" />, label: t.colabMissions.scheduled },
        completa: { badgeClass: 'bg-green-100 text-green-700 border-green-200', icon: <CheckCircle className="h-3 w-3" />, label: t.colabMissions.completed },
        expirada: { badgeClass: 'bg-gray-100 text-gray-500 border-gray-200', icon: <Clock className="h-3 w-3" />, label: t.colabMissions.expired },
    };

    const badge = statusConfig[mission.status];

    const renderAction = () => {
        if (isHistory || mission.status === 'agendada' || mission.status === 'aguardando') return null;

        if (mission.status === 'rejeitada') {
            return (
                <ActionDialog title={t.colabMissions.resubmitProof} description={t.colabMissions.resubmitDescription.replace('{name}', mission.name)}
                    trigger={<Button size="sm" variant="destructive" className="h-8 text-xs"><Upload className="mr-1.5 h-3.5 w-3.5" /> {t.colabMissions.resubmitProof}</Button>}
                    actionText={selectedFile ? t.colabMissions.submitProof : t.colabMissions.selectFile} onAction={handleSubmit} showCancel open={dialogOpen} onOpenChange={setDialogOpen}>
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

        if (mission.completionMode === 'auto') {
            return (
                <Button size="sm" className="h-8 text-xs" onClick={() => onAutoComplete(mission.id)} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="mr-1.5 h-3.5 w-3.5" />}
                    {t.colabMissions.conclude}
                </Button>
            );
        }

        return (
            <ActionDialog title={t.colabMissions.submitProofTitle} description={t.colabMissions.submitProofDescription.replace('{name}', mission.name)}
                trigger={<Button size="sm" className="h-8 text-xs"><Upload className="mr-1.5 h-3.5 w-3.5" /> {t.colabMissions.submitProof}</Button>}
                actionText={selectedFile ? t.colabMissions.submitProof : t.colabMissions.selectFile} onAction={handleSubmit} showCancel open={dialogOpen} onOpenChange={setDialogOpen}>
                <div className="space-y-2">
                    <Label htmlFor={`file-${mission.id}`} className="sr-only">{t.colabMissions.fileLabel}</Label>
                    <Input id={`file-${mission.id}`} type="file" accept="image/*,video/*,.pdf" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} disabled={isSubmitting} />
                    <p className="text-xs text-muted-foreground">{t.colabMissions.fileHelp}</p>
                </div>
            </ActionDialog>
        );
    };

    return (
        <Card className={`${borderClass} ${isHistory ? 'opacity-50' : ''} transition-all hover:shadow-sm`}>
            <div className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                    <h3 className="font-headline text-sm font-semibold leading-tight line-clamp-1">{mission.name}</h3>
                    <Badge variant="secondary" className="bg-primary/10 text-primary whitespace-nowrap shrink-0 text-xs h-6">
                        <CoinIcon size="sm" className="mr-1" /> {mission.points} pts
                    </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{mission.description}</p>
                <div className="flex items-center justify-between gap-2 pt-0.5">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                        {badge && (
                            <Badge variant="outline" className={`text-[11px] h-5 px-2 gap-1 ${badge.badgeClass}`}>
                                {badge.icon} {badge.label}
                            </Badge>
                        )}
                        {mission.startDate && mission.endDate && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1 shrink-0">
                                <CalendarDays className="h-3 w-3" />
                                {formatDate(mission.startDate)} — {formatDate(mission.endDate)}
                            </span>
                        )}
                    </div>
                    <div className="shrink-0">{renderAction()}</div>
                </div>
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

// ─── Compact Toggle Mission (for fixed / trail) ──────
const CompactMissionRow = ({ mission, onSubmitProof, onAutoComplete, isSubmitting }: {
    mission: Mission;
    onSubmitProof: (missionId: string, file: File) => Promise<void>;
    onAutoComplete: (missionId: string) => Promise<void>;
    isSubmitting: boolean;
}) => {
    const [expanded, setExpanded] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const t = useT();

    const handleSubmit = async () => {
        if (!selectedFile) return;
        await onSubmitProof(mission.id, selectedFile);
        setSelectedFile(null);
        setDialogOpen(false);
    };

    const isCompleted = mission.status === 'completa';
    const isWaiting = mission.status === 'aguardando';

    const renderCompactAction = () => {
        if (isCompleted) {
            return <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />;
        }
        if (isWaiting) {
            return (
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-amber-100 text-amber-700 border-amber-200">
                    <HourglassIcon className="h-2.5 w-2.5 mr-0.5" /> {t.colabMissions.waiting}
                </Badge>
            );
        }
        if (mission.completionMode === 'auto') {
            return (
                <Button size="sm" variant="outline" className="h-7 text-[11px] px-2" onClick={(e) => { e.stopPropagation(); onAutoComplete(mission.id); }} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                </Button>
            );
        }
        return (
            <ActionDialog title={t.colabMissions.submitProofTitle} description={t.colabMissions.submitProofDescription.replace('{name}', mission.name)}
                trigger={
                    <Button size="sm" variant="outline" className="h-7 text-[11px] px-2" onClick={(e) => e.stopPropagation()}>
                        <Upload className="h-3 w-3" />
                    </Button>
                }
                actionText={selectedFile ? t.colabMissions.submitProof : t.colabMissions.selectFile} onAction={handleSubmit} showCancel open={dialogOpen} onOpenChange={setDialogOpen}>
                <div className="space-y-2">
                    <Label htmlFor={`file-compact-${mission.id}`} className="sr-only">{t.colabMissions.fileLabel}</Label>
                    <Input id={`file-compact-${mission.id}`} type="file" accept="image/*,video/*,.pdf" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} disabled={isSubmitting} />
                    <p className="text-xs text-muted-foreground">{t.colabMissions.fileHelp}</p>
                </div>
            </ActionDialog>
        );
    };

    return (
        <div className={`border rounded-lg transition-all ${isCompleted ? 'opacity-50 bg-muted/30' : 'hover:bg-muted/20'}`}>
            {/* Collapsed row */}
            <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
            >
                {expanded
                    ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                }
                <span className={`text-sm font-medium flex-1 truncate ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                    {mission.name}
                </span>
                <Badge variant="secondary" className="bg-primary/10 text-primary text-[11px] h-5 px-1.5 shrink-0">
                    <CoinIcon size="xs" className="mr-0.5" /> {mission.points}
                </Badge>
                <div className="shrink-0 ml-1">{renderCompactAction()}</div>
            </button>

            {/* Expanded content */}
            {expanded && (
                <div className="px-3 pb-3 pt-0 pl-9 space-y-2">
                    <p className="text-xs text-muted-foreground leading-relaxed">{mission.description}</p>
                    {mission.status === 'rejeitada' && mission.submissionFeedback && (
                        <div className="bg-red-50 border border-red-200 rounded-md px-2.5 py-1.5">
                            <p className="text-[11px] text-red-700 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3 shrink-0" />
                                <span>{mission.submissionFeedback}</span>
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Section with toggle list ──────
const ToggleSection = ({ title, icon, missions, emptyText, onSubmitProof, onAutoComplete, isSubmitting }: {
    title: string;
    icon: React.ReactNode;
    missions: Mission[];
    emptyText: string;
    onSubmitProof: (missionId: string, file: File) => Promise<void>;
    onAutoComplete: (missionId: string) => Promise<void>;
    isSubmitting: boolean;
}) => (
    <Card>
        <div className="px-4 pt-4 pb-2">
            <h2 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                {icon} {title}
                {missions.length > 0 && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{missions.length}</Badge>
                )}
            </h2>
        </div>
        <CardContent className="px-4 pb-4 pt-1">
            {missions.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">{emptyText}</p>
            ) : (
                <div className="space-y-1.5">
                    {missions.map(m => (
                        <CompactMissionRow key={m.id} mission={m} onSubmitProof={onSubmitProof} onAutoComplete={onAutoComplete} isSubmitting={isSubmitting} />
                    ))}
                </div>
            )}
        </CardContent>
    </Card>
);

// ─── Skeleton ──────
const PageSkeleton = () => (
    <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
                <Card key={i}><div className="p-4 space-y-2.5">
                    <div className="flex justify-between gap-3"><Skeleton className="h-4 w-40" /><Skeleton className="h-6 w-16 rounded-full" /></div>
                    <Skeleton className="h-3 w-full" />
                    <div className="flex gap-2"><Skeleton className="h-5 w-20 rounded-full" /><Skeleton className="h-5 w-24 rounded-full" /></div>
                </div></Card>
            ))}
        </div>
        <div className="space-y-4">
            <Card><div className="p-4 space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div></Card>
            <Card><div className="p-4 space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-full" /></div></Card>
        </div>
    </div>
);

// ─── Main Component ──────
export default function ColaboradorMissoesPage() {
    const { user: authUser } = useAuth();
    const [missions, setMissions] = useState<Mission[]>([]);
    const [historyMissions, setHistoryMissions] = useState<Mission[]>([]);
    const [trailMissions, setTrailMissions] = useState<Mission[]>([]);
    const [stats, setStats] = useState({ totalMissionPoints: 0, fixedProgress: 0, fixedCompleted: 0, fixedTotal: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [userInfo, setUserInfo] = useState<{ uid: string; companyId: string; name: string } | null>(null);
    const { toast } = useToast();
    const t = useT();

    const fetchMissions = useCallback(async (uid: string) => {
        setIsLoading(true);
        try {
            const userDocSnap = await getDoc(doc(db, "users", uid));
            if (!userDocSnap.exists()) throw new Error("User not found.");

            const userData = userDocSnap.data();
            const companyId = userData.companyId;
            if (!companyId) throw new Error("CompanyId not found.");

            setUserInfo({ uid, companyId, name: userData.profile?.name || userData.name || 'Colaborador' });

            const missionsSnap = await getDocs(collection(db, "companies", companyId, "missions"));
            const subsSnap = await getDocs(collection(db, "companies", companyId, "missionSubmissions"));
            const userSubs: Record<string, { status: string; feedback?: string }> = {};
            subsSnap.docs.forEach(d => {
                const data = d.data();
                if (data.userId === uid) {
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
                const isTrailMission = data.type === 'trail_content' || data.type === 'trail_trigger';
                if (isTrailMission && data.assignedTo && data.assignedTo !== uid) return;

                const sub = userSubs[docSnap.id];
                let status: MissionStatus = 'pendente';
                let submissionFeedback: string | undefined;

                const isFixed = data.type === 'fixed';
                const start = data.startDate?.toDate ? data.startDate.toDate() : data.startDate ? new Date(data.startDate) : null;
                const end = data.endDate?.toDate ? data.endDate.toDate() : data.endDate ? new Date(data.endDate) : null;

                if (!isFixed && start && now < start) status = 'agendada';
                else if (!isFixed && end && now > end && sub?.status !== 'approved') status = 'expirada';
                else if (sub?.status === 'approved') status = 'completa';
                else if (sub?.status === 'pending') status = 'aguardando';
                else if (sub?.status === 'rejected') { status = 'rejeitada'; submissionFeedback = sub.feedback; }
                else status = 'pendente';

                const mission: Mission = {
                    id: docSnap.id, name: data.name || 'Sem titulo', description: data.description || '',
                    points: data.points || 0, status, startDate: data.startDate || null, endDate: data.endDate || null,
                    type: data.type || 'fixed', completionMode: data.completionMode || 'proof',
                    submissionFeedback, trailId: data.trailId, moduleId: data.moduleId, assignedTo: data.assignedTo,
                };

                if (isTrailMission) {
                    (status === 'completa' || status === 'expirada') ? history.push(mission) : trailActive.push(mission);
                    return;
                }
                (status === 'completa' || status === 'expirada') ? history.push(mission) : active.push(mission);
            });

            const statusOrder: Record<string, number> = { pendente: 0, rejeitada: 1, aguardando: 2, agendada: 3 };
            active.sort((a, b) => (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4));
            history.sort((a, b) => (a.status === 'completa' ? 0 : 1) - (b.status === 'completa' ? 0 : 1));

            const fixedActive = active.filter(m => m.type === 'fixed');
            const completedFixed = history.filter(m => m.type === 'fixed' && m.status === 'completa').length;
            const totalFixed = fixedActive.length + completedFixed;

            setMissions(active);
            setHistoryMissions(history);
            setTrailMissions(trailActive);
            const totalMissionPoints = history.filter(m => m.status === 'completa').reduce((sum, m) => sum + m.points, 0);
            setStats({ totalMissionPoints, fixedCompleted: completedFixed, fixedTotal: totalFixed, fixedProgress: totalFixed > 0 ? (completedFixed / totalFixed) * 100 : 0 });
        } catch (error) {
            console.error("Error fetching missions: ", error);
            toast({ variant: 'destructive', title: t.colabMissions.toastFetchError, description: (error as Error).message });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        if (authUser?.uid) fetchMissions(authUser.uid);
    }, [authUser?.uid, fetchMissions]);

    const handleSubmitProof = async (missionId: string, file: File) => {
        if (!userInfo) return;
        setIsSubmitting(true);
        try {
            const filePath = `companies/${userInfo.companyId}/missions/${missionId}/${userInfo.uid}/${file.name}`;
            const fileRef = storageRef(storage, filePath);
            await uploadBytes(fileRef, file);
            const downloadUrl = await getDownloadURL(fileRef);
            const token = await getAuthToken();
            const result = await submitMissionProof(token, userInfo.uid, missionId, userInfo.companyId, userInfo.name, downloadUrl, file.name);
            if (result.error) { toast({ variant: 'destructive', title: 'Erro', description: result.error }); return; }
            toast({ title: t.colabMissions.toastProofSent, description: t.colabMissions.toastProofSentDescription });
            fetchMissions(userInfo.uid);
        } catch (error) {
            console.error("Error submitting proof:", error);
            toast({ variant: 'destructive', title: t.colabMissions.toastProofError });
        } finally { setIsSubmitting(false); }
    };

    const handleAutoComplete = async (missionId: string) => {
        if (!userInfo) return;
        setIsSubmitting(true);
        try {
            const token = await getAuthToken();
            const result = await completeMissionSelf(token, userInfo.uid, missionId, userInfo.companyId, userInfo.name);
            if (result.error) { toast({ variant: 'destructive', title: 'Erro', description: result.error }); return; }
            toast({ title: t.colabMissions.toastCompleted, description: t.colabMissions.toastCompletedDescription });
            fetchMissions(userInfo.uid);
        } catch (error) {
            console.error("Error auto-completing mission:", error);
            toast({ variant: 'destructive', title: t.colabMissions.toastCompleteError });
        } finally { setIsSubmitting(false); }
    };

    // ─── Derived lists ──────
    const weeklyMissions = missions.filter(m => m.type === 'timed');
    const fixedMissions = missions.filter(m => m.type === 'fixed');
    const activeWeekly = weeklyMissions.filter(m => m.status === 'pendente' || m.status === 'rejeitada' || m.status === 'aguardando');
    const scheduledWeekly = weeklyMissions.filter(m => m.status === 'agendada');

    // Include completed fixed missions from history in the toggle list
    const completedFixed = historyMissions.filter(m => m.type === 'fixed' && m.status === 'completa');
    const allFixedForDisplay = [...fixedMissions, ...completedFixed];

    const completedTrail = historyMissions.filter(m => (m.type === 'trail_content' || m.type === 'trail_trigger') && m.status === 'completa');
    const allTrailForDisplay = [...trailMissions, ...completedTrail];

    // History = only timed history (fixed/trail completed shown inline)
    const timedHistory = historyMissions.filter(m => m.type === 'timed');

    return (
        <>
            <Header title={t.colabMissions.title} />
            <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
                {/* Stats bar */}
                <Card>
                    <CardContent className="grid gap-4 md:grid-cols-2 p-4">
                        <div className="p-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                                <CoinIcon size="lg" /> {t.colabMissions.weeklyPoints}
                            </div>
                            <div className="text-3xl font-bold">{stats.totalMissionPoints.toLocaleString()}</div>
                        </div>
                        <div className="p-2">
                            <div className="flex items-center justify-between gap-2 text-sm font-medium text-muted-foreground mb-2">
                                <span>{t.colabMissions.fixedProgress}</span>
                                <span>{stats.fixedCompleted} / {stats.fixedTotal}</span>
                            </div>
                            <Progress value={stats.fixedProgress} className="h-2" />
                            {stats.fixedProgress === 100 && stats.fixedTotal > 0 && (
                                <p className="text-xs text-muted-foreground mt-2">{t.colabMissions.allFixedCompleted}</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {isLoading ? (
                    <PageSkeleton />
                ) : (
                    <>
                        {/* 2-column layout — equal weight */}
                        <div className="grid gap-6 lg:grid-cols-2">
                            {/* LEFT COLUMN — Weekly missions */}
                            <div className="space-y-4">
                                <h2 className="text-base font-semibold flex items-center gap-2">
                                    <CalendarDays className="h-4 w-4 text-primary" />
                                    {t.colabMissions.tabWeekly}
                                    {activeWeekly.length > 0 && (
                                        <Badge className="h-5 px-1.5 text-[10px]">{activeWeekly.length}</Badge>
                                    )}
                                </h2>

                                {/* Active weekly (full border) */}
                                {activeWeekly.length > 0 && (
                                    <div className="space-y-3">
                                        {activeWeekly.map(m => (
                                            <WeeklyMissionCard key={m.id} mission={m} onSubmitProof={handleSubmitProof} onAutoComplete={handleAutoComplete} isSubmitting={isSubmitting} />
                                        ))}
                                    </div>
                                )}

                                {/* Scheduled weekly (no colored border) */}
                                {scheduledWeekly.length > 0 && (
                                    <div className="space-y-3">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-2">{t.colabMissions.scheduled}</p>
                                        {scheduledWeekly.map(m => (
                                            <WeeklyMissionCard key={m.id} mission={m} onSubmitProof={handleSubmitProof} onAutoComplete={handleAutoComplete} isSubmitting={isSubmitting} />
                                        ))}
                                    </div>
                                )}

                                {weeklyMissions.length === 0 && (
                                    <Card className="border-dashed">
                                        <div className="p-8 text-center">
                                            <CalendarDays className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                                            <p className="text-sm text-muted-foreground">{t.colabMissions.noMissions}</p>
                                        </div>
                                    </Card>
                                )}
                            </div>

                            {/* RIGHT COLUMN — Fixed + Trail (toggle lists) */}
                            <div className="space-y-4">
                                <ToggleSection
                                    title={t.colabMissions.tabFixed}
                                    icon={<Trophy className="h-4 w-4" />}
                                    missions={allFixedForDisplay}
                                    emptyText={t.colabMissions.noMissions}
                                    onSubmitProof={handleSubmitProof}
                                    onAutoComplete={handleAutoComplete}
                                    isSubmitting={isSubmitting}
                                />

                                <ToggleSection
                                    title={t.colabMissions.tabTrail}
                                    icon={<BookOpen className="h-4 w-4" />}
                                    missions={allTrailForDisplay}
                                    emptyText={t.colabMissions.noMissions}
                                    onSubmitProof={handleSubmitProof}
                                    onAutoComplete={handleAutoComplete}
                                    isSubmitting={isSubmitting}
                                />
                            </div>
                        </div>

                        {/* History (collapsed by default) */}
                        {timedHistory.length > 0 && (
                            <div>
                                <button
                                    type="button"
                                    onClick={() => setShowHistory(!showHistory)}
                                    className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-3"
                                >
                                    {showHistory ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    <History className="h-4 w-4" />
                                    {t.colabMissions.tabHistory}
                                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{timedHistory.length}</Badge>
                                </button>
                                {showHistory && (
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        {timedHistory.map(m => (
                                            <WeeklyMissionCard key={m.id} mission={m} onSubmitProof={handleSubmitProof} onAutoComplete={handleAutoComplete} isSubmitting={isSubmitting} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </main>
        </>
    );
}
