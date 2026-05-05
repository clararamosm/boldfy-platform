'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Pencil, Trash2, ChevronDown, GripVertical,
  Play, BookOpen, HelpCircle, Wrench, Target,
  ArrowLeft, Loader2, Save,
} from 'lucide-react';
import { CoinIcon } from '@/components/coin-icon';
import type { Modulo, ModuloModo, QuestaoDesafio, Sessao } from '@/types/trilhas';
import { MODO_LABELS, MODO_CONFIG } from '@/types/trilhas';
import { ModuloDialog, type ModuloFormData } from './modulo-dialog';

// ─── Types ────────────────────────────────────────────────────

const MODO_ICONS: Record<ModuloModo, React.ComponentType<{ className?: string }>> = {
  aula: Play, leitura: BookOpen, desafio: HelpCircle,
  faca_voce_mesmo: Wrench, missao_conteudo: Target,
};

export type TrailFormData = {
  titulo: string;
  descricao: string;
  tempoEstimadoMin: number;
  pontuacaoBonusTrilha: number;
  ordem?: number;
};

export type TrailBuilderProps = {
  session: Sessao | null;
  isEditing: boolean;
  trailForm: TrailFormData;
  onTrailFormChange: (form: TrailFormData) => void;
  modulos: Modulo[];
  onModulosChange: (modulos: Modulo[]) => void;
  saving: boolean;
  onSave: () => void;
  onBack: () => void;
  onImageUpload?: (file: File) => Promise<string>;
};

// ─── Helpers ──────────────────────────────────────────────────

export function calcPontuacao(mods: Modulo[]) {
  let total = 0;
  let bonus = 0;
  mods.forEach(m => {
    const cfg = MODO_CONFIG[m.modo];
    if (cfg && cfg.temPontuacao) {
      total += (m.pontuacaoBase ?? cfg.pontosPadrao);
      bonus += (m.pontuacaoBonus ?? cfg.pontosBonus);
    }
  });
  return { total, bonus };
}

// ─── Component ────────────────────────────────────────────────

