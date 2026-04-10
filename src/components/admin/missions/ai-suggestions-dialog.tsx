// src/components/admin/missions/ai-suggestions-dialog.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { ActionDialog } from '@/components/dashboard/action-dialog';
import { Loader2, CheckCircle2, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { AISuggestion } from './use-admin-missions';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  aiLoading: boolean;
  suggestions: AISuggestion[];
  onToggle: (index: number) => void;
  onUpdateDate: (index: number, field: 'startDate' | 'endDate', date: Date | undefined) => void;
  onUpdateField: (index: number, field: string, value: any) => void;
  onSave: () => void;
};

export function AISuggestionsDialog({
  open, onOpenChange, isSubmitting, aiLoading,
  suggestions, onToggle, onUpdateDate, onUpdateField, onSave,
}: Props) {
  const selectedCount = suggestions.filter(s => s.selected).length;

  return (
    <ActionDialog
      title="Gerar Missoes com IA"
      description="A IA analisa o contexto da sua empresa e sugere missoes. Selecione, configure o tipo e modo, e defina datas se necessario."
      open={open}
      onOpenChange={(o) => { onOpenChange(o); }}
      actionText={isSubmitting ? 'Salvando...' : `Criar ${selectedCount} missao(oes)`}
      onAction={onSave}
      showCancel
    >
      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
        {aiLoading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analisando o contexto da empresa e gerando sugestoes...</p>
          </div>
        ) : suggestions.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhuma sugestao gerada. Tente novamente.</p>
        ) : (
          suggestions.map((suggestion, index) => (
            <Card
              key={index}
              className={`cursor-pointer transition-colors ${suggestion.selected ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/30'}`}
              onClick={() => onToggle(index)}
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
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs whitespace-nowrap">Temporaria</Label>
                        <Switch checked={suggestion.type === 'timed'} onCheckedChange={(v) => onUpdateField(index, 'type', v ? 'timed' : 'fixed')} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs whitespace-nowrap">Comprovacao</Label>
                        <Switch checked={suggestion.completionMode === 'proof'} onCheckedChange={(v) => onUpdateField(index, 'completionMode', v ? 'proof' : 'auto')} />
                      </div>
                    </div>
                    {suggestion.type === 'timed' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Inicio</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal h-8 text-xs">
                                <CalendarIcon className="mr-1.5 h-3 w-3" />
                                {suggestion.startDate ? format(suggestion.startDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar mode="single" selected={suggestion.startDate} onSelect={(d) => onUpdateDate(index, 'startDate', d)} locale={ptBR} initialFocus />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Termino</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal h-8 text-xs">
                                <CalendarIcon className="mr-1.5 h-3 w-3" />
                                {suggestion.endDate ? format(suggestion.endDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar mode="single" selected={suggestion.endDate} onSelect={(d) => onUpdateDate(index, 'endDate', d)} locale={ptBR} initialFocus />
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
  );
}
