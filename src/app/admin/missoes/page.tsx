'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MoreHorizontal, PlusCircle, Calendar as CalendarIcon, ChevronDown, Loader2, Sparkles, CheckCircle2, Clock, History, FileCheck, Trash2, XCircle, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ActionDialog } from "@/components/dashboard/action-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from '@/hooks/use-toast';
import { reviewMissionProof } from "@/app/actions";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Mission = {
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
}

type Submission = {
  id: string;
  missionId: string;
  missionName: string;
  userId: string;
  userName: string;
  proofUrl: string;
  proofFileName: string;
  status: string;
  submittedAt: any;
}

type DerivedStatus = 'ativa' | 'agendada' | 'encerrada';

type AISuggestion = {
  name: string;
  description: string;
  points: number;
  selected: boolean;
  type: 'fixed' | 'timed';
  completionMode: 'auto' | 'proof';
  startDate?: Date;
  endDate?: Date;
};

const deriveMissionStatus = (mission: Mission, now: Date): DerivedStatus => {
  if (mission.type === 'fixed') return 'ativa';
  if (!mission.startDate || !mission.endDate) return 'ativa';
  const start = mission.startDate?.toDate ? mission.startDate.toDate() : new Date(mission.startDate);
  const end = mission.endDate?.toDate ? mission.endDate.toDate() : new Date(mission.endDate);
  if (now < start) return 'agendada';
  if (now > end) return 'encerrada';
  return 'ativa';
};

const getStatusBadge = (status: DerivedStatus) => {
  switch (status) {
    case 'ativa':
      return <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />Ativa</Badge>;
    case 'agendada':
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200"><Clock className="h-3 w-3 mr-1" />Agendada</Badge>;
    case 'encerrada':
      return <Badge variant="outline" className="text-muted-foreground"><History className="h-3 w-3 mr-1" />Encerrada</Badge>;
  }
};

const MissionForm = ({ mission, isSubmitting, formRef, isFixed = false }: { mission?: Mission, isSubmitting: boolean, formRef: React.RefObject<HTMLFormElement | null>, isFixed?: boolean }) => {
  const [startDate, setStartDate] = useState<Date | undefined>(
    mission?.startDate?.toDate ? mission.startDate.toDate() : mission?.startDate ? new Date(mission.startDate) : undefined
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    mission?.endDate?.toDate ? mission.endDate.toDate() : mission?.endDate ? new Date(mission.endDate) : undefined
  );
  const [completionMode, setCompletionMode] = useState<string>(mission?.completionMode || 'proof');

  return (
    <form id="mission-form" ref={formRef} className="space-y-4">
      <input type="hidden" name="startDate" value={startDate?.toISOString() || ''} />
      <input type="hidden" name="endDate" value={endDate?.toISOString() || ''} />
      <input type="hidden" name="completionMode" value={completionMode} />
      <div className="space-y-2">
        <Label htmlFor="mission-name">Nome da Missao</Label>
        <Input id="mission-name" name="name" placeholder={isFixed ? "Ex: Atualize seu banner do LinkedIn" : "Ex: Compartilhar post no LinkedIn"} disabled={isSubmitting} defaultValue={mission?.name} required/>
      </div>
      <div className="space-y-2">
        <Label htmlFor="mission-description">Descricao</Label>
        <Textarea id="mission-description" name="description" placeholder="Descreva o que o colaborador precisa fazer." disabled={isSubmitting} defaultValue={mission?.description} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="mission-points">Pontos</Label>
        <Input id="mission-points" name="points" type="number" placeholder="Ex: 100" disabled={isSubmitting} defaultValue={mission?.points} required/>
      </div>
      <div className="space-y-2">
        <Label>Modo de Conclusao</Label>
        <Select value={completionMode} onValueChange={setCompletionMode}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o modo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="proof">Com comprovacao (admin aprova)</SelectItem>
            <SelectItem value="auto">Auto-conclusao (sem comprovacao)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {completionMode === 'auto' ? 'O colaborador conclui com um clique. Pontos sao dados automaticamente.' : 'O colaborador envia um arquivo e o admin precisa aprovar.'}
        </p>
      </div>
      {!isFixed && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Data de Inicio</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal" disabled={isSubmitting}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : <span className="text-muted-foreground">Selecione</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} locale={ptBR} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label>Data de Termino</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal" disabled={isSubmitting}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : <span className="text-muted-foreground">Selecione</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={endDate} onSelect={setEndDate} locale={ptBR} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}
    </form>
  );
};

