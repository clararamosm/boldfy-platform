'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Zap } from 'lucide-react';
import { SimpleRichEditor } from '@/components/ui/simple-rich-editor';
import type { Modulo, ModuloModo, QuestaoDesafio } from '@/types/trilhas';
import { MODO_LABELS, MODO_CONFIG } from '@/types/trilhas';

// ─── Types ────────────────────────────────────────────────────

export type ModuloFormData = Partial<Modulo>;

export type ModuloDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingIndex: number | null;
  form: ModuloFormData;
  onFormChange: (form: ModuloFormData) => void;
  questoes: QuestaoDesafio[];
  onQuestoesChange: (questoes: QuestaoDesafio[]) => void;
  onSave: () => void;
};

// ─── Component ────────────────────────────────────────────────

export function ModuloDialog({
  open, onOpenChange, editingIndex,
  form, onFormChange, questoes, onQuestoesChange, onSave,
}: ModuloDialogProps) {
  const modo = form.modo as ModuloModo;

  const addQuestao = () => {
    onQuestoesChange([...questoes, { pergunta: '', opcoes: ['', '', '', ''], respostaCorreta: 0 }]);
  };

  const updateQuestao = (qi: number, field: string, val: unknown) => {
    const u = [...questoes];
    if (field === 'pergunta') u[qi].pergunta = val as string;
    else if (field === 'respostaCorreta') u[qi].respostaCorreta = val as number;
    onQuestoesChange(u);
  };

  const updateOpcao = (qi: number, oi: number, val: string) => {
    const u = [...questoes];
    u[qi].opcoes[oi] = val;
    onQuestoesChange(u);
  };

  const removeQuestao = (qi: number) => {
    onQuestoesChange(questoes.filter((_, i) => i !== qi));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingIndex !== null ? 'Editar Modulo' : 'Novo Modulo'}</DialogTitle>
          <DialogDescription>Configure o modulo de aprendizagem</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Titulo do Modulo</Label>
            <Input value={form.titulo} onChange={e => onFormChange({ ...form, titulo: e.target.value })} placeholder="Ex: Introducao ao LinkedIn" />
          </div>
          <div>
            <Label>Modo</Label>
            <Select value={form.modo} onValueChange={(v: ModuloModo) => {
              onFormChange({
                ...form, modo: v,
                pontuacaoBase: MODO_CONFIG[v].pontosPadrao,
                pontuacaoBonus: MODO_CONFIG[v].pontosBonus,
              });
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(MODO_LABELS) as ModuloModo[]).map(m => (
                  <SelectItem key={m} value={m}>{MODO_LABELS[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* MODO: AULA */}
          {modo === 'aula' && (
            <>
              <div>
                <Label>URL do Video (YouTube)</Label>
                <Input value={form.videoUrl || ''} onChange={e => onFormChange({ ...form, videoUrl: e.target.value })} placeholder="Cole o link do YouTube aqui" />
                <p className="text-xs text-muted-foreground mt-1">O colaborador precisa assistir 80% para completar</p>
              </div>
              <div>
                <Label>Material de Apoio (PDF)</Label>
                <Input placeholder="Cole o link do PDF aqui (Google Drive, Dropbox, etc.)" value={form.materialPdfUrl || ''} onChange={e => onFormChange({ ...form, materialPdfUrl: e.target.value })} />
              </div>
            </>
          )}

          {/* MODO: LEITURA */}
          {modo === 'leitura' && (
            <div>
              <Label>Conteudo</Label>
              <SimpleRichEditor
                value={form.conteudoHtml || ''}
                onChange={(html) => onFormChange({ ...form, conteudoHtml: html })}
                placeholder="Escreva o conteudo da leitura aqui..."
              />
            </div>
          )}

          {/* MODO: DESAFIO */}
          {modo === 'desafio' && (
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
                    {q.opcoes.map((o, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <input type="radio" name={`q${qi}`} checked={q.respostaCorreta === oi} onChange={() => updateQuestao(qi, 'respostaCorreta', oi)} />
                        <Input value={o} onChange={e => updateOpcao(qi, oi, e.target.value)} placeholder={`Opcao ${oi + 1}`} className="flex-1" />
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* MODO: FACA VOCE MESMO */}
          {modo === 'faca_voce_mesmo' && (
            <div>
              <Label>Instrucoes do Card</Label>
              <Textarea value={form.instrucaoCard || ''} onChange={e => onFormChange({ ...form, instrucaoCard: e.target.value })} placeholder="Descreva a atividade pratica..." rows={6} />
              <p className="text-xs text-muted-foreground mt-1">Sem pontuacao - o colaborador marca como visualizado</p>
            </div>
          )}

          {/* MODO: MISSAO CONTEUDO */}
          {modo === 'missao_conteudo' && (
            <div className="space-y-4">
              <div>
                <Label>Instrucoes da Missao</Label>
                <Textarea value={form.instrucaoCard || ''} onChange={e => onFormChange({ ...form, instrucaoCard: e.target.value })} placeholder="Descreva o que o colaborador deve postar..." rows={4} />
              </div>
              <p className="text-xs text-muted-foreground">Sem pontuacao direta - cria uma missao na aba Missoes ao desbloquear</p>
            </div>
          )}

          {/* PONTUACAO */}
          {MODO_CONFIG[modo]?.temPontuacao && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center gap-1"><Zap className="w-4 h-4 text-yellow-500" />Pontuacao Base</Label>
                <Input type="number" value={form.pontuacaoBase} onChange={e => onFormChange({ ...form, pontuacaoBase: parseInt(e.target.value) || 0 })} />
              </div>
              {modo === 'desafio' && (
                <div>
                  <Label className="flex items-center gap-1"><Zap className="w-4 h-4 text-yellow-500" />Pontuacao Bonus</Label>
                  <Input type="number" value={form.pontuacaoBonus} onChange={e => onFormChange({ ...form, pontuacaoBonus: parseInt(e.target.value) || 0 })} />
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave} className="bg-purple-600 hover:bg-purple-700">
            {editingIndex !== null ? 'Salvar' : 'Adicionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
