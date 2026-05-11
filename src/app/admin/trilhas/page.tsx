'use client';

import { useState, useEffect, useCallback } from 'react';
import { db, storage } from '@/lib/firebase';
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, orderBy, Timestamp, setDoc, writeBatch,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useResolvedCompanyId } from '@/hooks/use-resolved-company-id';
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
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Globe, Building2, FolderOpen, Loader2, ChevronRight, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import type { Sessao, Trilha, Modulo } from '@/types/trilhas';
import { completeOnboardingItem } from '@/hooks/use-onboarding';
import { MODO_CONFIG } from '@/types/trilhas';
import { TrailBuilder, TrailCard, AnalyticsDialog, calcPontuacao, type TrailFormData } from '@/components/trilhas';
import type { TrilhaAnalytics } from '@/types/trilhas';
import { Header } from '@/components/dashboard/header';
import { SuggestTrailDialog } from '@/components/suggest-trail-dialog';
import { useLocale, useT } from '@/lib/i18n/context';

export default function AdminTrilhasPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const locale = useLocale();
  const t = useT();
  const companyId = useResolvedCompanyId();

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

  // Builder state
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingTrail, setEditingTrail] = useState<Trilha | null>(null);
  const [trailForm, setTrailForm] = useState<TrailFormData>({ titulo: '', descricao: '', tempoEstimadoMin: 30, pontuacaoBonusTrilha: 0 });
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [saving, setSaving] = useState(false);

  // Session dialog
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [sessionForm, setSessionForm] = useState({ titulo: '', descricao: '' });

  // Analytics
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analyticsTrail, setAnalyticsTrail] = useState<TrilhaAnalytics | null>(null);

  // Delete confirmation
  const [deleteTrailTarget, setDeleteTrailTarget] = useState<{ trailId: string; sessionId: string } | null>(null);
  const [deleteSessionTarget, setDeleteSessionTarget] = useState<Sessao | null>(null);
  const [deletingSession, setDeletingSession] = useState(false);

  // Accordion: sessoes expandidas (multiplas simultaneas, separado por aba).
  const [expandedGlobalSessions, setExpandedGlobalSessions] = useState<Set<string>>(new Set());
  const [expandedCompanySessions, setExpandedCompanySessions] = useState<Set<string>>(new Set());

  // Bulk toggle de trilhas globais por sessao (ativar/desativar todas).
  const [togglingSessionBulk, setTogglingSessionBulk] = useState<string | null>(null);

  // ============================================================
  // Load global sessions + trails + activated status
  // ============================================================
  const loadGlobalData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const sessSnap = await getDocs(query(collection(db, 'globalSessions'), orderBy('ordem', 'asc')));
      const sessions = sessSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as Sessao))
        .filter(s => s.ativa && (s.locale || 'pt-BR') === locale);
      setGlobalSessions(sessions);

      const trailsMap: Record<string, Trilha[]> = {};
      for (const sess of sessions) {
        const trailSnap = await getDocs(query(collection(db, `globalSessions/${sess.id}/trails`), orderBy('ordem', 'asc')));
        trailsMap[sess.id] = trailSnap.docs.map(d => ({ id: d.id, ...d.data() } as Trilha)).filter(t => t.ativa);
      }
      setGlobalTrailsBySession(trailsMap);

      const actSnap = await getDocs(collection(db, `companies/${companyId}/activatedGlobalTrails`));
      setActivatedTrailIds(new Set(actSnap.docs.map(d => d.id)));
    } catch (err) {
      console.error('Erro ao carregar trilhas globais:', err);
      toast({ variant: 'destructive', title: t.adminTrails.toastTrailLoadError, description: err instanceof Error ? err.message : '' });
    } finally {
      setLoading(false);
    }
  }, [companyId, locale, toast]);

  // ============================================================
  // Load company custom sessions + trails
  // ============================================================
  const loadCompanyData = useCallback(async () => {
    if (!companyId) return;
    try {
      const sessSnap = await getDocs(query(collection(db, `companies/${companyId}/sessions`), orderBy('ordem', 'asc')));
      const sessions = sessSnap.docs.map(d => ({ id: d.id, ...d.data() } as Sessao));
      setCompanySessions(sessions);

      const trailsBySession: Record<string, Trilha[]> = {};
      for (const sess of sessions) {
        const trailsSnap = await getDocs(query(collection(db, `companies/${companyId}/sessions/${sess.id}/trails`), orderBy('ordem', 'asc')));
        trailsBySession[sess.id] = trailsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Trilha));
      }
      setCompanyTrailsBySession(trailsBySession);
    } catch (err) {
      console.error('Erro ao carregar sessoes da empresa:', err);
      toast({ variant: 'destructive', title: t.adminTrails.toastSessionLoadError, description: err instanceof Error ? err.message : '' });
    }
  }, [companyId, toast]);

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
        await deleteDoc(docRef);
        setActivatedTrailIds(prev => { const next = new Set(prev); next.delete(trail.id); return next; });
      } else {
        await setDoc(docRef, {
          trailId: trail.id, sessionId, titulo: trail.titulo,
          ativadaEm: Timestamp.now(), ativadaPor: user.uid,
        });
        setActivatedTrailIds(prev => { const next = new Set(prev); next.add(trail.id); return next; });
        completeOnboardingItem(user?.uid, 'activate-trails');
      }
      toast({ title: t.adminTrails.toastTrailToggled });
    } catch (err) {
      console.error('Erro ao alterar trilha:', err);
      toast({ variant: 'destructive', title: t.adminTrails.toastTrailToggleError, description: err instanceof Error ? err.message : '' });
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
        titulo: sessionForm.titulo, descricao: sessionForm.descricao,
        ordem: companySessions.length + 1, ativa: true, criadaEm: Timestamp.now(),
      });
      toast({ title: t.adminTrails.toastSessionCreated });
      setSessionDialogOpen(false);
      setSessionForm({ titulo: '', descricao: '' });
      loadCompanyData();
    } catch (err) {
      console.error('Erro ao criar sessao:', err);
      toast({ variant: 'destructive', title: t.adminTrails.toastSessionCreateError, description: err instanceof Error ? err.message : '' });
    } finally {
      setSaving(false);
    }
  };

  const updateCompanySession = async () => {
    if (!companyId || !editingCompanySession || !editSessionForm.titulo.trim()) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, `companies/${companyId}/sessions`, editingCompanySession.id), {
        titulo: editSessionForm.titulo, descricao: editSessionForm.descricao, atualizadaEm: Timestamp.now(),
      });
      toast({ title: t.adminTrails.toastSessionUpdated });
      setEditSessionDialogOpen(false);
      loadCompanyData();
    } catch (err) {
      console.error('Erro ao atualizar sessao:', err);
      toast({ variant: 'destructive', title: t.adminTrails.toastSessionUpdateError, description: err instanceof Error ? err.message : '' });
    } finally {
      setSaving(false);
    }
  };

  const toggleCompanySessionActive = async (session: Sessao) => {
    if (!companyId) return;
    setTogglingSession(session.id);
    try {
      await updateDoc(doc(db, `companies/${companyId}/sessions`, session.id), {
        ativa: !session.ativa, atualizadaEm: Timestamp.now(),
      });
      toast({ title: session.ativa ? t.adminTrails.toastSessionDeactivated : t.adminTrails.toastSessionActivated });
      loadCompanyData();
    } catch (err) {
      console.error('Erro ao alterar sessao:', err);
      toast({ variant: 'destructive', title: t.adminTrails.toastSessionToggleError, description: err instanceof Error ? err.message : '' });
    } finally {
      setTogglingSession(null);
    }
  };

  const toggleCompanyTrailActive = async (trail: Trilha, sessionId: string) => {
    if (!companyId) return;
    try {
      await updateDoc(doc(db, `companies/${companyId}/sessions/${sessionId}/trails`, trail.id), {
        ativa: !trail.ativa, atualizadaEm: Timestamp.now(),
      });
      toast({ title: trail.ativa ? t.adminTrails.toastTrailDeactivated : t.adminTrails.toastTrailActivated });
      loadCompanyData();
    } catch (err) {
      console.error('Erro ao alterar trilha:', err);
      toast({ variant: 'destructive', title: t.adminTrails.toastTrailToggleError, description: err instanceof Error ? err.message : '' });
    }
  };

  // ============================================================
  // Builder
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

  const handleImageUpload = useCallback(async (file: File): Promise<string> => {
    const path = `companies/${companyId}/trails/images/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  }, [companyId]);

  const saveCompanyTrail = async () => {
    if (!companyId || !selectedSession) return;
    if (!trailForm.titulo.trim()) {
      toast({ variant: 'destructive', title: t.adminTrails.validationTitleRequired, description: t.adminTrails.validationTitleMessage });
      return;
    }
    setSaving(true);
    try {
      const { total, bonus } = calcPontuacao(modulos);
      const trailData = {
        sessionId: selectedSession.id, titulo: trailForm.titulo, descricao: trailForm.descricao,
        ordem: 0, ativa: true, pontuacaoTotal: total, pontuacaoBonus: bonus,
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
      toast({ title: t.adminTrails.toastTrailSaved });
    } catch (err) {
      console.error('Erro ao salvar trilha:', err);
      toast({ variant: 'destructive', title: t.adminTrails.toastTrailSaveError, description: err instanceof Error ? err.message : '' });
    } finally {
      setSaving(false);
    }
  };

  const openAnalytics = (trail: Trilha) => {
    setAnalyticsTrail({ trailId: trail.id, titulo: trail.titulo, totalInscritos: 0, emProgresso: 0, concluidos: 0, naoIniciados: 0, pontuacaoMedia: 0, taxaConclusao: 0 });
    setAnalyticsOpen(true);
  };

  // ============================================================
  // ACCORDION: toggle expandir/colapsar sessoes
  // ============================================================
  const toggleGlobalSessionExpanded = (sessionId: string) => {
    setExpandedGlobalSessions(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  const toggleCompanySessionExpanded = (sessionId: string) => {
    setExpandedCompanySessions(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  // ============================================================
  // BULK TOGGLE: ativa/desativa todas as trilhas de uma sessao global
  // ============================================================
  // Comportamento: se TODAS estao ativas, desativa todas. Senao (zero ou
  // algumas), ativa todas. Usa writeBatch pra performance e atomicidade.
  const toggleAllTrailsInGlobalSession = async (session: Sessao) => {
    if (!companyId || !user) return;
    const trails = globalTrailsBySession[session.id] || [];
    if (trails.length === 0) return;

    const allActive = trails.every(t => activatedTrailIds.has(t.id));
    setTogglingSessionBulk(session.id);
    try {
      const batch = writeBatch(db);
      const newActivatedIds = new Set(activatedTrailIds);

      for (const trail of trails) {
        const ref = doc(db, `companies/${companyId}/activatedGlobalTrails`, trail.id);
        if (allActive) {
          // Desativa todas
          batch.delete(ref);
          newActivatedIds.delete(trail.id);
        } else {
          // Ativa todas (incluindo as que ja estao ativas — setDoc e idempotente)
          batch.set(ref, {
            trailId: trail.id, sessionId: session.id, titulo: trail.titulo,
            ativadaEm: Timestamp.now(), ativadaPor: user.uid,
          });
          newActivatedIds.add(trail.id);
        }
      }

      await batch.commit();
      setActivatedTrailIds(newActivatedIds);
      if (!allActive) completeOnboardingItem(user?.uid, 'activate-trails');
      toast({ title: allActive ? t.adminTrails.toastTrailDeactivated : t.adminTrails.toastTrailActivated });
    } catch (err) {
      console.error('Erro no bulk toggle de sessao global:', err);
      toast({ variant: 'destructive', title: t.adminTrails.toastTrailToggleError, description: err instanceof Error ? err.message : '' });
    } finally {
      setTogglingSessionBulk(null);
    }
  };

  // ============================================================
  // DELETE: excluir sessao da empresa (cascade — apaga trilhas dentro)
  // ============================================================
  const deleteCompanySession = async (session: Sessao) => {
    if (!companyId) return;
    setDeletingSession(true);
    try {
      const trailsSnap = await getDocs(collection(db, `companies/${companyId}/sessions/${session.id}/trails`));
      const batch = writeBatch(db);
      trailsSnap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(doc(db, `companies/${companyId}/sessions`, session.id));
      await batch.commit();
      toast({ title: 'Sessao excluida com sucesso' });
      setDeleteSessionTarget(null);
      loadCompanyData();
    } catch (err) {
      console.error('Erro ao excluir sessao da empresa:', err);
      toast({ variant: 'destructive', title: 'Erro ao excluir sessao', description: err instanceof Error ? err.message : '' });
    } finally {
      setDeletingSession(false);
    }
  };

  // ============================================================
  // BUILDER VIEW
  // ============================================================
  if (builderOpen) {
    return (
      <TrailBuilder
        session={selectedSession}
        isEditing={!!editingTrail}
        trailForm={trailForm}
        onTrailFormChange={setTrailForm}
        modulos={modulos}
        onModulosChange={setModulos}
        saving={saving}
        onSave={saveCompanyTrail}
        onBack={() => setBuilderOpen(false)}
        onImageUpload={handleImageUpload}
      />
    );
  }

  // ============================================================
  // MAIN VIEW (Tabs: Global + Custom)
  // ============================================================
  return (
    <>
      <Header title={t.adminTrails.title} />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="global" className="flex items-center gap-2">
              <Globe className="w-4 h-4" /> {t.adminTrails.globalTrails}
            </TabsTrigger>
            <TabsTrigger value="custom" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" /> {t.adminTrails.companyTrails}
            </TabsTrigger>
          </TabsList>

          {/* TAB: Global Trails */}
          <TabsContent value="global" className="space-y-4 mt-4">
            {globalSessions.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Globe className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">{t.adminTrails.noGlobalTrails}</p>
                  <p className="text-muted-foreground">{t.adminTrails.noGlobalTrailsDescription}</p>
                </CardContent>
              </Card>
            ) : (
              globalSessions.map(session => {
                const trails = globalTrailsBySession[session.id] || [];
                const isExpanded = expandedGlobalSessions.has(session.id);
                const activeCount = trails.filter(t => activatedTrailIds.has(t.id)).length;
                const total = trails.length;
                const allActive = total > 0 && activeCount === total;
                const someActive = activeCount > 0 && activeCount < total;
                const isBulkToggling = togglingSessionBulk === session.id;

                return (
                  <Card key={session.id} className="overflow-hidden">
                    {/* Header: clicavel pra expandir + toggle bulk + contador */}
                    <div className="flex items-center justify-between p-4">
                      <div
                        className="flex items-center gap-3 flex-1 cursor-pointer min-w-0"
                        onClick={() => toggleGlobalSessionExpanded(session.id)}
                      >
                        <FolderOpen className="w-5 h-5 text-purple-500 shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold">{session.titulo}</h3>
                            {someActive && (
                              <Badge variant="outline" className="text-xs">{activeCount} de {total} ativas</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{session.descricao}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {total > 0 && (
                          <div className="flex items-center gap-2">
                            {isBulkToggling ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Switch
                                checked={allActive}
                                onCheckedChange={() => toggleAllTrailsInGlobalSession(session)}
                                aria-label={allActive ? 'Desativar todas as trilhas' : 'Ativar todas as trilhas'}
                              />
                            )}
                            <span className="text-xs text-muted-foreground w-20">
                              {allActive ? t.adminTrails.sessionActive : t.adminTrails.sessionInactive}
                            </span>
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleGlobalSessionExpanded(session.id)}
                          aria-label={isExpanded ? 'Colapsar' : 'Expandir'}
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    {/* Conteudo expandido: trilhas individuais */}
                    {isExpanded && (
                      <div className="border-t bg-muted/30 px-4 py-3">
                        {trails.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-4 text-center">{t.adminTrails.noTrailsInSession}</p>
                        ) : (
                          <div className="space-y-2">
                            {trails.map(trail => (
                              <TrailCard
                                key={trail.id}
                                trail={trail}
                                isActive={activatedTrailIds.has(trail.id)}
                                isToggling={togglingTrail === trail.id}
                                onToggle={() => toggleGlobalTrail(trail, session.id)}
                                onAnalytics={() => openAnalytics(trail)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* TAB: Custom Company Trails */}
          <TabsContent value="custom" className="space-y-4 mt-4">
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setSessionForm({ titulo: '', descricao: '' }); setSessionDialogOpen(true); }}>
                <FolderOpen className="w-4 h-4 mr-2" /> {t.adminTrails.newSession}
              </Button>
            </div>

            {companySessions.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">{t.adminTrails.noCustomSessions}</p>
                  <p className="text-muted-foreground mb-4">{t.adminTrails.noCustomSessionsDescription}</p>
                  <Button variant="outline" onClick={() => { setSessionForm({ titulo: '', descricao: '' }); setSessionDialogOpen(true); }}>
                    <Plus className="w-4 h-4 mr-2" /> {t.adminTrails.createSession}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              companySessions.map(session => {
                const sessionTrails = companyTrailsBySession[session.id] || [];
                const isSessionToggling = togglingSession === session.id;
                const isExpanded = expandedCompanySessions.has(session.id);
                return (
                <Card key={session.id} className="overflow-hidden">
                  {/* Header: clicavel pra expandir + acoes da sessao */}
                  <div className="flex items-center justify-between p-4">
                    <div
                      className="flex items-center gap-3 flex-1 cursor-pointer min-w-0"
                      onClick={() => toggleCompanySessionExpanded(session.id)}
                    >
                      <FolderOpen className="w-5 h-5 text-purple-500 shrink-0" />
                      <div className="min-w-0">
                        <h3 className="font-semibold">{session.titulo}</h3>
                        <p className="text-sm text-muted-foreground truncate">{session.descricao}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-2">
                        {isSessionToggling ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                          <Switch checked={session.ativa} onCheckedChange={() => toggleCompanySessionActive(session)} />
                        )}
                        <span className="text-xs text-muted-foreground w-16">{session.ativa ? t.adminTrails.sessionActive : t.adminTrails.sessionInactive}</span>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => {
                        setEditingCompanySession(session);
                        setEditSessionForm({ titulo: session.titulo, descricao: session.descricao });
                        setEditSessionDialogOpen(true);
                      }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteSessionTarget(session)} aria-label="Excluir sessao">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleCompanySessionExpanded(session.id)}
                        aria-label={isExpanded ? 'Colapsar' : 'Expandir'}
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Conteudo expandido: trilhas + botao Nova Trilha */}
                  {isExpanded && (
                    <div className="border-t bg-muted/30 px-4 py-3 space-y-3">
                      <div className="flex justify-end">
                        <Button size="sm" onClick={() => openBuilder(session)} className="bg-purple-600 hover:bg-purple-700">
                          <Plus className="w-4 h-4 mr-2" /> {t.adminTrails.newTrail}
                        </Button>
                      </div>
                      {sessionTrails.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">{t.adminTrails.noTrailsInSessionCreate}</p>
                      ) : (
                        <div className="space-y-2">
                          {sessionTrails.map(trail => (
                            <TrailCard
                              key={trail.id}
                              trail={trail}
                              onEdit={() => openBuilder(session, trail)}
                              onDelete={() => setDeleteTrailTarget({ trailId: trail.id, sessionId: session.id })}
                              onAnalytics={() => openAnalytics(trail)}
                              onToggle={() => toggleCompanyTrailActive(trail, session.id)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
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
          <DialogHeader><DialogTitle>{t.adminTrails.newSessionTitle}</DialogTitle><DialogDescription>{t.adminTrails.newSessionDescription}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t.adminTrails.titleLabel}</Label><Input value={sessionForm.titulo} onChange={e => setSessionForm({ ...sessionForm, titulo: e.target.value })} /></div>
            <div><Label>{t.adminTrails.descriptionLabel}</Label><Textarea value={sessionForm.descricao} onChange={e => setSessionForm({ ...sessionForm, descricao: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSessionDialogOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={saveCompanySession} disabled={saving} className="bg-purple-600 hover:bg-purple-700">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} {t.common.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT SESSION DIALOG */}
      <Dialog open={editSessionDialogOpen} onOpenChange={setEditSessionDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t.adminTrails.editSessionTitle}</DialogTitle><DialogDescription>{t.adminTrails.editSessionDescription}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t.adminTrails.titleLabel}</Label><Input value={editSessionForm.titulo} onChange={e => setEditSessionForm({ ...editSessionForm, titulo: e.target.value })} /></div>
            <div><Label>{t.adminTrails.descriptionLabel}</Label><Textarea value={editSessionForm.descricao} onChange={e => setEditSessionForm({ ...editSessionForm, descricao: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSessionDialogOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={updateCompanySession} disabled={saving} className="bg-purple-600 hover:bg-purple-700">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} {t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ANALYTICS DIALOG */}
      <AnalyticsDialog open={analyticsOpen} onOpenChange={setAnalyticsOpen} analytics={analyticsTrail} />

      {/* Suggest new trails */}
      <div className="flex justify-center pt-4 pb-2">
        <SuggestTrailDialog pagina="Trilhas Admin" />
      </div>

      {/* DELETE SESSION CONFIRMATION */}
      <Dialog open={!!deleteSessionTarget} onOpenChange={(open) => { if (!open) setDeleteSessionTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir sessao</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a sessao &quot;{deleteSessionTarget?.titulo}&quot;? Todas as trilhas dentro dela tambem serao excluidas. Esta acao nao pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteSessionTarget(null)} disabled={deletingSession}>{t.common.cancel || 'Cancelar'}</Button>
            <Button variant="destructive" onClick={() => deleteSessionTarget && deleteCompanySession(deleteSessionTarget)} disabled={deletingSession}>
              {deletingSession ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              {t.common.delete || 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE TRAIL CONFIRMATION */}
      <Dialog open={!!deleteTrailTarget} onOpenChange={(open) => { if (!open) setDeleteTrailTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{'Excluir trilha'}</DialogTitle>
            <DialogDescription>{t.adminTrails.deleteTrailConfirm}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTrailTarget(null)}>{t.common.cancel || 'Cancelar'}</Button>
            <Button variant="destructive" onClick={async () => {
              if (!companyId || !deleteTrailTarget) return;
              try {
                await deleteDoc(doc(db, `companies/${companyId}/sessions/${deleteTrailTarget.sessionId}/trails`, deleteTrailTarget.trailId));
                loadCompanyData();
                toast({ title: t.adminTrails.toastTrailDeleted });
              } catch (err) {
                toast({ variant: 'destructive', title: t.adminTrails.toastTrailDeleteError, description: err instanceof Error ? err.message : '' });
              }
              setDeleteTrailTarget(null);
            }}>{t.common.delete || 'Excluir'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </main>
    </>
  );
}
