'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, Calendar, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAuthToken } from '@/lib/auth-client';
import {
  listLinkedInSnapshots,
  getLinkedInSnapshotBatch,
  deleteLinkedInSnapshot,
} from '@/app/actions/linkedin-analytics';
import type { LinkedInSnapshot } from '@/lib/linkedin-analytics-types';
import { formatMesAno, formatDate } from '@/lib/linkedin-analytics-utils';

// ─── Types ────────────────────────────────────────────────────

interface SnapshotRow {
  mesAno: string;
  uploadedAt: string;
  uploadType: 'monthly' | 'historical';
  totalImpressions: number;
  totalEngagement: number;
}

export interface UploadHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  /** Chamado após deletar um snapshot com sucesso, passando o mês excluído */
  onDeleted?: (mesAno: string) => void;
}

// ─── Component ────────────────────────────────────────────────

export function UploadHistoryModal({
  open,
  onOpenChange,
  userId,
  onDeleted,
}: UploadHistoryModalProps) {
  const [rows, setRows] = useState<SnapshotRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estado do confirm dialog de exclusão
  const [confirmMesAno, setConfirmMesAno] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      const { months, error: listErr } = await listLinkedInSnapshots(token, userId);
      if (listErr) { setError(listErr); return; }
      if (!months || months.length === 0) { setRows([]); return; }

      const { snapshots, error: batchErr } = await getLinkedInSnapshotBatch(token, userId, months);
      if (batchErr) { setError(batchErr); return; }

      const newRows: SnapshotRow[] = months.map(m => {
        const s = snapshots?.[m] as LinkedInSnapshot | undefined;
        return {
          mesAno: m,
          uploadedAt: s?.uploadedAt ?? '',
          uploadType: s?.uploadType ?? 'monthly',
          totalImpressions: s?.totalImpressions ?? 0,
          totalEngagement: s?.totalEngagement ?? 0,
        };
      });

      setRows(newRows);
    } catch (e) {
      console.error('[UploadHistoryModal] loadHistory error:', e);
      setError('Erro ao carregar histórico.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Carregar ao abrir
  useEffect(() => {
    if (open) loadHistory();
  }, [open, loadHistory]);

  const handleDeleteConfirm = async () => {
    if (!confirmMesAno) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const token = await getAuthToken();
      const result = await deleteLinkedInSnapshot(token, userId, confirmMesAno);
      if (result.error) {
        setDeleteError(result.error);
      } else {
        // Atualiza lista local
        const deleted = confirmMesAno;
        setRows(prev => prev.filter(r => r.mesAno !== deleted));
        setConfirmMesAno(null);
        onDeleted?.(deleted);
      }
    } catch (e) {
      console.error('[UploadHistoryModal] handleDeleteConfirm error:', e);
      setDeleteError('Erro ao excluir. Tente novamente.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Histórico de uploads
            </DialogTitle>
            <DialogDescription>
              Todos os meses com dados do LinkedIn Analytics importados.
              Você pode excluir um mês e fazer um novo upload caso os dados estejam incorretos.
            </DialogDescription>
          </DialogHeader>

          {/* Corpo */}
          <div className="mt-2 min-h-[120px]">
            {loading && (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!loading && error && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {!loading && !error && rows.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum upload encontrado.
              </p>
            )}

            {!loading && !error && rows.length > 0 && (
              <div className="divide-y rounded-lg border overflow-hidden">
                {rows.map(row => (
                  <div
                    key={row.mesAno}
                    className="flex items-center gap-3 px-4 py-3 bg-background hover:bg-muted/30 transition-colors"
                  >
                    {/* Mês */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">
                        {formatMesAno(row.mesAno)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {row.uploadedAt ? `Enviado em ${formatDate(row.uploadedAt)}` : 'Data não registrada'}
                      </p>
                    </div>

                    {/* Badge tipo */}
                    <span
                      className={cn(
                        'shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none',
                        row.uploadType === 'historical'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-100 text-blue-700',
                      )}
                    >
                      {row.uploadType === 'historical' ? 'Histórico' : 'Mensal'}
                    </span>

                    {/* Botão excluir */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setDeleteError(null);
                        setConfirmMesAno(row.mesAno);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm dialog de exclusão */}
      <AlertDialog
        open={!!confirmMesAno}
        onOpenChange={(open) => { if (!open && !deleting) setConfirmMesAno(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir upload de {confirmMesAno ? formatMesAno(confirmMesAno) : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai remover permanentemente os dados de{' '}
              <strong>{confirmMesAno ? formatMesAno(confirmMesAno) : ''}</strong>.
              Você poderá fazer um novo upload depois, mas esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {deleteError}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Excluindo…
                </span>
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
