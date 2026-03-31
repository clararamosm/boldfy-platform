// src/app/admin/trilhas/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, getDoc, Timestamp } from 'firebase/firestore';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, GripVertical, BookOpen, Video, HelpCircle, Loader2, Pencil, ChevronDown, ChevronUp } from 'lucide-react';

// ---- Types ----
type PhaseType = 'texto' | 'video' | 'quiz';

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
}

interface Phase {
  id?: string;
  title: string;
  type: PhaseType;
  content: string; // URL for video, text content for texto, ignored for quiz
  quiz?: QuizQuestion[];
  order: number;
}

interface Trail {
  id: string;
  title: string;
  description: string;
  phases: Phase[];
  pointsReward: number;
  active: boolean;
  order: number;
  createdAt: any;
}

// ---- Component ----
export default function AdminTrilhasPage() {
  const [trails, setTrails] = useState<Trail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTrail, setEditingTrail] = useState<Trail | null>(null);
  const [expandedTrail, setExpandedTrail] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPoints, setFormPoints] = useState(100);
  const [formActive, setFormActive] = useState(true);
  const [formPhases, setFormPhases] = useState<Phase[]>([]);

  const { toast } = useToast();

  // ---- Auth + Load ----
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user: User | null) => {
      if (!user) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        if (userData?.companyId) {
          setCompanyId(userData.companyId);
        }
      } catch (err) {
        console.error('Error loading user:', err);
      }
    });
    return () => unsub();
  }, []);

  const loadTrails = useCallback(async () => {
    if (!companyId) return;
    setIsLoading(true);
    try {
      const trailsRef = collection(db, 'companies', companyId, 'trails');
      const snapshot = await getDocs(trailsRef);
      const data = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        phases: d.data().phases || [],
      })) as Trail[];
      data.sort((a, b) => (a.order || 0) - (b.order || 0));
      setTrails(data);
    } catch (err) {
      console.error('Error loading trails:', err);
      toast({ title: 'Erro', description: 'Erro ao carregar trilhas', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [companyId, toast]);

  useEffect(() => {
    if (companyId) loadTrails();
  }, [companyId, loadTrails]);

  // ---- Form helpers ----
  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormPoints(100);
    setFormActive(true);
    setFormPhases([]);
    setEditingTrail(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (trail: Trail) => {
    setEditingTrail(trail);
    setFormTitle(trail.title);
    setFormDescription(trail.description);
    setFormPoints(trail.pointsReward);
    setFormActive(trail.active);
    setFormPhases(trail.phases.map((p, i) => ({ ...p, order: i })));
    setIsDialogOpen(true);
  };

  // ---- Phase management ----
  const addPhase = (type: PhaseType) => {
    const newPhase: Phase = {
      title: '',
      type,
      content: '',
      order: formPhases.length,
      ...(type === 'quiz' ? { quiz: [{ question: '', options: ['', '', '', ''], correctAnswer: 0 }] } : {}),
    };
    setFormPhases([...formPhases, newPhase]);
  };

  const updatePhase = (index: number, field: string, value: any) => {
    const updated = [...formPhases];
    (updated[index] as any)[field] = value;
    setFormPhases(updated);
  };

  const removePhase = (index: number) => {
    setFormPhases(formPhases.filter((_, i) => i !== index));
  };

  // Quiz question management
  const addQuizQuestion = (phaseIndex: number) => {
    const updated = [...formPhases];
    if (!updated[phaseIndex].quiz) updated[phaseIndex].quiz = [];
    updated[phaseIndex].quiz!.push({ question: '', options: ['', '', '', ''], correctAnswer: 0 });
    setFormPhases(updated);
  };

  const updateQuizQuestion = (phaseIndex: number, qIndex: number, field: string, value: any) => {
    const updated = [...formPhases];
    (updated[phaseIndex].quiz![qIndex] as any)[field] = value;
    setFormPhases(updated);
  };

  const updateQuizOption = (phaseIndex: number, qIndex: number, optIndex: number, value: string) => {
    const updated = [...formPhases];
    updated[phaseIndex].quiz![qIndex].options[optIndex] = value;
    setFormPhases(updated);
  };

  const removeQuizQuestion = (phaseIndex: number, qIndex: number) => {
    const updated = [...formPhases];
    updated[phaseIndex].quiz = updated[phaseIndex].quiz!.filter((_, i) => i !== qIndex);
    setFormPhases(updated);
  };

  // ---- CRUD ----
  const handleSave = async () => {
    if (!companyId || !formTitle.trim()) {
      toast({ title: 'Erro', description: 'Preencha o titulo da trilha', variant: 'destructive' });
      return;
    }
    if (formPhases.length === 0) {
      toast({ title: 'Erro', description: 'Adicione pelo menos uma fase', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const trailData = {
        title: formTitle.trim(),
        description: formDescription.trim(),
        phases: formPhases.map((p, i) => ({
          title: p.title,
          type: p.type,
          content: p.content,
          order: i,
          ...(p.type === 'quiz' ? { quiz: p.quiz } : {}),
        })),
        pointsReward: formPoints,
        active: formActive,
        order: editingTrail ? editingTrail.order : trails.length,
      };

      if (editingTrail) {
        await updateDoc(doc(db, 'companies', companyId, 'trails', editingTrail.id), trailData);
        toast({ title: 'Sucesso', description: 'Trilha atualizada!' });
      } else {
        await addDoc(collection(db, 'companies', companyId, 'trails'), {
          ...trailData,
          createdAt: Timestamp.now(),
        });
        toast({ title: 'Sucesso', description: 'Trilha criada!' });
      }

      setIsDialogOpen(false);
      resetForm();
      loadTrails();
    } catch (err) {
      console.error('Error saving trail:', err);
      toast({ title: 'Erro', description: 'Erro ao salvar trilha', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (trailId: string) => {
    if (!companyId) return;
    try {
      await deleteDoc(doc(db, 'companies', companyId, 'trails', trailId));
      toast({ title: 'Sucesso', description: 'Trilha excluida!' });
      loadTrails();
    } catch (err) {
      console.error('Error deleting trail:', err);
      toast({ title: 'Erro', description: 'Erro ao excluir trilha', variant: 'destructive' });
    }
  };

  const toggleActive = async (trail: Trail) => {
    if (!companyId) return;
    try {
      await updateDoc(doc(db, 'companies', companyId, 'trails', trail.id), { active: !trail.active });
      loadTrails();
    } catch (err) {
      console.error('Error toggling trail:', err);
    }
  };

  // ---- Phase type icon ----
  const phaseIcon = (type: PhaseType) => {
    switch (type) {
      case 'texto': return <BookOpen className="h-4 w-4" />;
      case 'video': return <Video className="h-4 w-4" />;
      case 'quiz': return <HelpCircle className="h-4 w-4" />;
    }
  };

  // ---- Render ----
  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Header title="Trilhas de Aprendizado" subtitle="Gerencie as trilhas de capacitacao da sua equipe" />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <Header title="Trilhas de Aprendizado" subtitle="Gerencie as trilhas de capacitacao da sua equipe" />
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Trilha
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de Trilhas</CardDescription>
            <CardTitle className="text-2xl">{trails.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Trilhas Ativas</CardDescription>
            <CardTitle className="text-2xl">{trails.filter(t => t.active).length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de Fases</CardDescription>
            <CardTitle className="text-2xl">{trails.reduce((acc, t) => acc + (t.phases?.length || 0), 0)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Trails list */}
      <Card>
        <CardHeader>
          <CardTitle>Trilhas</CardTitle>
          <CardDescription>Clique em uma trilha para ver suas fases</CardDescription>
        </CardHeader>
        <CardContent>
          {trails.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma trilha criada ainda.</p>
              <p className="text-sm">Clique em &quot;Nova Trilha&quot; para comecar.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {trails.map((trail) => (
                <div key={trail.id} className="border rounded-lg">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
                    onClick={() => setExpandedTrail(expandedTrail === trail.id ? null : trail.id)}
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{trail.title}</p>
                        <p className="text-sm text-muted-foreground">{trail.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={trail.active ? "default" : "secondary"}>
                        {trail.active ? 'Ativa' : 'Inativa'}
                      </Badge>
                      <Badge variant="outline">{trail.phases?.length || 0} fases</Badge>
                      <Badge variant="outline">{trail.pointsReward} pts</Badge>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEditDialog(trail); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); toggleActive(trail); }}>
                        {trail.active ? 'Desativar' : 'Ativar'}
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(trail.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      {expandedTrail === trail.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>

                  {/* Expanded phases */}
                  {expandedTrail === trail.id && trail.phases && trail.phases.length > 0 && (
                    <div className="border-t px-4 pb-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead>Fase</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Detalhes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {trail.phases.map((phase, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{idx + 1}</TableCell>
                              <TableCell className="font-medium">{phase.title || `Fase ${idx + 1}`}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  {phaseIcon(phase.type)}
                                  <span className="capitalize">{phase.type}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {phase.type === 'quiz' && phase.quiz ? `${phase.quiz.length} pergunta(s)` : ''}
                                {phase.type === 'video' ? phase.content?.substring(0, 50) : ''}
                                {phase.type === 'texto' ? `${(phase.content || '').length} caracteres` : ''}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) { setIsDialogOpen(false); resetForm(); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTrail ? 'Editar Trilha' : 'Nova Trilha'}</DialogTitle>
            <DialogDescription>{editingTrail ? 'Edite os dados da trilha' : 'Crie uma nova trilha de aprendizado'}</DialogDescription>
          </DialogHeader>
        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
          {/* Basic info */}
          <div className="space-y-4">
            <div>
              <Label>Titulo da Trilha *</Label>
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Ex: Onboarding Comercial" />
            </div>
            <div>
              <Label>Descricao</Label>
              <Input value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Descricao breve da trilha" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Pontos ao Completar</Label>
                <Input type="number" value={formPoints} onChange={(e) => setFormPoints(Number(e.target.value))} min={0} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={formActive ? 'true' : 'false'} onValueChange={(v) => setFormActive(v === 'true')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Ativa</SelectItem>
                    <SelectItem value="false">Inativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Phases */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-base font-semibold">Fases da Trilha ({formPhases.length})</Label>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => addPhase('texto')}>
                  <BookOpen className="h-3 w-3 mr-1" /> Texto
                </Button>
                <Button size="sm" variant="outline" onClick={() => addPhase('video')}>
                  <Video className="h-3 w-3 mr-1" /> Video
                </Button>
                <Button size="sm" variant="outline" onClick={() => addPhase('quiz')}>
                  <HelpCircle className="h-3 w-3 mr-1" /> Quiz
                </Button>
              </div>
            </div>

            {formPhases.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Adicione fases clicando nos botoes acima
              </p>
            )}

            <div className="space-y-4">
              {formPhases.map((phase, pIdx) => (
                <Card key={pIdx} className="border-l-4 border-l-primary">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {phaseIcon(phase.type)}
                        <span className="text-sm font-medium capitalize">Fase {pIdx + 1} - {phase.type}</span>
                      </div>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removePhase(pIdx)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label>Titulo da Fase</Label>
                      <Input value={phase.title} onChange={(e) => updatePhase(pIdx, 'title', e.target.value)} placeholder="Ex: Introducao ao produto" />
                    </div>

                    {phase.type === 'texto' && (
                      <div>
                        <Label>Conteudo</Label>
                        <Textarea
                          className="min-h-[100px]"
                          value={phase.content}
                          onChange={(e) => updatePhase(pIdx, 'content', e.target.value)}
                          placeholder="Digite o conteudo da fase..."
                        />
                      </div>
                    )}

                    {phase.type === 'video' && (
                      <div>
                        <Label>URL do Video</Label>
                        <Input value={phase.content} onChange={(e) => updatePhase(pIdx, 'content', e.target.value)} placeholder="https://youtube.com/watch?v=..." />
                      </div>
                    )}

                    {phase.type === 'quiz' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label>Perguntas ({phase.quiz?.length || 0})</Label>
                          <Button size="sm" variant="outline" onClick={() => addQuizQuestion(pIdx)}>
                            <Plus className="h-3 w-3 mr-1" /> Pergunta
                          </Button>
                        </div>

                        {phase.quiz?.map((q, qIdx) => (
                          <Card key={qIdx} className="bg-muted/30">
                            <CardContent className="pt-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <Label>Pergunta {qIdx + 1}</Label>
                                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeQuizQuestion(pIdx, qIdx)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                              <Input
                                value={q.question}
                                onChange={(e) => updateQuizQuestion(pIdx, qIdx, 'question', e.target.value)}
                                placeholder="Digite a pergunta..."
                              />
                              <div className="space-y-2">
                                {q.options.map((opt, oIdx) => (
                                  <div key={oIdx} className="flex items-center gap-2">
                                    <input
                                      type="radio"
                                      name={`q-${pIdx}-${qIdx}`}
                                      checked={q.correctAnswer === oIdx}
                                      onChange={() => updateQuizQuestion(pIdx, qIdx, 'correctAnswer', oIdx)}
                                      className="h-4 w-4"
                                    />
                                    <Input
                                      value={opt}
                                      onChange={(e) => updateQuizOption(pIdx, qIdx, oIdx, e.target.value)}
                                      placeholder={`Opcao ${oIdx + 1}`}
                                      className="flex-1"
                                    />
                                  </div>
                                ))}
                              </div>
                              <p className="text-xs text-muted-foreground">Selecione o radio da resposta correta</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Save button */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingTrail ? 'Salvar Alteracoes' : 'Criar Trilha'}
            </Button>
          </div>
        </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