export function TrailBuilder({
  session, isEditing, trailForm, onTrailFormChange,
  modulos, onModulosChange, saving, onSave, onBack,
  onImageUpload,
}: TrailBuilderProps) {
  // Modulo dialog state
  const [moduloDialogOpen, setModuloDialogOpen] = useState(false);
  const [editingModuloIdx, setEditingModuloIdx] = useState<number | null>(null);
  const [moduloForm, setModuloForm] = useState<ModuloFormData>({ titulo: '', modo: 'aula' });
  const [questoes, setQuestoes] = useState<QuestaoDesafio[]>([]);

  const { total, bonus } = calcPontuacao(modulos);

  // ── Modulo operations ──
  const moveModulo = (index: number, direction: 'up' | 'down') => {
    const newModulos = [...modulos];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newModulos.length) return;
    [newModulos[index], newModulos[targetIndex]] = [newModulos[targetIndex], newModulos[index]];
    onModulosChange(newModulos);
  };

  const openModuloDialog = (idx?: number) => {
    if (idx !== undefined && modulos[idx]) {
      setEditingModuloIdx(idx);
      const m = modulos[idx];
      setModuloForm({
        titulo: m.titulo, modo: m.modo, videoUrl: m.videoUrl || '',
        conteudoHtml: m.conteudoHtml || '', instrucaoCard: m.instrucaoCard || '',
        pontuacaoBase: m.pontuacaoBase ?? MODO_CONFIG[m.modo].pontosPadrao,
        pontuacaoBonus: m.pontuacaoBonus ?? MODO_CONFIG[m.modo].pontosBonus,
        materialPdfUrl: m.materialPdfUrl,
        missaoRecompensa: m.missaoGatilho?.pontosRecompensa ?? 100,
      });
      setQuestoes(m.questoes || []);
    } else {
      setEditingModuloIdx(null);
      setModuloForm({ titulo: '', modo: 'aula', pontuacaoBase: 80, pontuacaoBonus: 20 });
      setQuestoes([]);
    }
    setModuloDialogOpen(true);
  };

  const saveModulo = () => {
    if (!moduloForm.titulo?.trim()) return;
    const modo = moduloForm.modo as ModuloModo;
    const m: Modulo = {
      id: editingModuloIdx !== null ? modulos[editingModuloIdx].id : `mod_${Date.now()}`,
      titulo: moduloForm.titulo || '',
      modo,
      ordem: editingModuloIdx ?? modulos.length,
      videoUrl: modo === 'aula' ? moduloForm.videoUrl : undefined,
      materialPdfUrl: modo === 'aula' ? moduloForm.materialPdfUrl : undefined,
      conteudoHtml: modo === 'leitura' ? moduloForm.conteudoHtml : undefined,
      questoes: modo === 'desafio' ? questoes : undefined,
      pontuacaoBase: MODO_CONFIG[modo].temPontuacao ? (moduloForm.pontuacaoBase ?? MODO_CONFIG[modo].pontosPadrao) : undefined,
      pontuacaoBonus: MODO_CONFIG[modo].temPontuacao ? (moduloForm.pontuacaoBonus ?? MODO_CONFIG[modo].pontosBonus) : undefined,
      instrucaoCard: (modo === 'faca_voce_mesmo' || modo === 'missao_conteudo') ? moduloForm.instrucaoCard : undefined,
      missaoGatilho: modo === 'missao_conteudo' ? {
        tipo: 'postar_linkedin' as const,
        instrucoes: moduloForm.instrucaoCard || '',
        pontosRecompensa: moduloForm.missaoRecompensa ?? 100,
      } : undefined,
    };
    if (editingModuloIdx !== null) {
      const u = [...modulos];
      u[editingModuloIdx] = m;
      onModulosChange(u);
    } else {
      onModulosChange([...modulos, m]);
    }
    setModuloDialogOpen(false);
  };

  const removeModulo = (index: number) => {
    onModulosChange(modulos.filter((_, i) => i !== index));
  };

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{isEditing ? 'Editar Trilha' : 'Nova Trilha'}</h2>
          <p className="text-muted-foreground">Sessao: {session?.titulo}</p>
        </div>
        <Button onClick={onSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar Trilha
        </Button>
      </div>

      {/* Metadata */}
      <Card>
        <CardHeader><CardTitle>Informacoes da Trilha</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Titulo</Label>
            <Input value={trailForm.titulo} onChange={e => onTrailFormChange({ ...trailForm, titulo: e.target.value })} placeholder="Nome da trilha" />
          </div>
          <div>
            <Label>Descricao</Label>
            <Textarea value={trailForm.descricao} onChange={e => onTrailFormChange({ ...trailForm, descricao: e.target.value })} placeholder="Descreva o objetivo desta trilha..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tempo Estimado (min)</Label>
              <Input type="number" value={trailForm.tempoEstimadoMin} onChange={e => onTrailFormChange({ ...trailForm, tempoEstimadoMin: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <Label className="flex items-center gap-1"><CoinIcon className="w-4 h-4 text-yellow-500" />Pontuacao por Completar</Label>
              <Input type="number" value={trailForm.pontuacaoBonusTrilha || 0} onChange={e => onTrailFormChange({ ...trailForm, pontuacaoBonusTrilha: parseInt(e.target.value) || 0 })} placeholder="Ex: 200" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Score Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-6 text-center">
          <div className="flex items-center justify-center gap-1 mb-1"><CoinIcon className="w-5 h-5 text-yellow-500" /><p className="text-2xl font-bold text-purple-600">{total}</p></div>
          <p className="text-sm text-muted-foreground">Pontuacao Total</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <div className="flex items-center justify-center gap-1 mb-1"><CoinIcon className="w-5 h-5 text-yellow-500" /><p className="text-2xl font-bold text-yellow-600">+{bonus}</p></div>
          <p className="text-sm text-muted-foreground">Bonus Possivel</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className="text-2xl font-bold mb-1">{modulos.length}</p>
          <p className="text-sm text-muted-foreground">Modulos</p>
        </CardContent></Card>
      </div>

      {/* Modulos List */}
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
                    {MODO_CONFIG[m.modo].temPontuacao && (
                      <Badge variant="secondary"><CoinIcon className="w-3 h-3 mr-1 text-yellow-500" />{m.pontuacaoBase || 0} pontos</Badge>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => openModuloDialog(i)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => removeModulo(i)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modulo Dialog */}
      <ModuloDialog
        open={moduloDialogOpen}
        onOpenChange={setModuloDialogOpen}
        editingIndex={editingModuloIdx}
        form={moduloForm}
        onFormChange={setModuloForm}
        questoes={questoes}
        onQuestoesChange={setQuestoes}
        onSave={saveModulo}
        onImageUpload={onImageUpload}
      />
    </div>
  );
}
