// src/components/admin/missions/use-admin-missions.ts
// Custom hook for admin missions page — handles all state, CRUD, AI suggestions, and review logic.
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { getAuthToken } from '@/lib/auth-client';
import { reviewMissionProof } from '@/app/actions';
import { useT } from '@/lib/i18n/context';
import { useFormat } from '@/hooks/use-format-date';
import { useAuth } from '@/contexts/auth-context';
import { useCompanyData } from '@/hooks/use-company-data';

// ─── Types ────────────────────────────────────
export type Mission = {
  id: string;
  name: string;
  description: string;
  points: number;
  type: 'fixed' | 'timed';
  completionMode?: 'auto' | 'proof';
  startDate?: any;
  endDate?: any;
  createdAt?: any;
  pendingSubmissions?: number;
};

export type Submission = {
  id: string;
  missionId: string;
  missionName: string;
  userId: string;
  userName: string;
  proofUrl: string;
  proofFileName: string;
  status: string;
  submittedAt: any;
};

export type DerivedStatus = 'ativa' | 'agendada' | 'encerrada';

export type AISuggestion = {
  name: string;
  description: string;
  points: number;
  selected: boolean;
  type: 'fixed' | 'timed';
  completionMode: 'auto' | 'proof';
  startDate?: Date;
  endDate?: Date;
};

// ─── Helpers ──────────────────────────────────
export const deriveMissionStatus = (mission: Mission, now: Date): DerivedStatus => {
  if (mission.type === 'fixed') return 'ativa';
  if (!mission.startDate || !mission.endDate) return 'ativa';
  const start = mission.startDate?.toDate ? mission.startDate.toDate() : new Date(mission.startDate);
  const end = mission.endDate?.toDate ? mission.endDate.toDate() : new Date(mission.endDate);
  if (now < start) return 'agendada';
  if (now > end) return 'encerrada';
  return 'ativa';
};

