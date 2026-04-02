'use client';
      toast({ title: 'Trilha salva com sucesso!' });

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, orderBy, Timestamp, writeBatch
} from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Plus, Pencil, Trash2, GripVertical, ChevronRight, ChevronDown,
  Play, BookOpen, HelpCircle, Wrench, Target, BarChart3,
  ArrowLeft, Loader2, Eye, Save, FolderOpen, Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SimpleRichEditor } from '@/components/ui/simple-rich-editor';
import type {
  Sessao, Trilha, Modulo, ModuloModo, QuestaoDesafio, MissaoGatilho,
  TrilhaAnalytics, MODO_LABELS, MODO_CONFIG, FIRESTORE_PATHS
} from '@/types/trilhas';
import { Header } from '@/components/dashboard/header';

// ============================================================
// CONSTANTES LOCAIS (evita import de const de types em client)
// ============================================================
const MODO_LABELS_LOCAL: Record<ModuloModo, string> = {
  aula: 'Aula (Video)',
  leitura: 'Leitura',
  desafio: 'Desafio (Quiz)',
  faca_voce_mesmo: 'Faca Voce Mesmo',
  missao_conteudo: 'Missao de Conteudo',
};

const MODO_ICONS_LOCAL: Record<ModuloModo, any> = {
  aula: Play,
  leitura: BookOpen,
  desafio: HelpCircle,
  faca_voce_mesmo: Wrench,
  missao_conteudo: Target,
};

const MODO_CONFIG_LOCAL: Record<ModuloModo, { temPontuacao: boolean; pontosPadrao: number; pontosBonus: number }> = {
  aula: { temPontuacao: true, pontosPadrao: 80, pontosBonus: 0 },
  leitura: { temPontuacao: true, pontosPadrao: 40, pontosBonus: 0 },
  desafio: { temPontuacao: true, pontosPadrao: 100, pontosBonus: 50 },
  faca_voce_mesmo: { temPontuacao: false, pontosPadrao: 0, pontosBonus: 0 },
  missao_conteudo: { temPontuacao: true, pontosPadrao: 50, pontosBonus: 0 },
};

type ViewMode = 'sessions' | 'trails' | 'builder';

