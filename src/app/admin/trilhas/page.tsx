'use client';

import { useState, useEffect, useCallback } from 'react';
import { db, auth } from '@/lib/firebase';
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, orderBy, Timestamp, getDoc, setDoc, writeBatch
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Plus, Pencil, Trash2, ChevronRight, ChevronDown, Globe, Building2,
  Play, BookOpen, HelpCircle, Wrench, Target, BarChart3,
  ArrowLeft, Loader2, Eye, Save, FolderOpen, GripVertical, ToggleLeft, Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SimpleRichEditor } from '@/components/ui/simple-rich-editor';
import type { Sessao, Trilha, Modulo, ModuloModo, QuestaoDesafio, TrilhaAnalytics } from '@/types/trilhas';
import { MODO_LABELS, MODO_CONFIG } from '@/types/trilhas';
import { Header } from '@/components/dashboard/header';

const MODO_ICONS: Record<ModuloModo, any> = {
  aula: Play, leitura: BookOpen, desafio: HelpCircle,
  faca_voce_mesmo: Wrench, missao_conteudo: Target,
};

export default function AdminTrilhasPage() {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('global');

  // Global trails data
  const [globalSessions, setGlobalSessions] = useState<Sessao[]>([]);
  const [globalTrailsBySession, setGlobalTrailsBySession] = useState<Record<string, Trilha[]>>({});
  const [activatedTrailIds, setActivatedTrailIds] = useState<Set<string>>(new Set());
  const [togglingTrail, setTogglingTrail] = useState<string | null>(null);

  // Company custom trails
  const [companySessions, setCompanySessions] = useState<Sessao[]>([]);
  const [companyTrailsBySession, setCompanyTrailsBySession] = useState<Record<string, Trilha[]>>({});
  const [selectedSession, setSelectedSession] = useState<Sessao | null>(null);

  // Session editing (company)
  const [editSessionDialogOpen, setEditSessionDialogOpen] = useState(false);
  const [editingCompanySession, setEditingCompanySession] = useState<Sessao | null>(null);
  const [editSessionForm, setEditSessionForm] = useState({ titulo: '', descricao: '' });
  const [togglingSession, setTogglingSession] = useState<string | null>(null);

  // Builder state (simplified)
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingTrail, setEditingTrail] = useState<Trilha | null>(null);
  const [trailForm, setTrailForm] = useState({ titulo: '', descricao: '', tempoEstimadoMin: 30, pontuacaoBonusTrilha: 0 });
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [moduloDialogOpen, setModuloDialogOpen] = useState(false);
  const [editingModuloIdx, setEditingModuloIdx] = useState<number | null>(null);
  const [moduloForm, setModuloForm] = useState<Partial<Modulo>>({ titulo: '', modo: 'aula' });
  const [questoes, setQuestoes] = useState<QuestaoDesafio[]>([]);
  const [saving, setSaving] = useState(false);

  // Session dialog
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [sessionForm, setSessionForm] = useState({ titulo: '', descricao: '' });

  // Analytics
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analyticsTrail, setAnalyticsTrail] = useState<TrilhaAnalytics | null>(null);

  // ============================================================
  // Get company ID from user doc
  // ============================================================
  useEffect(() => {
    if (!user) return;
    const fetchCompany = async () => {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        setCompanyId(userDoc.data().companyId || null);
      }
    };
    fetchCompany();
  }, [user]);

  // ============================================================
  // Load global sessions + trails + activated status
  // ============================================================
  const loadGlobalData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      // 1. Load global sessions
      const sessSnap = await getDocs(query(collection(db, 'globalSessions'), orderBy('ordem', 'asc')));
      const sessions = sessSnap.docs.map(d => ({ id: d.id, ...d.data() } as Sessao)).filter(s => s.ativa);
      setGlobalSessions(sessions);

      // 2. Load trails for each session
      const trailsMap: Record<string, Trilha[]> = {};
      for (const sess of sessions) {
        const trailSnap = await getDocs(
          query(collection(db, `globalSessions/${sess.id}/trails`), orderBy('ordem', 'asc'))
        );
        trailsMap[sess.id] = trailSnap.docs.map(d => ({ id: d.id, ...d.data() } as Trilha)).filter(t => t.ativa);
      }
      setGlobalTrailsBySession(trailsMap);

      // 3. Load which trails are activated for this company
      const actSnap = await getDocs(collection(db, `companies/${companyId}/activatedGlobalTrails`));
      const actIds = new Set(actSnap.docs.map(d => d.id));
      setActivatedTrailIds(actIds);
    } catch (err) {
      console.error('Erro ao carregar trilhas globais:', err);
      toast({ variant: 'destructive', title: 'Erro ao carregar trilhas', description: err instanceof Error ? err.message : 'Erro desconhecido' });
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // ============================================================
  // Load company custom sessions + trails
  // ============================================================
  const loadCompanyData = useCallback(async () => {
    if (!companyId) return;
    try {
      const sessSnap = await getDocs(
        query(collection(db, `companies/${companyId}/sessions`), orderBy('ordem', 'asc'))
      );
      const sessions = sessSnap.docs.map(d => ({ id: d.id, ...d.data() } as Sessao));
      setCompanySessions(sessions);

      // Load trails for each session
      const trailsBySession: Record<string, Trilha[]> = {};
      for (const sess of sessions) {
        const trailsSnap = await getDocs(
          query(collection(db, `companies/${companyId}/sessions/${sess.id}/trails`), orderBy('ordem', 'asc'))
        );
        trailsBySession[sess.id] = trailsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Trilha));
      }
      setCompanyTrailsBySession(trailsBySession);
    } catch (err) {
      console.error('Erro ao carregar sessoes da empresa:', err);
      toast({ variant: 'destructive', title: 'Erro ao carregar sessoes', description: err instanceof Error ? err.message : 'Erro desconhecido' });
    }
  }, [companyId]);

  useEffect(() => {
    if (companyId) {
      loadGlobalData();
      loadCompanyData();
    }
  }, [companyId, loadGlobalData, loadCompanyData]);

  // ============================================================
  // Toggle global trail activation for this company
  // ============================================================
  const toggleGlobalTrail = async (trail: Trilha, sessionId: string) => {
    if (!companyId || !user) return;
    setTogglingTrail(trail.id);
    try {
      const docRef = doc(db, `companies/${companyId}/activatedGlobalTrails`, trail.id);
      if (activatedTrailIds.has(trail.id)) {
        // Deactivate
        await deleteDoc(docRef);
        setActivatedTrailIds(prev => { const next = new Set(prev); next.delete(trail.id); return next; });
      } else {
        // Activate - store reference to global trail
        await setDoc(docRef, {
          trailId: trail.id,
          sessionId: sessionId,
          titulo: trail.titulo,
          ativadaEm: Timestamp.now(),
          ativadaPor: user.uid,
        });
        setActivatedTrailIds(prev => { const next = new Set(prev); next.add(trail.id); return next; });
      }
      toast({ title: 'Trilha alterada com sucesso!' });
    } catch (err) {
      console.error('Erro ao alterar trilha:', err);
      toast({ variant: 'destructive', title: 'Erro ao alterar trilha', description: err instanceof Error ? err.message : 'Erro desconhecido' });
    } finally {
      setTogglingTrail(null);
    }
  };

  // ============================================================
  // Company Session CRUD
  // ============================================================
  const saveCompanySession = async () => {
    if (!companyId || !sessionForm.titulo.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, `companies/${companyId}/sessions`), {
        titulo: sessionForm.titulo,
        descricao: sessionForm.descricao,
        ordem: companySessions.length + 1,
        ativa: true,
        criadaEm: Timestamp.now(),
      });
      toast({ title: 'Sessao criada com sucesso!' });
      setSessionDialogOpen(false);
      setSessionForm({ titulo: '', descricao: '' });
      loadCompanyData();
    } catch (err) {
      console.error('Erro ao criar sessao:', err);
      toast({ variant: 'destructive', title: 'Erro ao criar sessao', description: err instanceof Error ? err.message : 'Erro desconhecido' });
    } finally {
      setSaving(false);
    }
  };

  const updateCompanySession = async () => {
    if (!companyId || !editingCompanySession || !editSessionForm.titulo.trim()) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, `companies/${companyId}/sessions`, editingCompanySession.id), {
        titulo: editSessionForm.titulo,
        descricao: editSessionForm.descricao,
        atualizadaEm: Timestamp.now(),
      });
      toast({ title: 'Sessao atualizada com sucesso!' });
      setEditSessionDialogOpen(false);
      loadCompanyData();
    } catch (err) {
      console.error('Erro ao atualizar sessao:', err);
      toast({ variant: 'destructive', title: 'Erro ao atualizar sessao', description: err instanceof Error ? err.message : 'Erro desconhecido' });
    } finally {
      setSaving(false);
    }
  };

  const toggleCompanySessionActive = async (session: Sessao) => {
    if (!companyId) return;
    setTogglingSession(session.id);
    try {
      await updateDoc(doc(db, `companies/${companyId}/sessions`, session.id), {
        ativa: !session.ativa,
        atualizadaEm: Timestamp.now(),
      });
      toast({ title: `Sessao ${session.ativa ? 'desativada' : 'ativada'} com sucesso!` });
      loadCompanyData();
    } catch (err) {
      console.error('Erro ao alterar sessao:', err);
      toast({ variant: 'destructive', title: 'Erro ao alterar sessao', description: err instanceof Error ? err.message : 'Erro desconhecido' });
    } finally {
      setTogglingSession(null);
    }
  };

  const toggleCompanyTrailActive = async (trail: Trilha, sessionId: string) => {
    if (!companyId) return;
    try {
      await updateDoc(doc(db, `companies/${companyId}/sessions/${sessionId}/trails`, trail.id), {
        ativa: !trail.ativa,
        atualizadaEm: Timestamp.now(),
      });
      toast({ title: `Trilha ${trail.ativa ? 'desativada' : 'ativada'} com sucesso!` });
      loadCompanyData();
    } catch (err) {
      console.error('Erro ao alterar trilha:', err);
      toast({ variant: 'destructive', title: 'Erro ao alterar trilha', description: err instanceof Error ? err.message : 'Erro desconhecido' });
    }
  };

  // ============================================================
  // Company Trail Builder
  // ============================================================
  const openBuilder = (session: Sessao, trail?: Trilha) => {
    setSelectedSession(session);
    if (trail) {
      setEditingTrail(trail);
      setTrailForm({ titulo: trail.titulo, descricao: trail.descricao, tempoEstimadoMin: trail.tempoEstimadoMin || 30, pontuacaoBonusTrilha: trail.pontuacaoBonusTrilha || 0 });
      setModulos(trail.modulos || []);
    } else {
      setEditingTrail(null);
      setTrailForm({ titulo: '', descricao: '', tempoEstimadoMin: 30, pontuacaoBonusTrilha: 0 });
      setModulos([]);
    }
    setBuilderOpen(true);
  };

  const saveCompanyTrail = async () => {
    if (!companyId || !selectedSession) return;
      if (!trailForm.titulo.trim()) {
        toast({ variant: 'destructive', title: 'Titulo obrigatorio', description: 'Preencha o titulo da trilha para salvar.' });
        return;
      }
    setSaving(true);
    try {
      let total = 0, bonus = 0;
      modulos.forEach(m => {
        const cfg = MODO_CONFIG[m.modo];
        if (cfg && cfg.temPontuacao) {
          total += (m.pontuacaoBase || cfg.pontosPadrao);
          bonus += (m.pontuacaoBonus || cfg.pontosBonus);
        }
      });

      const trailData = {
        sessionId: selectedSession.id,
        titulo: trailForm.titulo,
        descricao: trailForm.descricao,
        ordem: 0,
        ativa: true,
        pontuacaoTotal: total,
        pontuacaoBonus: bonus,
        pontuacaoBonusTrilha: trailForm.pontuacaoBonusTrilha || 0,
        tempoEstimadoMin: trailForm.tempoEstimadoMin,
        modulos: modulos.map((m, i) => Object.fromEntries(Object.entries({ ...m, ordem: i }).filter(([_, v]) => v !== undefined))),
        atualizadaEm: Timestamp.now(),
      };

      const path = `companies/${companyId}/sessions/${selectedSession.id}/trails`;
      if (editingTrail) {
        await updateDoc(doc(db, path, editingTrail.id), trailData);
      } else {
        await addDoc(collection(db, path), { ...trailData, criadaEm: Timestamp.now() });
      }
      setBuilderOpen(false);
      loadCompanyData();
      toast({ title: 'Trilha salva com sucesso!' });
    } catch (err) {
      console.error('Erro ao salvar trilha:', err);
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: err instanceof Error ? err.message : 'Erro desconhecido' });
    } finally {
      setSaving(false);
    }
  };

  // Modulo helpers
  const moveModulo = (index: number, direction: 'up' | 'down') => {
    const newModulos = [...modulos];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newModulos.length) return;
    [newModulos[index], newModulos[targetIndex]] = [newModulos[targetIndex], newModulos[index]];
    setModulos(newModulos);
  };

  const openModuloDialog = (idx?: number) => {
    if (idx !== undefined && modulos[idx]) {
      setEditingModuloIdx(idx);
      const m = modulos[idx];
      setModuloForm({ titulo: m.titulo, modo: m.modo, videoUrl: m.videoUrl, conteudoHtml: m.conteudoHtml, instrucaoCard: m.instrucaoCard, pontuacaoBase: m.pontuacaoBase, pontuacaoBonus: m.pontuacaoBonus });
      setQuestoes(m.questoes || []);
    } else {
      setEditingModuloIdx(null);
      setModuloForm({ titulo: '', modo: 'aula' });
      setQuestoes([]);
    }
    setModuloDialogOpen(true);
  };

  const saveModulo = () => {
    if (!moduloForm.titulo?.trim()) return;
    const modo = moduloForm.modo as ModuloModo;
    const m: Modulo = {
      id: editingModuloIdx !== null ? modulos[editingModuloIdx].id : `mod_${Date.now()}`,
      titulo: moduloForm.titulo || '', modo, ordem: editingModuloIdx ?? modulos.length,
      videoUrl: modo === 'aula' ? moduloForm.videoUrl : undefined,
      conteudoHtml: modo === 'leitura' ? moduloForm.conteudoHtml : undefined,
      questoes: modo === 'desafio' ? questoes : undefined,
      pontuacaoBase: MODO_CONFIG[modo].temPontuacao ? (moduloForm.pontuacaoBase || MODO_CONFIG[modo].pontosPadrao) : undefined,
      pontuacaoBonus: MODO_CONFIG[modo].temPontuacao ? (moduloForm.pontuacaoBonus || MODO_CONFIG[modo].pontosBonus) : undefined,
      instrucaoCard: (modo === 'faca_voce_mesmo' || modo === 'missao_conteudo') ? moduloForm.instrucaoCard : undefined,
      missaoGatilho: modo === 'missao_conteudo' ? { tipo: 'postar_linkedin', instrucoes: moduloForm.instrucaoCard || '' } : undefined,
    };
    if (editingModuloIdx !== null) { const u = [...modulos]; u[editingModuloIdx] = m; setModulos(u); }
    else { setModulos([...modulos, m]); }
    setModuloDialogOpen(false);
  };

  const addQuestao = () => setQuestoes([...questoes, { pergunta: '', opcoes: ['','','',''], respostaCorreta: 0 }]);
  const updateQuestao = (qi: number, field: string, val: any) => { const u = [...questoes]; if (field === 'pergunta') u[qi].pergunta = val; else u[qi].respostaCorreta = val; setQuestoes(u); };
  const updateOpcao = (qi: number, oi: number, val: string) => { const u = [...questoes]; u[qi].opcoes[oi] = val; setQuestoes(u); };

  // ============================================================
  // MAIN RETURN
  // ============================================================
  if (builderOpen) {
    let total = 0, bonus = 0;
    modulos.forEach(m => {
      const cfg = MODO_CONFIG[m.modo];
      if (cfg && cfg.temPontuacao) {
        total += (m.pontuacaoBase || cfg.pontosPadrao);
        bonus += (m.pontuacaoBonus || cfg.pontosBonus);
      }
    });
    return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setBuilderOpen(false)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
          <div className="flex-1">
            <h2 className="text-2xl font-bold">{editingTrail ? 'Editar Trilha' : 'Nova Trilha'}</h2>
            <p className="text-muted-foreground">Sessao: {selectedSession?.titulo}</p>
          </div>
          <Button onClick={saveCompanyTrail} disabled={saving} className="bg-purple-600 hover:bg-purple-700">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Informacoes da Trilha</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Titulo</Label>
              <Input value={trailForm.titulo} onChange={e => setTrailForm({...trailForm, titulo: e.target.value})} placeholder="Nome da trilha" />
            </div>
            <div>
              <Label>Descricao</Label>
              <Textarea value={trailForm.descricao} onChange={e => setTrailForm({...trailForm, descricao: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tempo Estimado (min)</Label>
                <Input type="number" value={trailForm.tempoEstimadoMin} onChange={e => setTrailForm({...trailForm, tempoEstimadoMin: parseInt(e.target.value)||0})} />
              </div>
              <div>
                <Label className="flex items-center gap-1"><Zap className="w-4 h-4 text-yellow-500" />Pontuacao por Completar</Label>
                <Input type="number" value={trailForm.pontuacaoBonusTrilha || 0} onChange={e => setTrailForm({...trailForm, pontuacaoBonusTrilha: parseInt(e.target.value) || 0})} placeholder="Ex: 200" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Score Summary */}
        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="pt-6 text-center">
            <div className="flex items-center justify-center gap-1 mb-1"><Zap className="w-5 h-5 text-yellow-500" /><p className="text-2xl font-bold text-purple-600">{total}</p></div>
            <p className="text-sm text-muted-foreground">Pontuacao Total</p>
          </CardContent></Card>
          <Card><CardContent className="pt-6 text-center">
            <div className="flex items-center justify-center gap-1 mb-1"><Zap className="w-5 h-5 text-yellow-500" /><p className="text-2xl font-bold text-yellow-600">+{bonus}</p></div>
            <p className="text-sm text-muted-foreground">Bonus Possivel</p>
          </CardContent></Card>
          <Card><CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold mb-1">{modulos.length}</p>
            <p className="text-sm text-muted-foreground">Modulos</p>
          </CardContent></Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Modulos</CardTitle>
              <CardDescription>Use as setas para reordenar. Clique no lapis para editar.</CardDescription>
            </div>
            <Button size="sm" onClick={() => openModuloDialog()} className="bg-purple-600 hover:bg-purple-700">
              <Plus className="w-4 h-4 mr-2" /> Adicionar Modulo
            </Button>
          </CardHeader>
          <CardContent>
            {modulos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhum modulo adicionado</p>
                <p className="text-sm">Clique em &quot;Adicionar Modulo&quot; para comecar</p>
              </div>
            ) : (
              <div className="space-y-2">
                {modulos.map((m, i) => {
                  const Icon = MODO_ICONS[m.modo];
                  return (
                    <div key={m.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                      <div className="flex flex-col gap-1">
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveModulo(i, 'up')} disabled={i === 0}>
                          <ChevronDown className="w-3 h-3 rotate-180" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveModulo(i, 'down')} disabled={i === modulos.length - 1}>
                          <ChevronDown className="w-3 h-3" />
                        </Button>
                      </div>
                      <GripVertical className="w-4 h-4 text-gray-400" />
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                        <Icon className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{m.titulo}</p>
                        <p className="text-xs text-muted-foreground">{MODO_LABELS[m.modo]}</p>
                      </div>
                      {MODO_CONFIG[m.modo].temPontuacao && <Badge variant="secondary"><Zap className="w-3 h-3 mr-1 text-yellow-500" />{m.pontuacaoBase || 0} pontos</Badge>}
                      <Button variant="ghost" size="icon" onClick={() => openModuloDialog(i)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setModulos(modulos.filter((_,idx) => idx !== i))}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* MODULO DIALOG (builder) */}
        <Dialog open={moduloDialogOpen} onOpenChange={setModuloDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingModuloIdx !== null ? 'Editar Modulo' : 'Novo Modulo'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Titulo</Label><Input value={moduloForm.titulo} onChange={e => setModuloForm({...moduloForm, titulo: e.target.value})} /></div>
              <div><Label>Modo</Label>
                <Select value={moduloForm.modo} onValueChange={(v: ModuloModo) => setModuloForm({...moduloForm, modo: v, pontuacaoBase: MODO_CONFIG[v].pontosPadrao, pontuacaoBonus: MODO_CONFIG[v].pontosBonus})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(MODO_LABELS) as ModuloModo[]).map(m => (<SelectItem key={m} value={m}>{MODO_LABELS[m]}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              {moduloForm.modo === 'aula' && (<div><Label>URL do Video</Label><Input value={moduloForm.videoUrl} onChange={e => setModuloForm({...moduloForm, videoUrl: e.target.value})} />
              <div className="mt-2">
                <Label>Material de Apoio (PDF)</Label>
                <Input placeholder="Cole o link do PDF aqui" value={moduloForm.materialPdfUrl || ''} onChange={e => setModuloForm({...moduloForm, materialPdfUrl: e.target.value})} />
              </div>
            </div>)}
              {moduloForm.modo === 'leitura' && (<div><Label>Conteudo</Label><SimpleRichEditor value={moduloForm.conteudoHtml || ''} onChange={(html) => setModuloForm({...moduloForm, conteudoHtml: html})} placeholder="Escreva o conteudo da leitura aqui..." /></div>)}
              {moduloForm.modo === 'desafio' && (
                <div className="space-y-3">
                  <div className="flex justify-between"><Label>Questoes ({questoes.length})</Label><Button size="sm" variant="outline" onClick={addQuestao}><Plus className="w-3 h-3 mr-1" /> Add</Button></div>
                  {questoes.map((q, qi) => (
                    <Card key={qi} className="p-3 space-y-2">
                      <Input value={q.pergunta} onChange={e => updateQuestao(qi, 'pergunta', e.target.value)} placeholder="Pergunta..." />
                      {q.opcoes.map((o, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <input type="radio" name={`q${qi}`} checked={q.respostaCorreta === oi} onChange={() => updateQuestao(qi, 'respostaCorreta', oi)} />
                          <Input value={o} onChange={e => updateOpcao(qi, oi, e.target.value)} placeholder={`Opcao ${oi+1}`} className="flex-1" />
                        </div>
                      ))}
                    </Card>
                  ))}
                </div>
              )}
              {(moduloForm.modo === 'faca_voce_mesmo' || moduloForm.modo === 'missao_conteudo') && (
                <div><Label>Instrucoes</Label><Textarea value={moduloForm.instrucaoCard} onChange={e => setModuloForm({...moduloForm, instrucaoCard: e.target.value})} rows={4} /></div>
              )}
              {MODO_CONFIG[moduloForm.modo as ModuloModo]?.temPontuacao && (
                <div className="grid grid-cols-2 gap-4">
                  <div><Label className="flex items-center gap-1"><Zap className="w-4 h-4 text-yellow-500" />Pontos Base</Label><Input type="number" value={moduloForm.pontuacaoBase} onChange={e => setModuloForm({...moduloForm, pontuacaoBase: parseInt(e.target.value)||0})} /></div>
                  {moduloForm.modo === 'desafio' && (<div><Label className="flex items-center gap-1"><Zap className="w-4 h-4 text-yellow-500" />Pontos Bonus</Label><Input type="number" value={moduloForm.pontuacaoBonus} onChange={e => setModuloForm({...moduloForm, pontuacaoBonus: parseInt(e.target.value)||0})} /></div>)}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setModuloDialogOpen(false)}>Cancelar</Button>
              <Button onClick={saveModulo} className="bg-purple-600 hover:bg-purple-700">{editingModuloIdx !== null ? 'Salvar' : 'Adicionar'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ============================================================
  // MAIN VIEW (Tabs: Global + Custom)
  // ============================================================
  return (
    <>
      <Header title="Trilhas" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="global" className="flex items-center gap-2">
              <Globe className="w-4 h-4" /> Trilhas Globais
            </TabsTrigger>
            <TabsTrigger value="custom" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" /> Trilhas da Empresa
            </TabsTrigger>
          </TabsList>

          {/* TAB: Global Trails */}
          <TabsContent value="global" className="space-y-4 mt-4">
            {globalSessions.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Globe className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">Nenhuma trilha global disponivel</p>
                  <p className="text-muted-foreground">O administrador master ainda nao criou trilhas globais</p>
                </CardContent>
              </Card>
            ) : (
              globalSessions.map(session => (
                <Card key={session.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FolderOpen className="w-5 h-5 text-purple-500" />
                      {session.titulo}
                    </CardTitle>
                    <CardDescription>{session.descricao}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(globalTrailsBySession[session.id] || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma trilha nesta sessao</p>
                    ) : (
                      <div className="space-y-2">
                        {(globalTrailsBySession[session.id] || []).map(trail => {
                          const isActive = activatedTrailIds.has(trail.id);
                          const isToggling = togglingTrail === trail.id;
                          return (
                            <div key={trail.id} className={`flex items-center justify-between p-3 rounded-lg border ${isActive ? 'bg-purple-50 border-purple-200' : 'bg-gray-50'}`}>
                              <div className="flex items-center gap-3 flex-1">
                                <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                                <div>
                                  <p className="font-medium text-sm">{trail.titulo}</p>
                                  <p className="text-xs text-muted-foreground line-clamp-1">{trail.descricao}</p>
                                  <div className="flex gap-2 mt-1">
                                    <Badge variant="secondary" className="text-xs">{trail.modulos?.length || 0} modulos</Badge>
                                    <Badge variant="secondary" className="text-xs"><Zap className="w-3 h-3 mr-1 text-yellow-500" />{trail.pontuacaoTotal || 0} pontos</Badge>
                                    <Badge variant="outline" className="text-xs">{trail.tempoEstimadoMin || 0} min</Badge>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" onClick={() => {
                                  setAnalyticsTrail({ trailId: trail.id, titulo: trail.titulo, totalInscritos: 0, emProgresso: 0, concluidos: 0, naoIniciados: 0, pontuacaoMedia: 0, taxaConclusao: 0 });
                                  setAnalyticsOpen(true);
                                }}>
                                  <BarChart3 className="w-4 h-4 text-blue-500" />
                                </Button>
                                <div className="flex items-center gap-2">
                                  {isToggling ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                                    <Switch checked={isActive} onCheckedChange={() => toggleGlobalTrail(trail, session.id)} />
                                  )}
                                  <span className="text-xs text-muted-foreground w-16">{isActive ? 'Ativada' : 'Desativada'}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* TAB: Custom Company Trails */}
          <TabsContent value="custom" className="space-y-4 mt-4">
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setSessionForm({ titulo: '', descricao: '' }); setSessionDialogOpen(true); }}>
                <FolderOpen className="w-4 h-4 mr-2" /> Nova Sessao
              </Button>
            </div>

            {companySessions.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">Nenhuma sessao personalizada</p>
                  <p className="text-muted-foreground mb-4">Crie sessoes e trilhas exclusivas da sua empresa</p>
                  <Button variant="outline" onClick={() => { setSessionForm({ titulo: '', descricao: '' }); setSessionDialogOpen(true); }}>
                    <Plus className="w-4 h-4 mr-2" /> Criar Sessao
                  </Button>
                </CardContent>
              </Card>
            ) : (
              companySessions.map(session => {
                const sessionTrails = companyTrailsBySession[session.id] || [];
                const isSessionToggling = togglingSession === session.id;
                return (
                <Card key={session.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <FolderOpen className="w-5 h-5 text-purple-500" />
                        {session.titulo}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                          {isSessionToggling ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                            <Switch checked={session.ativa} onCheckedChange={() => toggleCompanySessionActive(session)} />
                          )}
                          <span className="text-xs text-muted-foreground w-16">{session.ativa ? 'Ativa' : 'Inativa'}</span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => {
                          setEditingCompanySession(session);
                          setEditSessionForm({ titulo: session.titulo, descricao: session.descricao });
                          setEditSessionDialogOpen(true);
                        }}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="sm" onClick={() => openBuilder(session)} className="bg-purple-600 hover:bg-purple-700">
                          <Plus className="w-4 h-4 mr-2" /> Nova Trilha
                        </Button>
                      </div>
                    </div>
                    <CardDescription>{session.descricao}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {sessionTrails.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhuma trilha nesta sessao. Clique em &quot;Nova Trilha&quot; para criar.</p>
                    ) : (
                      <div className="space-y-2">
                        {sessionTrails.map(trail => (
                          <div key={trail.id} className={`flex items-center justify-between p-3 rounded-lg border ${trail.ativa ? 'bg-purple-50 border-purple-200' : 'bg-gray-50'}`}>
                            <div className="flex items-center gap-3 flex-1">
                              <div className={`w-2.5 h-2.5 rounded-full ${trail.ativa ? 'bg-green-500' : 'bg-gray-300'}`} />
                              <div>
                                <p className="font-medium text-sm">{trail.titulo}</p>
                                <p className="text-xs text-muted-foreground line-clamp-1">{trail.descricao}</p>
                                <div className="flex gap-2 mt-1">
                                  <Badge variant="secondary" className="text-xs">{(trail.modulos || []).length} modulos</Badge>
                                  <Badge variant="secondary" className="text-xs"><Zap className="w-3 h-3 mr-1 text-yellow-500" />{trail.pontuacaoTotal || 0} pontos</Badge>
                                  <Badge variant="outline" className="text-xs">{trail.tempoEstimadoMin || 0} min</Badge>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="icon" onClick={() => {
                                setAnalyticsTrail({ trailId: trail.id, titulo: trail.titulo, totalInscritos: 0, emProgresso: 0, concluidos: 0, naoIniciados: 0, pontuacaoMedia: 0, taxaConclusao: 0 });
                                setAnalyticsOpen(true);
                              }}>
                                <BarChart3 className="w-4 h-4 text-blue-500" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => openBuilder(session, trail)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={async () => {
                                if (!companyId || !confirm('Excluir esta trilha?')) return;
                                try {
                                  await deleteDoc(doc(db, `companies/${companyId}/sessions/${session.id}/trails`, trail.id));
                                  loadCompanyData();
                                  toast({ title: 'Trilha excluida com sucesso' });
                                } catch (err) {
                                  toast({ variant: 'destructive', title: 'Erro ao excluir', description: err instanceof Error ? err.message : 'Erro' });
                                }
                              }}>
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                              <Switch checked={trail.ativa} onCheckedChange={() => toggleCompanyTrailActive(trail, session.id)} />
                              <span className="text-xs text-muted-foreground w-16">{trail.ativa ? 'Ativada' : 'Desativada'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* SESSION DIALOG */}
      <Dialog open={sessionDialogOpen} onOpenChange={setSessionDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Sessao</DialogTitle><DialogDescription>Crie uma sessao personalizada</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Titulo</Label><Input value={sessionForm.titulo} onChange={e => setSessionForm({...sessionForm, titulo: e.target.value})} /></div>
            <div><Label>Descricao</Label><Textarea value={sessionForm.descricao} onChange={e => setSessionForm({...sessionForm, descricao: e.target.value})} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSessionDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveCompanySession} disabled={saving} className="bg-purple-600 hover:bg-purple-700">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT SESSION DIALOG (company) */}
      <Dialog open={editSessionDialogOpen} onOpenChange={setEditSessionDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Sessao</DialogTitle><DialogDescription>Atualize os dados da sessao</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Titulo</Label><Input value={editSessionForm.titulo} onChange={e => setEditSessionForm({...editSessionForm, titulo: e.target.value})} /></div>
            <div><Label>Descricao</Label><Textarea value={editSessionForm.descricao} onChange={e => setEditSessionForm({...editSessionForm, descricao: e.target.value})} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSessionDialogOpen(false)}>Cancelar</Button>
            <Button onClick={updateCompanySession} disabled={saving} className="bg-purple-600 hover:bg-purple-700">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ANALYTICS DIALOG */}
      <Dialog open={analyticsOpen} onOpenChange={setAnalyticsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Analytics: {analyticsTrail?.titulo}</DialogTitle>
            <DialogDescription>Metricas de engajamento</DialogDescription>
          </DialogHeader>
          {analyticsTrail && (
            <div className="grid grid-cols-2 gap-4">
              <Card><CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{analyticsTrail.totalInscritos}</p>
                <p className="text-xs text-muted-foreground">Total Disponiveis</p>
              </CardContent></Card>
              <Card><CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-yellow-600">{analyticsTrail.emProgresso}</p>
                <p className="text-xs text-muted-foreground">Em Progresso</p>
              </CardContent></Card>
              <Card><CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-green-600">{analyticsTrail.concluidos}</p>
                <p className="text-xs text-muted-foreground">Concluidos</p>
              </CardContent></Card>
              <Card><CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-gray-500">{analyticsTrail.naoIniciados}</p>
                <p className="text-xs text-muted-foreground">Nao Iniciados</p>
              </CardContent></Card>
              <Card className="col-span-2"><CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-purple-600">{analyticsTrail.pontuacaoMedia.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Pontuacao Media</p>
              </CardContent></Card>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setAnalyticsOpen(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      </main>
    </>
  );
}
