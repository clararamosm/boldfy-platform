'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import type { TrilhaAnalytics } from '@/types/trilhas';

export type AnalyticsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analytics: TrilhaAnalytics | null;
  /** Show the taxa de conclusao progress bar (master view has it, admin does not) */
  showTaxaConclusao?: boolean;
};

export function AnalyticsDialog({ open, onOpenChange, analytics, showTaxaConclusao = false }: AnalyticsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Analytics: {analytics?.titulo}</DialogTitle>
          <DialogDescription>Metricas de engajamento desta trilha</DialogDescription>
        </DialogHeader>
        {analytics && (
          <div className="grid grid-cols-2 gap-4">
            <Card><CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{analytics.totalInscritos}</p>
              <p className="text-xs text-muted-foreground">Total Disponiveis</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">{analytics.emProgresso}</p>
              <p className="text-xs text-muted-foreground">Em Progresso</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-green-600">{analytics.concluidos}</p>
              <p className="text-xs text-muted-foreground">Concluidos</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-gray-500">{analytics.naoIniciados}</p>
              <p className="text-xs text-muted-foreground">Nao Iniciados</p>
            </CardContent></Card>
            <Card className="col-span-2"><CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-purple-600">{analytics.pontuacaoMedia.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">Pontuacao Media</p>
            </CardContent></Card>
            {showTaxaConclusao && (
              <Card className="col-span-2"><CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">Taxa de Conclusao</span>
                  <span className="text-sm font-bold">{analytics.taxaConclusao.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-purple-600 h-2 rounded-full" style={{ width: `${analytics.taxaConclusao}%` }} />
                </div>
              </CardContent></Card>
            )}
          </div>
        )}
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