export default function MasterTrilhasPage() {
  // --- View state ---
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>('sessions');
  const [selectedSession, setSelectedSession] = useState<Sessao | null>(null);
  const [selectedTrail, setSelectedTrail] = useState<Trilha | null>(null);

  // --- Data ---
  const [sessions, setSessions] = useState<Sessao[]>([]);
  const [trails, setTrails] = useState<Trilha[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Session Dialog ---
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Sessao | null>(null);
  const [sessionForm, setSessionForm] = useState({ titulo: '', descricao: '', ordem: 0 });

  // --- Trail Builder ---
  const [trailForm, setTrailForm] = useState({
    titulo: '', descricao: '', ordem: 0, tempoEstimadoMin: 30,
  });
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [moduloDialogOpen, setModuloDialogOpen] = useState(false);
  const [editingModuloIndex, setEditingModuloIndex] = useState<number | null>(null);
  const [moduloForm, setModuloForm] = useState<Partial<Modulo>>({
    titulo: '', modo: 'aula', videoUrl: '', conteudoHtml: '',
    instrucaoCard: '', pontuacaoBase: 80, pontuacaoBonus: 20,
  });
  const [questoes, setQuestoes] = useState<QuestaoDesafio[]>([]);
  const [saving, setSaving] = useState(false);

  // --- Analytics Dialog ---
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analyticsTrail, setAnalyticsTrail] = useState<TrilhaAnalytics | null>(null);

  // --- Expanded sessions ---
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  // ============================================================
  // FIRESTORE: Load Sessions
  // ============================================================
  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'globalSessions'), orderBy('ordem', 'asc'));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Sessao));
      setSessions(data);
    } catch (err) {
      console.error('Erro ao carregar sessoes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================================
  // FIRESTORE: Load Trails for a Session
  // ============================================================
  const loadTrails = useCallback(async (sessionId: string) => {
    try {
      const q = query(
        collection(db, `globalSessions/${sessionId}/trails`),
        orderBy('ordem', 'asc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Trilha));
    } catch (err) {
      console.error('Erro ao carregar trilhas:', err);
      return [];
    }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // ============================================================
  // SESSION CRUD
  // ============================================================
  const openSessionDialog = (session?: Sessao) => {
    if (session) {
      setEditingSession(session);
      setSessionForm({ titulo: session.titulo, descricao: session.descricao, ordem: session.ordem });
    } else {
      setEditingSession(null);
      setSessionForm({ titulo: '', descricao: '', ordem: sessions.length + 1 });
    }
    setSessionDialogOpen(true);
  };

  const saveSession = async () => {
    if (!sessionForm.titulo.trim()) return;
    setSaving(true);
    try {
      if (editingSession) {
        await updateDoc(doc(db, 'globalSessions', editingSession.id), {
          titulo: sessionForm.titulo,
          descricao: sessionForm.descricao,
          ordem: sessionForm.ordem,
          atualizadaEm: Timestamp.now(),
        });
      } else {
        await addDoc(collection(db, 'globalSessions'), {
          titulo: sessionForm.titulo,
          descricao: sessionForm.descricao,
          ordem: sessionForm.ordem,
          ativa: true,
          criadaEm: Timestamp.now(),
        });
      }
      setSessionDialogOpen(false);
      loadSessions();
    } catch (err) {
      console.error('Erro ao salvar sessao:', err);
    } finally {
      setSaving(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta sessao e todas as suas trilhas?')) return;
    try {
      // Delete all trails in session first
      const trailsSnap = await getDocs(collection(db, `globalSessions/${sessionId}/trails`));
      const batch = writeBatch(db);
      trailsSnap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(doc(db, 'globalSessions', sessionId));
      await batch.commit();
      loadSessions();
    } catch (err) {
      console.error('Erro ao excluir sessao:', err);
    }
  };

  const toggleSessionActive = async (session: Sessao) => {
    try {
      await updateDoc(doc(db, 'globalSessions', session.id), {
        ativa: !session.ativa,
        atualizadaEm: Timestamp.now(),
      });
      loadSessions();
    } catch (err) {
      console.error('Erro ao alterar status:', err);
    }
  };

  // ============================================================
  // TRAIL BUILDER - Open / Save
  // ============================================================
  const openTrailBuilder = (trail?: Trilha) => {
    if (trail) {
      setSelectedTrail(trail);
      setTrailForm({
        titulo: trail.titulo,
        descricao: trail.descricao,
        ordem: trail.ordem,
        tempoEstimadoMin: trail.tempoEstimadoMin || 30,
      });
      setModulos(trail.modulos || []);
    } else {
      setSelectedTrail(null);
      setTrailForm({ titulo: '', descricao: '', ordem: 0, tempoEstimadoMin: 30 });
      setModulos([]);
    }
    setViewMode('builder');
  };

  const calcPontuacao = (mods: Modulo[]) => {
    let total = 0;
    let bonus = 0;
    mods.forEach(m => {
      if (m.modo === 'aula') { total += 80; bonus += 20; }
      else if (m.modo === 'leitura') { total += 40; bonus += 20; }
      else if (m.modo === 'desafio') {
        total += (m.pontuacaoBase || 100);
        bonus += (m.pontuacaoBonus || 50);
      }
    });
    return { total, bonus };
  };

  const saveTrail = async () => {
    if (!selectedSession) return;
    if (!trailForm.titulo.trim()) {
      toast({ variant: 'destructive', title: 'Título obrigatório', description: 'Preencha o título da trilha para salvar.' });
      return;
    }
    setSaving(true);
    try {
      const { total, bonus } = calcPontuacao(modulos);
      const trailData = {
        sessionId: selectedSession.id,
        titulo: trailForm.titulo,
        descricao: trailForm.descricao,
        ordem: trailForm.ordem,
        ativa: true,
        pontuacaoTotal: total,
        pontuacaoBonus: bonus,
        tempoEstimadoMin: trailForm.tempoEstimadoMin,
        modulos: modulos.map((m, i) => ({ ...m, ordem: i })),
        atualizadaEm: Timestamp.now(),
      };

      if (selectedTrail) {
        await updateDoc(
          doc(db, `globalSessions/${selectedSession.id}/trails`, selectedTrail.id),
          trailData
        );
      } else {
        await addDoc(
          collection(db, `globalSessions/${selectedSession.id}/trails`),
          { ...trailData, criadaEm: Timestamp.now() }
        );
      }
      setViewMode('trails');
      // Reload trails for this session
      const updatedTrails = await loadTrails(selectedSession.id);
      setTrails(updatedTrails);
    } catch (err) {
      console.error('Erro ao salvar trilha:', err);
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: error instanceof Error ? error.message : 'Erro desconhecido' });
    } finally {
      setSaving(false);
    }
  };

  const deleteTrail = async (trailId: string) => {
    if (!selectedSession || !confirm('Excluir esta trilha?')) return;
    try {
      await deleteDoc(doc(db, `globalSessions/${selectedSession.id}/trails`, trailId));
      const updatedTrails = await loadTrails(selectedSession.id);
      setTrails(updatedTrails);
    } catch (err) {
      console.error('Erro ao excluir trilha:', err);
    }
  };

  // ============================================================
  // MODULO CRUD
  // ============================================================
  const openModuloDialog = (index?: number) => {
    if (index !== undefined && modulos[index]) {
      setEditingModuloIndex(index);
      const m = modulos[index];
      setModuloForm({
        titulo: m.titulo, modo: m.modo, videoUrl: m.videoUrl || '',
        conteudoHtml: m.conteudoHtml || '', instrucaoCard: m.instrucaoCard || '',
        pontuacaoBase: m.pontuacaoBase || MODO_CONFIG_LOCAL[m.modo].pontosPadrao,
        pontuacaoBonus: m.pontuacaoBonus || MODO_CONFIG_LOCAL[m.modo].pontosBonus,
      });
      setQuestoes(m.questoes || []);
    } else {
      setEditingModuloIndex(null);
      setModuloForm({
        titulo: '', modo: 'aula', videoUrl: '', conteudoHtml: '',
        instrucaoCard: '', pontuacaoBase: 80, pontuacaoBonus: 20,
      });
      setQuestoes([]);
    }
    setModuloDialogOpen(true);
  };

  const saveModulo = () => {
    if (!moduloForm.titulo?.trim()) return;
    const modo = moduloForm.modo as ModuloModo;
    const newModulo: Modulo = {
      id: editingModuloIndex !== null ? modulos[editingModuloIndex].id : `mod_${Date.now()}`,
      titulo: moduloForm.titulo || '',
      modo,
      ordem: editingModuloIndex !== null ? editingModuloIndex : modulos.length,
      videoUrl: modo === 'aula' ? moduloForm.videoUrl : undefined,
      conteudoHtml: modo === 'leitura' ? moduloForm.conteudoHtml : undefined,
      questoes: modo === 'desafio' ? questoes : undefined,
      pontuacaoBase: MODO_CONFIG_LOCAL[modo].temPontuacao ? (moduloForm.pontuacaoBase || MODO_CONFIG_LOCAL[modo].pontosPadrao) : undefined,
      pontuacaoBonus: MODO_CONFIG_LOCAL[modo].temPontuacao ? (moduloForm.pontuacaoBonus || MODO_CONFIG_LOCAL[modo].pontosBonus) : undefined,
      instrucaoCard: modo === 'faca_voce_mesmo' ? moduloForm.instrucaoCard : undefined,
      missaoGatilho: modo === 'missao_conteudo' ? {
        tipo: 'postar_linkedin',
        instrucoes: moduloForm.instrucaoCard || '',
        exemplos: [],
      } : undefined,
    };

    if (editingModuloIndex !== null) {
      const updated = [...modulos];
      updated[editingModuloIndex] = newModulo;
      setModulos(updated);
    } else {
      setModulos([...modulos, newModulo]);
    }
    setModuloDialogOpen(false);
  };

  const removeModulo = (index: number) => {
    setModulos(modulos.filter((_, i) => i !== index));
  };

  const moveModulo = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= modulos.length) return;
    const updated = [...modulos];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setModulos(updated);
  };

  // Questoes helpers
  const addQuestao = () => {
    setQuestoes([...questoes, { pergunta: '', opcoes: ['', '', '', ''], respostaCorreta: 0 }]);
  };

  const updateQuestao = (qIndex: number, field: string, value: any) => {
    const updated = [...questoes];
    if (field === 'pergunta') updated[qIndex].pergunta = value;
    else if (field === 'respostaCorreta') updated[qIndex].respostaCorreta = value;
    setQuestoes(updated);
  };

  const updateOpcao = (qIndex: number, oIndex: number, value: string) => {
    const updated = [...questoes];
    updated[qIndex].opcoes[oIndex] = value;
    setQuestoes(updated);
  };

  const removeQuestao = (qIndex: number) => {
    setQuestoes(questoes.filter((_, i) => i !== qIndex));
  };

  // Navigate to session trails
  const openSessionTrails = async (session: Sessao) => {
    setSelectedSession(session);
    setLoading(true);
    const sessionTrails = await loadTrails(session.id);
    setTrails(sessionTrails);
    setViewMode('trails');
    setLoading(false);
  };

  const toggleExpanded = (sessionId: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  // ============================================================
  // RENDER: Sessions View
  // ============================================================
  const renderSessionsView = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Sessoes de Aprendizagem</h2>
          <p className="text-muted-foreground">Gerencie sessoes globais e suas trilhas</p>
        </div>
        <Button onClick={() => openSessionDialog()} className="bg-purple-600 hover:bg-purple-700">
          <Plus className="w-4 h-4 mr-2" /> Nova Sessao
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      ) : sessions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderOpen className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Nenhuma sessao criada</p>
            <p className="text-muted-foreground mb-4">Crie sua primeira sessao de aprendizagem</p>
            <Button onClick={() => openSessionDialog()} variant="outline">
              <Plus className="w-4 h-4 mr-2" /> Criar Sessao
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map(session => (
            <Card key={session.id} className="overflow-hidden">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => openSessionTrails(session)}>
                  <div className={`w-2 h-2 rounded-full ${session.ativa ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div>
                    <h3 className="font-semibold">{session.titulo}</h3>
                    <p className="text-sm text-muted-foreground">{session.descricao}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">Ordem: {session.ordem}</Badge>
                  <Switch checked={session.ativa} onCheckedChange={() => toggleSessionActive(session)} />
                  <Button variant="ghost" size="icon" onClick={() => openSessionDialog(session)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteSession(session.id)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openSessionTrails(session)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  // ============================================================
  // RENDER: Trails List View (for selected session)
  // ============================================================
  const renderTrailsView = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => { setViewMode('sessions'); setSelectedSession(null); }}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{selectedSession?.titulo}</h2>
          <p className="text-muted-foreground">{selectedSession?.descricao}</p>
        </div>
        <Button onClick={() => openTrailBuilder()} className="bg-purple-600 hover:bg-purple-700">
          <Plus className="w-4 h-4 mr-2" /> Nova Trilha
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      ) : trails.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Nenhuma trilha nesta sessao</p>
            <p className="text-muted-foreground mb-4">Crie a primeira trilha de aprendizagem</p>
            <Button onClick={() => openTrailBuilder()} variant="outline">
              <Plus className="w-4 h-4 mr-2" /> Criar Trilha
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {trails.map(trail => {
            const Icon = trail.modulos?.length > 0
              ? MODO_ICONS_LOCAL[trail.modulos[0].modo]
              : BookOpen;
            return (
              <Card key={trail.id}>
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`w-2 h-2 rounded-full ${trail.ativa ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <div>
                      <h3 className="font-semibold">{trail.titulo}</h3>
                      <p className="text-sm text-muted-foreground">{trail.descricao}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="secondary">{trail.modulos?.length || 0} modulos</Badge>
                        <Badge variant="secondary">{trail.pontuacaoTotal || 0} pts</Badge>
                        {trail.pontuacaoBonus > 0 && (
                          <Badge variant="outline" className="text-yellow-600">+{trail.pontuacaoBonus} bonus</Badge>
                        )}
                        <Badge variant="outline">{trail.tempoEstimadoMin || 0} min</Badge>
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
                    <Button variant="ghost" size="icon" onClick={() => openTrailBuilder(trail)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteTrail(trail.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  // ============================================================
  // RENDER: Trail Builder View
  // ============================================================
  const renderBuilderView = () => {
    const { total, bonus } = calcPontuacao(modulos);
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setViewMode('trails')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
          <div className="flex-1">
            <h2 className="text-2xl font-bold">
              {selectedTrail ? 'Editar Trilha' : 'Nova Trilha'}
            </h2>
            <p className="text-muted-foreground">Sessao: {selectedSession?.titulo}</p>
          </div>
          <Button onClick={saveTrail} disabled={saving} className="bg-purple-600 hover:bg-purple-700">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar Trilha
          </Button>
        </div>

        {/* Metadata */}
        <Card>
          <CardHeader>
            <CardTitle>Informacoes da Trilha</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Titulo</Label>
              <Input value={trailForm.titulo} onChange={e => setTrailForm({...trailForm, titulo: e.target.value})} placeholder="Ex: Fundamentos do LinkedIn" />
            </div>
            <div className="col-span-2">
              <Label>Descricao</Label>
              <Textarea value={trailForm.descricao} onChange={e => setTrailForm({...trailForm, descricao: e.target.value})} placeholder="Descreva o objetivo desta trilha..." />
            </div>
            <div>
              <Label>Ordem</Label>
              <Input type="number" value={trailForm.ordem} onChange={e => setTrailForm({...trailForm, ordem: parseInt(e.target.value) || 0})} />
            </div>
            <div>
              <Label>Tempo Estimado (min)</Label>
              <Input type="number" value={trailForm.tempoEstimadoMin} onChange={e => setTrailForm({...trailForm, tempoEstimadoMin: parseInt(e.target.value) || 0})} />
            </div>
          </CardContent>
        </Card>

        {/* Score Summary */}
        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold text-purple-600">{total}</p>
            <p className="text-sm text-muted-foreground">Pontuacao Total</p>
          </CardContent></Card>
          <Card><CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold text-yellow-600">+{bonus}</p>
            <p className="text-sm text-muted-foreground">Bonus Possivel</p>
          </CardContent></Card>
          <Card><CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold">{modulos.length}</p>
            <p className="text-sm text-muted-foreground">Modulos</p>
          </CardContent></Card>
        </div>

        {/* Modulos List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Modulos</CardTitle>
              <CardDescription>Arraste para reordenar. Clique para editar.</CardDescription>
            </div>
            <Button onClick={() => openModuloDialog()} size="sm" className="bg-purple-600 hover:bg-purple-700">
              <Plus className="w-4 h-4 mr-2" /> Adicionar Modulo
            </Button>
          </CardHeader>
          <CardContent>
            {modulos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhum modulo adicionado</p>
                <p className="text-sm">Clique em "Adicionar Modulo" para comecar</p>
              </div>
            ) : (
              <div className="space-y-2">
                {modulos.map((modulo, index) => {
                  const ModoIcon = MODO_ICONS_LOCAL[modulo.modo];
                  return (
                    <div key={modulo.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                      <div className="flex flex-col gap-1">
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveModulo(index, 'up')} disabled={index === 0}>
                          <ChevronDown className="w-3 h-3 rotate-180" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveModulo(index, 'down')} disabled={index === modulos.length - 1}>
                          <ChevronDown className="w-3 h-3" />
                        </Button>
                      </div>
                      <GripVertical className="w-4 h-4 text-gray-400" />
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                        <ModoIcon className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{modulo.titulo}</p>
                        <p className="text-xs text-muted-foreground">{MODO_LABELS_LOCAL[modulo.modo]}</p>
                      </div>
                      {MODO_CONFIG_LOCAL[modulo.modo].temPontuacao && (
                        <Badge variant="secondary">{modulo.pontuacaoBase || 0} pts</Badge>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => openModuloDialog(index)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => removeModulo(index)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // ============================================================
  // MAIN RETURN
  // ============================================================
  return (
    <>
      <Header title="Trilhas" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
      {viewMode === 'sessions' && renderSessionsView()}
      {viewMode === 'trails' && renderTrailsView()}
      {viewMode === 'builder' && renderBuilderView()}

      {/* SESSION DIALOG */}
      <Dialog open={sessionDialogOpen} onOpenChange={setSessionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSession ? 'Editar Sessao' : 'Nova Sessao'}</DialogTitle>
            <DialogDescription>Preencha os dados da sessao de aprendizagem</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Titulo</Label>
              <Input value={sessionForm.titulo} onChange={e => setSessionForm({...sessionForm, titulo: e.target.value})} placeholder="Ex: Modulo Basico" />
            </div>
            <div>
              <Label>Descricao</Label>
              <Textarea value={sessionForm.descricao} onChange={e => setSessionForm({...sessionForm, descricao: e.target.value})} placeholder="Descreva esta sessao..." />
            </div>
            <div>
              <Label>Ordem</Label>
              <Input type="number" value={sessionForm.ordem} onChange={e => setSessionForm({...sessionForm, ordem: parseInt(e.target.value) || 0})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSessionDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveSession} disabled={saving} className="bg-purple-600 hover:bg-purple-700">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {editingSession ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODULO DIALOG */}
      <Dialog open={moduloDialogOpen} onOpenChange={setModuloDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingModuloIndex !== null ? 'Editar Modulo' : 'Novo Modulo'}</DialogTitle>
            <DialogDescription>Configure o modulo de aprendizagem</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Titulo do Modulo</Label>
              <Input value={moduloForm.titulo} onChange={e => setModuloForm({...moduloForm, titulo: e.target.value})} placeholder="Ex: Introducao ao LinkedIn" />
            </div>
            <div>
              <Label>Modo</Label>
              <Select value={moduloForm.modo} onValueChange={(v: ModuloModo) => {
                setModuloForm({
                  ...moduloForm, modo: v,
                  pontuacaoBase: MODO_CONFIG_LOCAL[v].pontosPadrao,
                  pontuacaoBonus: MODO_CONFIG_LOCAL[v].pontosBonus,
                });
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(MODO_LABELS_LOCAL) as ModuloModo[]).map(modo => (
                    <SelectItem key={modo} value={modo}>{MODO_LABELS_LOCAL[modo]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* MODO: AULA */}
            {moduloForm.modo === 'aula' && (
              <div>
                <Label>URL do Video (YouTube)</Label>
                <Input value={moduloForm.videoUrl} onChange={e => setModuloForm({...moduloForm, videoUrl: e.target.value})} placeholder="Cole o link do YouTube aqui" />
                <p className="text-xs text-muted-foreground mt-1">O colaborador precisa assistir 80% para completar</p>
              </div>
              <div className="space-y-2 mt-4">
                <Label>Material de Apoio (PDF)</Label>
                <Input
                  placeholder="Cole o link do PDF aqui (Google Drive, Dropbox, etc.)"
                  value={moduloForm.materialPdfUrl || ''}
                  onChange={(e) => setModuloForm({...moduloForm, materialPdfUrl: e.target.value})}
                />
              </div>
            )}

            {/* MODO: LEITURA */}
            {moduloForm.modo === 'leitura' && (
              <div>
                <Label>Conteudo (HTML)</Label>
                <SimpleRichEditor
                  value={moduloForm.conteudoHtml || ''}
                  onChange={(html) => setModuloForm({...moduloForm, conteudoHtml: html})}
                  placeholder="Digite o conteudo da leitura aqui..."
                />
              </div>
            )}

            {/* MODO: DESAFIO */}
            {moduloForm.modo === 'desafio' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Questoes ({questoes.length})</Label>
                  <Button size="sm" variant="outline" onClick={addQuestao}>
                    <Plus className="w-3 h-3 mr-1" /> Adicionar
                  </Button>
                </div>
                {questoes.length < 3 && (
                  <p className="text-sm text-yellow-600">Minimo de 3 questoes recomendado</p>
                )}
                {questoes.map((q, qi) => (
                  <Card key={qi} className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Questao {qi + 1}</Label>
                        <Button size="sm" variant="ghost" onClick={() => removeQuestao(qi)}>
                          <Trash2 className="w-3 h-3 text-red-500" />
                        </Button>
                      </div>
                      <Input value={q.pergunta} onChange={e => updateQuestao(qi, 'pergunta', e.target.value)} placeholder="Digite a pergunta..." />
                      {q.opcoes.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <input type="radio" name={`q${qi}`} checked={q.respostaCorreta === oi} onChange={() => updateQuestao(qi, 'respostaCorreta', oi)} />
                          <Input value={opt} onChange={e => updateOpcao(qi, oi, e.target.value)} placeholder={`Opcao ${oi + 1}`} className="flex-1" />
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* MODO: FACA VOCE MESMO */}
            {moduloForm.modo === 'faca_voce_mesmo' && (
              <div>
                <Label>Instrucoes do Card</Label>
                <Textarea value={moduloForm.instrucaoCard} onChange={e => setModuloForm({...moduloForm, instrucaoCard: e.target.value})} placeholder="Descreva a atividade pratica..." rows={6} />
                <p className="text-xs text-muted-foreground mt-1">Sem pontuacao - o colaborador marca como visualizado</p>
              </div>
            )}

            {/* MODO: MISSAO CONTEUDO */}
            {moduloForm.modo === 'missao_conteudo' && (
              <div className="space-y-4">
                <div>
                  <Label>Instrucoes da Missao</Label>
                  <Textarea value={moduloForm.instrucaoCard} onChange={e => setModuloForm({...moduloForm, instrucaoCard: e.target.value})} placeholder="Descreva o que o colaborador deve postar..." rows={4} />
                </div>
                <p className="text-xs text-muted-foreground">Sem pontuacao direta - cria uma missao na aba Missoes ao desbloquear</p>
              </div>
            )}

            {/* PONTUACAO (quando aplicavel) */}
            {MODO_CONFIG_LOCAL[moduloForm.modo as ModuloModo]?.temPontuacao && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="flex items-center gap-1"><Zap className="w-4 h-4 text-yellow-500" />Pontuacao Base</Label>
                  <Input type="number" value={moduloForm.pontuacaoBase} onChange={e => setModuloForm({...moduloForm, pontuacaoBase: parseInt(e.target.value) || 0})} />
                </div>
                {moduloForm.modo === 'desafio' && (
<div>
                  <Label className="flex items-center gap-1"><Zap className="w-4 h-4 text-yellow-500" />Pontuacao Bonus</Label>
                  <Input type="number" value={moduloForm.pontuacaoBonus} onChange={e => setModuloForm({...moduloForm, pontuacaoBonus: parseInt(e.target.value) || 0})} />
                </div>
)}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModuloDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveModulo} className="bg-purple-600 hover:bg-purple-700">
              {editingModuloIndex !== null ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ANALYTICS DIALOG */}
      <Dialog open={analyticsOpen} onOpenChange={setAnalyticsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Analytics: {analyticsTrail?.titulo}</DialogTitle>
            <DialogDescription>Metricas de engajamento desta trilha</DialogDescription>
          </DialogHeader>
          {analyticsTrail && (
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold text-blue-600">{analyticsTrail.totalInscritos}</p>
                  <p className="text-xs text-muted-foreground">Total Inscritos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold text-yellow-600">{analyticsTrail.emProgresso}</p>
                  <p className="text-xs text-muted-foreground">Em Progresso</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{analyticsTrail.concluidos}</p>
                  <p className="text-xs text-muted-foreground">Concluidos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold text-gray-500">{analyticsTrail.naoIniciados}</p>
                  <p className="text-xs text-muted-foreground">Nao Iniciados</p>
                </CardContent>
              </Card>
              <Card className="col-span-2">
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold text-purple-600">{analyticsTrail.pontuacaoMedia.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">Pontuacao Media</p>
                </CardContent>
              </Card>
              <Card className="col-span-2">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">Taxa de Conclusao</span>
                    <span className="text-sm font-bold">{analyticsTrail.taxaConclusao.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-purple-600 h-2 rounded-full" style={{ width: `${analyticsTrail.taxaConclusao}%` }} />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnalyticsOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </main>
    </>
  );
}