const TableSkeleton = ({ cols }: { cols: number }) => (
  <TableRow>
    <TableCell colSpan={cols} className="h-24 text-center">
      <div className="flex justify-center items-center">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Carregando missões...
      </div>
    </TableCell>
  </TableRow>
);

const MissionTable = ({
  missions,
  isLoading,
  status,
  companyId,
  isSubmitting,
  formRef,
  onEdit,
  onDelete,
  onOpenReview,
  cols,
}: {
  missions: Mission[];
  isLoading: boolean;
  status: DerivedStatus;
  companyId: string | null;
  isSubmitting: boolean;
  formRef: React.RefObject<HTMLFormElement | null>;
  onEdit: (missionId: string, isFixed: boolean) => void;
  onDelete: (missionId: string) => void;
  onOpenReview: () => void;
  cols: number;
}) => {
  const showPeriod = status !== 'ativa' || missions.some(m => m.type === 'timed');

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Modo</TableHead>
          {showPeriod && <TableHead>Periodo</TableHead>}
          <TableHead>Pontos</TableHead>
          <TableHead>Status</TableHead>
          {status === 'ativa' && <TableHead>Envios</TableHead>}
          <TableHead><span className="sr-only">Acoes</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? <TableSkeleton cols={cols} /> : missions.length === 0 ? (
          <TableRow>
            <TableCell colSpan={cols} className="text-center py-8 text-muted-foreground">
              {status === 'ativa' ? 'Nenhuma missao ativa no momento.' :
               status === 'agendada' ? 'Nenhuma missao agendada.' :
               'Nenhuma missao no historico.'}
            </TableCell>
          </TableRow>
        ) : missions.map((mission) => {
          const derivedStatus = deriveMissionStatus(mission, new Date());
          const formatDate = (d: any) => {
            if (!d) return '';
            const date = d.toDate ? d.toDate() : new Date(d);
            return format(date, "dd/MM/yyyy", { locale: ptBR });
          };

          return (
            <TableRow key={mission.id} className={status === 'encerrada' ? 'text-muted-foreground' : ''}>
              <TableCell className="font-medium">{mission.name}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {mission.type === 'fixed' ? 'Fixa' : 'Temporaria'}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={`text-xs ${mission.completionMode === 'auto' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                  {mission.completionMode === 'auto' ? 'Auto' : 'Comprovacao'}
                </Badge>
              </TableCell>
              {showPeriod && (
                <TableCell className="text-sm">
                  {mission.type === 'fixed' ? (
                    <span className="text-muted-foreground">Sempre ativa</span>
                  ) : (
                    `${formatDate(mission.startDate)} — ${formatDate(mission.endDate)}`
                  )}
                </TableCell>
              )}
              <TableCell>{mission.points}</TableCell>
              <TableCell>{getStatusBadge(derivedStatus)}</TableCell>
              {status === 'ativa' && (
                <TableCell>
                  {(mission.pendingSubmissions || 0) > 0 ? (
                    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 cursor-pointer hover:bg-yellow-200 transition-colors" onClick={onOpenReview}>
                      <FileCheck className="h-3 w-3 mr-1" />
                      {mission.pendingSubmissions} pendente{(mission.pendingSubmissions || 0) > 1 ? 's' : ''}
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
              )}
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {status !== 'encerrada' && (
                      <ActionDialog
                        title="Editar Missao"
                        description="Atualize os detalhes desta missao."
                        trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Editar</DropdownMenuItem>}
                        actionText="Salvar Alteracoes"
                        onAction={() => onEdit(mission.id, mission.type === 'fixed')}
                        formId="mission-form"
                      >
                        <MissionForm isSubmitting={isSubmitting} formRef={formRef} mission={mission} isFixed={mission.type === 'fixed'} />
                      </ActionDialog>
                    )}
                    <DropdownMenuItem className="text-destructive" onClick={() => onDelete(mission.id)}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

export default function AdminMissoesPage() {
  const [allMissions, setAllMissions] = useState<Mission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createFixedDialogOpen, setCreateFixedDialogOpen] = useState(false);

  // AI suggestions state
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);

  // Review sheet state
  const [reviewSheetOpen, setReviewSheetOpen] = useState(false);
  const [pendingSubmissions, setPendingSubmissions] = useState<Submission[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, string>>({});

  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement | null>(null);

  const fetchMissions = useCallback(async (currentCompanyId: string) => {
    setIsLoading(true);
    try {
      const missionsSnapshot = await getDocs(collection(db, "companies", currentCompanyId, "missions"));
      const missions = missionsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Mission);

      // Fetch pending submission counts and full data for review
      const submissionsSnapshot = await getDocs(collection(db, "companies", currentCompanyId, "missionSubmissions"));
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

      const enriched = missions.map(m => ({
        ...m,
        pendingSubmissions: pendingCounts[m.id] || 0,
      }));

      setAllMissions(enriched);
      setPendingSubmissions(pendingSubs);
    } catch(error) {
      console.error("Error fetching missions:", error);
      toast({ variant: 'destructive', title: 'Erro ao buscar missões.' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        const userDocSnap = await getDoc(doc(db, "users", user.uid));
        if (userDocSnap.exists()) {
          const userCompanyId = userDocSnap.data().companyId;
          setCompanyId(userCompanyId);
          fetchMissions(userCompanyId);
        } else {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    });
  }, [fetchMissions]);

  const now = new Date();
  const activeMissions = allMissions.filter(m => deriveMissionStatus(m, now) === 'ativa');
  const scheduledMissions = allMissions.filter(m => deriveMissionStatus(m, now) === 'agendada');
  const pastMissions = allMissions.filter(m => deriveMissionStatus(m, now) === 'encerrada');

  const totalPending = allMissions.reduce((sum, m) => sum + (m.pendingSubmissions || 0), 0);

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
        await updateDoc(doc(db, "companies", companyId, "missions", missionId), missionData);
        toast({ title: "Missão atualizada com sucesso!" });
      } else {
        missionData.createdAt = serverTimestamp();
        await addDoc(collection(db, "companies", companyId, "missions"), missionData);
        toast({ title: "Missão criada com sucesso!" });
      }
      setCreateDialogOpen(false);
      setCreateFixedDialogOpen(false);
      fetchMissions(companyId);
    } catch(error) {
      console.error("Error saving mission: ", error);
      toast({ variant: "destructive", title: "Erro ao salvar missão." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (missionId: string) => {
    if (!companyId) return;
    try {
      await deleteDoc(doc(db, "companies", companyId, "missions", missionId));
      toast({ title: "Missão excluída." });
      fetchMissions(companyId);
    } catch (error) {
      console.error("Error deleting mission:", error);
      toast({ variant: "destructive", title: "Erro ao excluir missão." });
    }
  };

  // ---- AI Suggestions ----
  const handleGenerateAI = async () => {
    if (!companyId) return;
    setAiLoading(true);
    setAiSuggestions([]);
    try {
      const companyDoc = await getDoc(doc(db, "companies", companyId));
      const brandContext = companyDoc.exists() ? companyDoc.data().brandContext || {} : {};
      const companyName = companyDoc.exists() ? companyDoc.data().companyName || '' : '';

      const res = await fetch('/api/ai/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandContext, companyName }),
      });

      if (!res.ok) throw new Error('Erro na geração de missões.');

      const data = await res.json();
      const suggestions: AISuggestion[] = (data.missions || []).map((m: any) => ({
        ...m,
        selected: false,
        type: 'timed' as const,
        completionMode: 'proof' as const,
        startDate: undefined,
        endDate: undefined,
      }));
      setAiSuggestions(suggestions);
    } catch (error) {
      console.error("Error generating AI missions:", error);
      toast({ variant: 'destructive', title: 'Erro ao gerar sugestões de missões.' });
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
      toast({ variant: 'destructive', title: 'Selecione ao menos uma missão.' });
      return;
    }

    const timedWithoutDates = selected.some(s => s.type === 'timed' && (!s.startDate || !s.endDate));
    if (timedWithoutDates) {
      toast({ variant: 'destructive', title: 'Defina as datas de inicio e termino das missoes temporarias selecionadas.' });
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
        await addDoc(collection(db, "companies", companyId, "missions"), missionDoc);
      }
      toast({ title: `${selected.length} missão(ões) criada(s) com sucesso!` });
      setAiDialogOpen(false);
      setAiSuggestions([]);
      fetchMissions(companyId);
    } catch (error) {
      console.error("Error saving AI missions:", error);
      toast({ variant: 'destructive', title: 'Erro ao salvar missões.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---- Review Submissions ----
  const handleReview = async (submissionId: string, action: 'approve' | 'reject') => {
    if (!companyId) return;
    setIsReviewing(true);
    try {
      const result = await reviewMissionProof(
        submissionId,
        companyId,
        action,
        action === 'reject' ? feedbackMap[submissionId] : undefined
      );
      if (result.error) {
        toast({ variant: 'destructive', title: 'Erro', description: result.error });
        return;
      }
      toast({ title: action === 'approve' ? 'Comprovacao aprovada!' : 'Comprovacao rejeitada.' });
      setFeedbackMap(prev => { const next = {...prev}; delete next[submissionId]; return next; });
      fetchMissions(companyId);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro ao avaliar comprovacao.' });
    } finally {
      setIsReviewing(false);
    }
  };

  return (
    <>
      <Header title="Missoes" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        {/* Actions bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {totalPending > 0 && (
              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 cursor-pointer hover:bg-yellow-200 transition-colors" onClick={() => setReviewSheetOpen(true)}>
                <FileCheck className="h-3 w-3 mr-1" />
                {totalPending} comprovacao(oes) pendente(s)
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { setAiDialogOpen(true); handleGenerateAI(); }} disabled={isSubmitting || !companyId}>
              <Sparkles className="mr-2 h-4 w-4" />
              Gerar com IA
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" disabled={isSubmitting || !companyId}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Criar Missão
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <ActionDialog
                  title="Criar Missão com Período"
                  description="Configure uma missão com data de início e fim."
                  trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Missão com Período</DropdownMenuItem>}
                  actionText={isSubmitting ? "Salvando..." : "Criar Missão"}
                  onAction={() => handleAction(undefined, false)}
                  formId="mission-form"
                  open={createDialogOpen}
                  onOpenChange={setCreateDialogOpen}
                >
                  <MissionForm isSubmitting={isSubmitting} formRef={formRef} />
                </ActionDialog>
                <ActionDialog
                  title="Criar Missão Fixa"
                  description="Missão sempre ativa, sem data de término."
                  trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Missão Fixa</DropdownMenuItem>}
                  actionText={isSubmitting ? "Salvando..." : "Criar Missão"}
                  onAction={() => handleAction(undefined, true)}
                  formId="mission-form"
                  open={createFixedDialogOpen}
                  onOpenChange={setCreateFixedDialogOpen}
                >
                  <MissionForm isSubmitting={isSubmitting} formRef={formRef} isFixed />
                </ActionDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="ativas">
          <TabsList>
            <TabsTrigger value="ativas" className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Ativas
              {activeMissions.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{activeMissions.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="agendadas" className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Agendadas
              {scheduledMissions.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{scheduledMissions.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" />
              Histórico
              {pastMissions.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{pastMissions.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ativas">
            <Card>
              <CardHeader>
                <CardTitle>Missões Ativas</CardTitle>
                <CardDescription>Missões disponíveis para os colaboradores agora.</CardDescription>
              </CardHeader>
              <CardContent>
                <MissionTable
                  missions={activeMissions}
                  isLoading={isLoading}
                  status="ativa"
                  companyId={companyId}
                  isSubmitting={isSubmitting}
                  formRef={formRef}
                  onEdit={handleAction}
                  onDelete={handleDelete}
                  onOpenReview={() => setReviewSheetOpen(true)}
                  cols={8}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agendadas">
            <Card>
              <CardHeader>
                <CardTitle>Missões Agendadas</CardTitle>
                <CardDescription>Missões que serão ativadas automaticamente na data de início.</CardDescription>
              </CardHeader>
              <CardContent>
                <MissionTable
                  missions={scheduledMissions}
                  isLoading={isLoading}
                  status="agendada"
                  companyId={companyId}
                  isSubmitting={isSubmitting}
                  formRef={formRef}
                  onEdit={handleAction}
                  onDelete={handleDelete}
                  onOpenReview={() => setReviewSheetOpen(true)}
                  cols={7}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historico">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Missões</CardTitle>
                <CardDescription>Missões encerradas e seus resultados.</CardDescription>
              </CardHeader>
              <CardContent>
                <MissionTable
                  missions={pastMissions}
                  isLoading={isLoading}
                  status="encerrada"
                  companyId={companyId}
                  isSubmitting={isSubmitting}
                  formRef={formRef}
                  onEdit={handleAction}
                  onDelete={handleDelete}
                  onOpenReview={() => setReviewSheetOpen(true)}
                  cols={7}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* AI Suggestions Dialog */}
        <ActionDialog
          title="Gerar Missoes com IA"
          description="A IA analisa o contexto da sua empresa e sugere missoes. Selecione, configure o tipo e modo, e defina datas se necessario."
          trigger={<span />}
          open={aiDialogOpen}
          onOpenChange={(open) => { setAiDialogOpen(open); if (!open) setAiSuggestions([]); }}
          actionText={isSubmitting ? "Salvando..." : `Criar ${aiSuggestions.filter(s => s.selected).length} missao(oes)`}
          onAction={handleSaveAISuggestions}
          showCancel
        >
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {aiLoading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Analisando o contexto da empresa e gerando sugestoes...</p>
              </div>
            ) : aiSuggestions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhuma sugestao gerada. Tente novamente.</p>
            ) : (
              aiSuggestions.map((suggestion, index) => (
                <Card
                  key={index}
                  className={`cursor-pointer transition-colors ${suggestion.selected ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/30'}`}
                  onClick={() => toggleSuggestion(index)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${suggestion.selected ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                          {suggestion.selected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        <CardTitle className="text-base">{suggestion.name}</CardTitle>
                      </div>
                      <Badge variant="secondary" className="bg-primary/10 text-primary shrink-0">{suggestion.points} pts</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <p className="text-sm text-muted-foreground">{suggestion.description}</p>
                    {suggestion.selected && (
                      <div className="space-y-3 mt-3" onClick={(e) => e.stopPropagation()}>
                        {/* Type + Mode toggles */}
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Label className="text-xs whitespace-nowrap">Temporaria</Label>
                            <Switch checked={suggestion.type === 'timed'} onCheckedChange={(v) => updateSuggestionField(index, 'type', v ? 'timed' : 'fixed')} />
                          </div>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs whitespace-nowrap">Comprovacao</Label>
                            <Switch checked={suggestion.completionMode === 'proof'} onCheckedChange={(v) => updateSuggestionField(index, 'completionMode', v ? 'proof' : 'auto')} />
                          </div>
                        </div>
                        {/* Dates - only for timed */}
                        {suggestion.type === 'timed' && (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Inicio</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal h-8 text-xs">
                                    <CalendarIcon className="mr-1.5 h-3 w-3" />
                                    {suggestion.startDate ? format(suggestion.startDate, "dd/MM/yyyy", { locale: ptBR }) : 'Selecione'}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                  <Calendar mode="single" selected={suggestion.startDate} onSelect={(d) => updateSuggestionDate(index, 'startDate', d)} locale={ptBR} initialFocus />
                                </PopoverContent>
                              </Popover>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Termino</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal h-8 text-xs">
                                    <CalendarIcon className="mr-1.5 h-3 w-3" />
                                    {suggestion.endDate ? format(suggestion.endDate, "dd/MM/yyyy", { locale: ptBR }) : 'Selecione'}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                  <Calendar mode="single" selected={suggestion.endDate} onSelect={(d) => updateSuggestionDate(index, 'endDate', d)} locale={ptBR} initialFocus />
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ActionDialog>

        {/* Review Submissions Sheet */}
        <Sheet open={reviewSheetOpen} onOpenChange={setReviewSheetOpen}>
          <SheetContent side="right" className="sm:max-w-lg w-full overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Comprovacoes Pendentes</SheetTitle>
              <SheetDescription>
                Revise as comprovacoes enviadas pelos colaboradores.
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 mt-6">
              {pendingSubmissions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma comprovacao pendente.
                </p>
              ) : (
                pendingSubmissions.map((sub) => (
                  <Card key={sub.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">
                        {sub.missionName}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Enviado por: {sub.userName}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Proof preview */}
                      {sub.proofUrl && (
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Comprovacao:</Label>
                          {sub.proofFileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                            <img
                              src={sub.proofUrl}
                              alt="Comprovacao"
                              className="rounded-md border max-h-48 w-full object-contain"
                            />
                          ) : (
                            <a
                              href={sub.proofUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary underline flex items-center gap-1"
                            >
                              <Eye className="h-3 w-3" />
                              {sub.proofFileName || 'Ver arquivo'}
                            </a>
                          )}
                        </div>
                      )}
                      {/* Feedback input */}
                      <div className="space-y-1">
                        <Label className="text-xs">Feedback (opcional, para rejeicao):</Label>
                        <Textarea
                          placeholder="Motivo da rejeicao..."
                          className="h-16 text-xs"
                          value={feedbackMap[sub.id] || ''}
                          onChange={(e) =>
                            setFeedbackMap((prev) => ({ ...prev, [sub.id]: e.target.value }))
                          }
                          disabled={isReviewing}
                        />
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-end gap-2 pt-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => handleReview(sub.id, 'reject')}
                        disabled={isReviewing}
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Rejeitar
                      </Button>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => handleReview(sub.id, 'approve')}
                        disabled={isReviewing}
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Aprovar
                      </Button>
                    </CardFooter>
                  </Card>
                ))
              )}
            </div>
          </SheetContent>
        </Sheet>
      </main>
    </>
  );
}
