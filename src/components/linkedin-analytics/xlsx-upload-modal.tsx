'use client';

import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseLinkedInXlsx } from '@/lib/linkedin-xlsx-parser';
import { uploadLinkedInSnapshot } from '@/app/actions/linkedin-analytics';
import { getAuthToken } from '@/lib/auth-client';
import type { ParsedLinkedInData } from '@/lib/linkedin-analytics-types';

type UploadState =
  | { status: 'idle' }
  | { status: 'parsing' }
  | { status: 'preview'; data: ParsedLinkedInData }
  | { status: 'confirming_overwrite'; data: ParsedLinkedInData }
  | { status: 'uploading' }
  | { status: 'success'; mesAno: string }
  | { status: 'error'; message: string };

interface XlsxUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onSuccess?: (mesAno: string) => void;
}

const MONTH_NAMES_PT: Record<string, string> = {
  '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
  '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
  '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
};

function formatMesAno(mesAno: string): string {
  const [year, month] = mesAno.split('-');
  return `${MONTH_NAMES_PT[month] ?? month} ${year}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString('pt-BR');
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function XlsxUploadModal({ open, onOpenChange, userId, onSuccess }: XlsxUploadModalProps) {
  const [state, setState] = useState<UploadState>({ status: 'idle' });
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setState({ status: 'idle' });
    setIsDragging(false);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onOpenChange(false);
  }, [reset, onOpenChange]);

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.xlsx')) {
      setState({ status: 'error', message: 'O arquivo deve ser um .xlsx exportado do LinkedIn Analytics.' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setState({ status: 'error', message: 'O arquivo é muito grande. O limite é 10 MB.' });
      return;
    }

    setState({ status: 'parsing' });

    try {
      const buffer = await file.arrayBuffer();
      const data = parseLinkedInXlsx(buffer);
      setState({ status: 'preview', data });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao ler o arquivo.';
      setState({ status: 'error', message: msg });
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleConfirmUpload = useCallback(async (data: ParsedLinkedInData, overwrite = false) => {
    setState({ status: 'uploading' });
    try {
      const token = await getAuthToken();
      const result = await uploadLinkedInSnapshot(token, userId, data, overwrite);

      if (result.alreadyExists) {
        setState({ status: 'confirming_overwrite', data });
        return;
      }
      if (result.error) {
        setState({ status: 'error', message: result.error });
        return;
      }

      setState({ status: 'success', mesAno: result.mesAno! });
      onSuccess?.(result.mesAno!);
    } catch {
      setState({ status: 'error', message: 'Erro inesperado. Tente novamente.' });
    }
  }, [userId, onSuccess]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-blue-600" />
            Upload do Relatório LinkedIn
          </DialogTitle>
          <DialogDescription>
            Exporte seus dados do LinkedIn Analytics (período mensal) e faça o upload aqui.
          </DialogDescription>
        </DialogHeader>

        {/* IDLE — Dropzone */}
        {state.status === 'idle' && (
          <div
            className={cn(
              'border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors',
              isDragging ? 'border-blue-500 bg-blue-50' : 'border-muted-foreground/25 hover:border-blue-400 hover:bg-muted/40'
            )}
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <Upload className="h-10 w-10 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium text-sm">Arraste o arquivo aqui ou clique para selecionar</p>
              <p className="text-xs text-muted-foreground mt-1">.xlsx exportado do LinkedIn Analytics · máx. 10 MB</p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}

        {/* PARSING */}
        {state.status === 'parsing' && (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-sm text-muted-foreground">Lendo arquivo...</p>
          </div>
        )}

        {/* PREVIEW */}
        {(state.status === 'preview' || state.status === 'confirming_overwrite') && (
          <div className="space-y-4">
            <div className="rounded-xl bg-green-50 border border-green-200 p-4 space-y-2">
              <p className="font-semibold text-green-800 text-sm">
                ✅ Dados encontrados: {formatMesAno(state.data.mesAno)}
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-green-700">
                <span>📊 {formatNumber(state.data.totalImpressions)} impressões</span>
                <span>👥 {formatNumber(state.data.totalReach)} alcance</span>
                <span>👆 {formatNumber(state.data.totalEngagement)} engajamento</span>
                <span>➕ {formatNumber(state.data.totalNewFollowers)} novos seguidores</span>
                <span>📝 {state.data.totalPostsPublished} posts publicados</span>
                <span>👁 {formatNumber(state.data.totalFollowers)} seguidores totais</span>
              </div>
              {state.data.period.start && (
                <p className="text-xs text-green-600">
                  Período: {formatDate(state.data.period.start)} – {formatDate(state.data.period.end)}
                </p>
              )}
            </div>

            {state.status === 'confirming_overwrite' && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700">
                  Você já importou dados de <strong>{formatMesAno(state.data.mesAno)}</strong>. Deseja substituir?
                </p>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={reset}>
                <X className="h-4 w-4 mr-1" />
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={() => handleConfirmUpload(state.data, state.status === 'confirming_overwrite')}
              >
                {state.status === 'confirming_overwrite' ? 'Substituir' : 'Confirmar Upload'}
              </Button>
            </div>
          </div>
        )}

        {/* UPLOADING */}
        {state.status === 'uploading' && (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-sm text-muted-foreground">Salvando dados...</p>
          </div>
        )}

        {/* SUCCESS */}
        {state.status === 'success' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <p className="font-semibold text-sm">Upload concluído!</p>
            <p className="text-xs text-muted-foreground text-center">
              Os dados de <strong>{formatMesAno(state.mesAno)}</strong> foram salvos com sucesso.
            </p>
            <Button size="sm" onClick={handleClose}>
              Ver dashboard
            </Button>
          </div>
        )}

        {/* ERROR */}
        {state.status === 'error' && (
          <div className="space-y-4">
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-red-700">Erro ao processar o arquivo</p>
                <p className="text-xs text-red-600">{state.message}</p>
                <p className="text-xs text-red-500">
                  Verifique se o arquivo foi exportado do LinkedIn Analytics sem modificações.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={reset}>
                Tentar novamente
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