// ─── Hook ─────────────────────────────────────
export function useAdminMissions() {
  const { user } = useAuth();
  const companyId = user?.companyId || null;
  const { company } = useCompanyData(companyId);

  const [allMissions, setAllMissions] = useState<Mission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createFixedDialogOpen, setCreateFixedDialogOpen] = useState(false);

  // AI
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);

  // Review
  const [reviewSheetOpen, setReviewSheetOpen] = useState(false);
  const [pendingSubmissions, setPendingSubmissions] = useState<Submission[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, string>>({});

  const { toast } = useToast();
  const t = useT();
  const { locale } = useFormat();
  const formRef = useRef<HTMLFormElement>(null);

  // ─── Fetch ──────────────────────────────────
  const fetchMissions = useCallback(async (currentCompanyId: string) => {
    setIsLoading(true);
    try {
      const missionsSnapshot = await getDocs(collection(db, 'companies', currentCompanyId, 'missions'));
      const missions = missionsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Mission);

      const submissionsSnapshot = await getDocs(collection(db, 'companies', currentCompanyId, 'missionSubmissions'));
      const pendingCounts: Record<string, number> = {};
      const pendingSubs: Submission[] = [];
      const missionMap = Object.fromEntries(missions.map(m => [m.id, m.name]));

      submissionsSnapshot.docs.forEach(d => {
        const data = d.data();
        if (data.status === 'pending') {
          pendingCounts[data.missionId] = (pendingCounts[data.missionId] || 0) + 1;
          pendingSubs.push({
            id: d.id,
            missionId: data.missionId,
            missionName: missionMap[data.missionId] || 'Missao desconhecida',
            userId: data.userId,
            userName: data.userName,
            proofUrl: data.proofUrl,
            proofFileName: data.proofFileName,
            status: data.status,
            submittedAt: data.submittedAt,
          });
        }
      });

      setAllMissions(missions.map(m => ({ ...m, pendingSubmissions: pendingCounts[m.id] || 0 })));
      setPendingSubmissions(pendingSubs);
    } catch (error) {
      console.error('Error fetching missions:', error);
      toast({ variant: 'destructive', title: t.adminMissions.toastFetchError });
    } finally {
      setIsLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    if (!companyId) {
      setIsLoading(false);
      return;
    }
    fetchMissions(companyId);
  }, [companyId, fetchMissions]);

  // ─── Derived lists ──────────────────────────
  const now = new Date();
  const activeMissions = allMissions.filter(m => deriveMissionStatus(m, now) === 'ativa');
  const scheduledMissions = allMissions.filter(m => deriveMissionStatus(m, now) === 'agendada');
  const pastMissions = allMissions.filter(m => deriveMissionStatus(m, now) === 'encerrada');
  const totalPending = allMissions.reduce((sum, m) => sum + (m.pendingSubmissions || 0), 0);

  // ─── CRUD ───────────────────────────────────
  const handleAction = async (missionId?: string, isFixed = false) => {
    if (!formRef.current || !companyId) return;
    setIsSubmitting(true);
    const formData = new FormData(formRef.current);

    const missionData: any = {
      name: formData.get('name'),
      description: formData.get('description'),
      points: Number(formData.get('points')),
      type: isFixed ? 'fixed' : 'timed',
      completionMode: formData.get('completionMode') || 'proof',
    };

    if (!isFixed) {
      const startStr = formData.get('startDate') as string;
      const endStr = formData.get('endDate') as string;
      if (!startStr || !endStr) {
        toast({ variant: 'destructive', title: 'Selecione as datas de início e término.' });
        setIsSubmitting(false);
        return;
      }
      missionData.startDate = new Date(startStr);
      missionData.endDate = new Date(endStr);
    }

    try {
      if (missionId) {
        await updateDoc(doc(db, 'companies', companyId, 'missions', missionId), missionData);
        toast({ title: t.adminMissions.toastUpdated });
      } else {
        missionData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'companies', companyId, 'missions'), missionData);
        toast({ title: t.adminMissions.toastCreated });
      }
      setCreateDialogOpen(false);
      setCreateFixedDialogOpen(false);
      fetchMissions(companyId);
    } catch (error) {
      console.error('Error saving mission:', error);
      toast({ variant: 'destructive', title: t.adminMissions.toastSaveError });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (missionId: string) => {
    if (!companyId) return;
    try {
      await deleteDoc(doc(db, 'companies', companyId, 'missions', missionId));
      toast({ title: t.common.success });
      fetchMissions(companyId);
    } catch (error) {
      console.error('Error deleting mission:', error);
      toast({ variant: 'destructive', title: t.common.error });
    }
  };

  // ─── AI Suggestions ─────────────────────────
  const handleGenerateAI = async () => {
    if (!companyId) return;
    setAiLoading(true);
    setAiSuggestions([]);
    try {
      const brandContext = company?.brandContext || {};
      const companyName = company?.companyName || '';

      const token = await getAuthToken();
      const res = await fetch('/api/ai/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ brandContext, companyName, locale }),
      });

      if (!res.ok) throw new Error('Erro na geração de missões.');

      const data = await res.json();
      setAiSuggestions((data.missions || []).map((m: any) => ({
        ...m,
        selected: false,
        type: 'timed' as const,
        completionMode: 'proof' as const,
        startDate: undefined,
        endDate: undefined,
      })));
    } catch (error) {
      console.error('Error generating AI missions:', error);
      toast({ variant: 'destructive', title: t.adminMissions.toastGenerateError });
    } finally {
      setAiLoading(false);
    }
  };

  const toggleSuggestion = (index: number) => {
    setAiSuggestions(prev => prev.map((s, i) => i === index ? { ...s, selected: !s.selected } : s));
  };

  const updateSuggestionDate = (index: number, field: 'startDate' | 'endDate', date: Date | undefined) => {
    setAiSuggestions(prev => prev.map((s, i) => i === index ? { ...s, [field]: date } : s));
  };

  const updateSuggestionField = (index: number, field: string, value: any) => {
    setAiSuggestions(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const handleSaveAISuggestions = async () => {
    if (!companyId) return;
    const selected = aiSuggestions.filter(s => s.selected);
    if (selected.length === 0) {
      toast({ variant: 'destructive', title: t.adminMissions.selectAtLeastOne });
      return;
    }
    if (selected.some(s => s.type === 'timed' && (!s.startDate || !s.endDate))) {
      toast({ variant: 'destructive', title: t.adminMissions.setDates });
      return;
    }

    setIsSubmitting(true);
    try {
      for (const s of selected) {
        const missionDoc: any = {
          name: s.name,
          description: s.description,
          points: s.points,
          type: s.type,
          completionMode: s.completionMode,
          createdAt: serverTimestamp(),
        };
        if (s.type === 'timed') {
          missionDoc.startDate = s.startDate;
          missionDoc.endDate = s.endDate;
        }
        await addDoc(collection(db, 'companies', companyId, 'missions'), missionDoc);
      }
      toast({ title: `${selected.length} missão(ões) criada(s) com sucesso!` });
      setAiDialogOpen(false);
      setAiSuggestions([]);
      fetchMissions(companyId);
    } catch (error) {
      console.error('Error saving AI missions:', error);
      toast({ variant: 'destructive', title: 'Erro ao salvar missões.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Review ─────────────────────────────────
  const handleReview = async (submissionId: string, action: 'approve' | 'reject') => {
    if (!companyId) return;
    setIsReviewing(true);
    try {
      const token = await getAuthToken();
      const result = await reviewMissionProof(
        token, submissionId, companyId, action,
        action === 'reject' ? feedbackMap[submissionId] : undefined
      );
      if (result.error) {
        toast({ variant: 'destructive', title: 'Erro', description: result.error });
        return;
      }
      toast({ title: action === 'approve' ? 'Comprovacao aprovada!' : 'Comprovacao rejeitada.' });
      setFeedbackMap(prev => { const next = { ...prev }; delete next[submissionId]; return next; });
      fetchMissions(companyId);
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao avaliar comprovacao.' });
    } finally {
      setIsReviewing(false);
    }
  };

  return {
    // Data
    allMissions, activeMissions, scheduledMissions, pastMissions,
    isLoading, isSubmitting, companyId, totalPending,

    // Dialogs
    createDialogOpen, setCreateDialogOpen,
    createFixedDialogOpen, setCreateFixedDialogOpen,

    // AI
    aiDialogOpen, setAiDialogOpen, aiLoading, aiSuggestions,
    handleGenerateAI, toggleSuggestion, updateSuggestionDate, updateSuggestionField, handleSaveAISuggestions,

    // Review
    reviewSheetOpen, setReviewSheetOpen,
    pendingSubmissions, isReviewing, feedbackMap, setFeedbackMap,
    handleReview,

    // CRUD
    formRef, handleAction, handleDelete,
  };
}
