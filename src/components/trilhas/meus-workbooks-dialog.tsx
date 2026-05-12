// src/components/trilhas/meus-workbooks-dialog.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FIRESTORE_PATHS, type WorkbookResponse } from '@/types/trilhas';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpenCheck, CheckCircle2, Clock, Loader2, ExternalLink, FileText, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { isBrandImportTrail, BRAND_IMPORT_URL } from '@/lib/trilhas/brand-import';

type Props = {
  userId: string;
};

export function MeusWorkbooksDialog({ userId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [workbooks, setWorkbooks] = useState<(WorkbookResponse & { docId: string })[]>([]);

  const loadWorkbooks = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const colRef = collection(db, FIRESTORE_PATHS.userWorkbooks(userId));
      const q = query(colRef, orderBy('atualizadoEm', 'desc'));
      const snap = await getDocs(q);
      const items = snap.docs.map(d => ({
        docId: d.id,
        ...(d.data() as WorkbookResponse),
      }));
      setWorkbooks(items);
    } catch (err) {
      console.error('Error loading workbooks:', err);
    }
    setLoading(false);
  }, [userId]);

  // Load when dialog opens
  useEffect(() => {
    if (open) loadWorkbooks();
  }, [open, loadWorkbooks]);

  const handleOpen = (trailId: string) => {
    setOpen(false);
    router.push(`/colaborador/trilhas/${trailId}`);
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp?.toDate) return '';
    const date = timestamp.toDate();
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const countResponses = (respostas: Record<string, string | string[]>) => {
    if (!respostas) return 0;
    return Object.values(respostas).filter(v => {
      if (Array.isArray(v)) return v.some(item => item.trim().length > 0);
      return typeof v === 'string' && v.trim().length > 0;
    }).length;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <BookOpenCheck className="h-4 w-4" />
          Meus Workbooks
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpenCheck className="h-5 w-5 text-purple-600" />
            Meus Workbooks
          </DialogTitle>
          <DialogDescription>
            Seus exercicios interativos salvos. Clique para continuar preenchendo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Carregando...
            </div>
          ) : workbooks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">Nenhum workbook encontrado</p>
              <p className="text-xs mt-1">Complete exercicios interativos nas trilhas para vê-los aqui.</p>
            </div>
          ) : (
            <div className="space-y-3 pb-2">
              {workbooks.map((wb) => {
                const filledCount = countResponses(wb.respostas);
                const canImportToBrand = isBrandImportTrail(wb.trailTitle) && filledCount > 0;
                // div+role="button" (em vez de <button>) pra permitir <button>
                // aninhado pro CTA de Marca Pessoal sem HTML invalido.
                return (
                  <div
                    key={wb.docId}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleOpen(wb.trailId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpen(wb.trailId);
                      }
                    }}
                    className="w-full text-left p-4 rounded-xl border border-border hover:border-purple-300 hover:bg-purple-50/30 transition-all group cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{wb.moduleTitle}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{wb.trailTitle}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {wb.concluido ? (
                          <Badge className="bg-green-100 text-green-800 text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Concluido
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-purple-700 border-purple-300 text-xs">
                            <Clock className="h-3 w-3 mr-1" /> Em andamento
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2.5">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{filledCount} campo{filledCount !== 1 ? 's' : ''} preenchido{filledCount !== 1 ? 's' : ''}</span>
                        {wb.atualizadoEm && (
                          <span>{formatDate(wb.atualizadoEm)}</span>
                        )}
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* CTA "Aplicar a Marca Pessoal" — so quando esse workbook
                        e de trilha de Marca Pessoal E ja tem campo preenchido.
                        stopPropagation pra nao abrir a trilha junto. */}
                    {canImportToBrand && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3 w-full gap-1.5 border-purple-300 text-purple-700 hover:bg-purple-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(false);
                          router.push(BRAND_IMPORT_URL);
                        }}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Aplicar a Marca Pessoal
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
