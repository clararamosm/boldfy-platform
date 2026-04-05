'use client';

import { useState, useCallback, useEffect } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, orderBy, Timestamp, writeBatch,
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
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Plus, Pencil, Trash2, ChevronRight, BookOpen,
  ArrowLeft, Loader2, FolderOpen, Zap,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Sessao, Trilha, Modulo, TrilhaAnalytics } from '@/types/trilhas';
import { TrailBuilder, TrailCard, AnalyticsDialog, calcPontuacao, type TrailFormData } from '@/components/trilhas';
import { Header } from '@/components/dashboard/header';

type ViewMode = 'sessions' | 'trails' | 'builder';

export default function MasterTrilhasPage() {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>('sessions');
  const [selectedSession, setSelectedSession] = useState<Sessao | null>(null);
  const [selectedTrail, setSelectedTrail] = useState<Trilha | null>(null);

  // Data
  const [sessions, setSessions] = useState<Sessao[]>([]);
  const [trails, setTrails] = useState<Trilha[]>([]);
  const [loading, setLoading] = useState(true);

  // Session Dialog
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Sessao | null>(null);
  const [sessionForm, setSessionForm] = useState({ titulo: '', descricao: '', ordem: 0 });

  // Trail Builder
  const [trailForm, setTrailForm] = useState<TrailFormData>({ titulo: '', descricao: '', tempoEstimadoMin: 30, pontuacaoBonusTrilha: 0 });
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [saving, setSaving] = useState(false);

  // Analytics
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analyticsTrail, setAnalyticsTrail] = useState<TrilhaAnalytics | null>(null);

  // ============================================================
  // FIRESTORE: Load Sessions
  // ============================================================
  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'globalSessions'), orderBy('ordem', 'asc'));
      const snap = await getDocs(q);
      setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Sessao)));
    } catch (err) {
      console.error('Erro ao carregar sessoes:', err);
      toast({ variant: 'destructive', title: 'Erro ao carregar sessoes', description: err instanceof Error ? err.message : 'Erro desconhecido' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadTrails = useCallback(async (sessionId: string) => {
    try {
      const q = query(collection(db, `globalSessions/${sessionId}/trails`), orderBy('ordem', 'asc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Trilha));
    } catch (err) {
      console.error('Erro ao carregar trilhas:', err);
      toast({ variant: 'destructive', title: 'Erro ao carregar trilhas', description: err instanceof Error ? err.message : 'Erro desconhecido' });
      return [];
    }
  }, [toast]);

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
          titulo: sessionForm.titulo, descricao: sessionForm.descricao,
          ordem: sessionForm.ordem, atualizadaEm: Timestamp.now(),
        });
      } else {
        await addDoc(collection(db, 'globalSessions'), {
          titulo: sessionForm.titulo, descricao: sessionForm.descricao,
          ordem: sessionForm.ordem, ativa: true, criadaEm: Timestamp.now(),
        });
      }
      toast({ title: 'Sessao salva com sucesso!' });
      setSessionDialogOpen(false);
      loadSessions();
    } catch (err) {
      console.error('Erro ao salvar sessao:', err);
      toast({ variant: 'destructive', title: 'Erro ao salvar sessao', description: err instanceof Error ? err.message : 'Erro desconhecido' });
    } finally {
      setSaving(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta sessao e todas as suas trilhas?')) return;
    try {
      const trailsSnap = await getDocs(collection(db, `globalSessions/${sessionId}/trails`));
      const batch = writeBatch(db);
      trailsSnap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(doc(db, 'globalSessions', sessionId));
      await batch.commit();
      toast({ title: 'Sessao excluida com sucesso!' });
      loadSessions();
    } catch (err) {
      console.error('Erro ao excluir sessao:', err);
      toast({ variant: 'destructive', title: 'Erro ao excluir sessao', description: err instanceof Error ? err.message : 'Erro desconhecido' });
    }
  };

  const toggleSessionActive = async (session: Sessao) => {
    try {
      await updateDoc(doc(db, 'globalSessions', session.id), {
        ativa: !session.ativa, atualizadaEm: Timestamp.now(),
      });
      toast({ title: 'Status alterado com sucesso!' });
      loadSessions();
    } catch (err) {
      console.error('Erro ao alterar status:', err);
      toast({ variant: 'destructive', title: 'Erro ao alterar status', description: err instanceof Error ? err.message : 'Erro desconhecido' });
    }
  };

  // ============================================================
  // TRAIL BUILDER - Open / Save / Delete
  // ============================================================
  const openTrailBuilder = (trail?: Trilha) => {
    if (trail) {
      setSelectedTrail(trail);
      setTrailForm({
        titulo: trail.titulo, descricao: trail.descricao,
        tempoEstimadoMin: trail.tempoEstimadoMin || 30,
        pontuacaoBonusTrilha: trail.pontuacaoBonusTrilha || 0,
        ordem: trail.ordem,
      });
      setModulos(trail.modulos || []);
    } else {
      setSelectedTrail(null);
      setTrailForm({ titulo: '', descricao: '', tempoEstimadoMin: 30, pontuacaoBonusTrilha: 0 });
      setModulos([]);
    }
    setViewMode('builder');
  };

  const saveTrail = async () => {
    if (!selectedSession) return;
    if (!trailForm.titulo.trim()) {
      toast({ variant: 'destructive', title: 'Titulo obrigatorio', description: 'Preencha o titulo da trilha para salvar.' });
      return;
    }
    setSaving(true);
    try {
      const { total, bonus } = calcPontuacao(modulos);
      const trailData = {
        sessionId: selectedSession.id, titulo: trailForm.titulo, descricao: trailForm.descricao,
        ordem: trailForm.ordem || 0, ativa: true, pontuacaoTotal: total, pontuacaoBonus: bonus,
        pontuacaoBonusTrilha: trailForm.pontuacaoBonusTrilha || 0,
        tempoEstimadoMin: trailForm.tempoEstimadoMin,
        modulos: modulos.map((m, i) => Object.fromEntries(Object.entries({ ...m, ordem: i }).filter(([_, v]) => v !== undefined))),
        atualizadaEm: Timestamp.now(),
      };
      if (selectedTrail) {
        await updateDoc(doc(db, `globalSessions/${selectedSession.id}/trails`, selectedTrail.id), trailData);
      } else {
        await addDoc(collection(db, `globalSessions/${selectedSession.id}/trails`), { ...trailData, criadaEm: Timestamp.now() });
      }
      setViewMode('trails');
      toast({ title: 'Trilha salva com sucesso!' });
      const updatedTrails = await loadTrails(selectedSession.id);
      setTrails(updatedTrails);
    } catch (err) {
      console.error('Erro ao salvar trilha:', err);
      toast({ variant: 'destructive', title: 'Erro ao salvar trilha', description: err instanceof Error ? err.message : 'Erro desconhecido' });
    } finally {
      setSaving(false);
    }
  };

  const deleteTrail = async (trailId: string) => {
    if (!selectedSession || !confirm('Excluir esta trilha?')) return;
    try {
      await deleteDoc(doc(db, `globalSessions/${selectedSession.id}/trails`, trailId));
      toast({ title: 'Trilha excluida com sucesso!' });
      const updatedTrails = await loadTrails(selectedSession.id);
      setTrails(updatedTrails);
    } catch (err) {
      console.error('Erro ao excluir trilha:', err);
      toast({ variant: 'destructive', title: 'Erro ao excluir trilha', description: err instanceof Error ? err.message : 'Erro desconhecido' });
    }
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

  const openAnalytics = (trail: Trilha) => {
    setAnalyticsTrail({ trailId: trail.id, titulo: trail.titulo, totalInscritos: 0, emProgresso: 0, concluidos: 0, naoIniciados: 0, pontuacaoMedia: 0, taxaConclusao: 0 });
    setAnalyticsOpen(true);
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
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>
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
                  <FolderOpen className="w-5 h-5 text-purple-500" />
                  <div>
                    <h3 className="font-semibold">{session.titulo}</h3>
                    <p className="text-sm text-muted-foreground">{session.descricao}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
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
  // RENDER: Trails List View
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
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>
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
          {trails.map(trail => (
            <TrailCard
              key={trail.id}
              trail={trail}
              onEdit={() => openTrailBuilder(trail)}
              onDelete={() => deleteTrail(trail.id)}
              onAnalytics={() => openAnalytics(trail)}
            />
          ))}
        </div>
      )}
    </div>
  );

  // ============================================================
  // MAIN RETURN
  // ============================================================
  return (
    <>
      <Header title="Trilhas" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        {viewMode === 'sessions' && renderSessionsView()}
        {viewMode === 'trails' && renderTrailsView()}
        {viewMode === 'builder' && (
          <TrailBuilder
            session={selectedSession}
            isEditing={!!selectedTrail}
            trailForm={trailForm}
            onTrailFormChange={setTrailForm}
            modulos={modulos}
            onModulosChange={setModulos}
            saving={saving}
            onSave={saveTrail}
            onBack={() => setViewMode('trails')}
          />
        )}

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
                <Input value={sessionForm.titulo} onChange={e => setSessionForm({ ...sessionForm, titulo: e.target.value })} placeholder="Ex: Modulo Basico" />
              </div>
              <div>
                <Label>Descricao</Label>
                <Textarea value={sessionForm.descricao} onChange={e => setSessionForm({ ...sessionForm, descricao: e.target.value })} placeholder="Descreva esta sessao..." />
              </div>
              <div>
                <Label>Ordem</Label>
                <Input type="number" value={sessionForm.ordem} onChange={e => setSessionForm({ ...sessionForm, ordem: parseInt(e.target.value) || 0 })} />
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

        {/* ANALYTICS DIALOG */}
        <AnalyticsDialog open={analyticsOpen} onOpenChange={setAnalyticsOpen} analytics={analyticsTrail} showTaxaConclusao />
      </main>
    </>
  );
}
