'use client';

import { Upload, X, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const MONTH_NAMES_PT: Record<string, string> = {
  '01': 'janeiro', '02': 'fevereiro', '03': 'março', '04': 'abril',
  '05': 'maio', '06': 'junho', '07': 'julho', '08': 'agosto',
  '09': 'setembro', '10': 'outubro', '11': 'novembro', '12': 'dezembro',
};

/** Retorna "YYYY-MM" do mês imediatamente anterior à data fornecida. */
function previousMonth(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

interface UploadPendingBannerProps {
  onUploadClick: () => void;
  /**
   * Mês alvo do upload no formato "YYYY-MM". Se omitido, calcula o mês
   * imediatamente anterior à data atual (Clara: "em maio, o upload é de
   * abril"). NÃO usar o mês atual — o extract mensal só fecha depois do
   * mês terminar.
   */
  targetMonth?: string;
  /** Pontos que a pessoa ganha por fazer o upload. Default 50. */
  points?: number;
  /**
   * Variante visual:
   * - 'compact' (default): banner discreto laranja, pra dentro de páginas onde
   *   já há outro contexto.
   * - 'highlight': card maior com mais cor/destaque, pra dashboard inicial e
   *   primeiros dias do mês.
   */
  variant?: 'compact' | 'highlight';
  dismissible?: boolean;
}

export function UploadPendingBanner({
  onUploadClick,
  targetMonth,
  points = 50,
  variant = 'compact',
  dismissible = true,
}: UploadPendingBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const mesAno = targetMonth ?? previousMonth(new Date());
  const [, month] = mesAno.split('-');
  const monthName = MONTH_NAMES_PT[month] ?? mesAno;

  if (variant === 'highlight') {
    return (
      <div className="relative overflow-hidden rounded-2xl border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
            <Upload className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-orange-900">
              O extract de {monthName} já pode ser feito
            </p>
            <p className="text-xs text-orange-800/90 mt-1 leading-relaxed">
              Faça o upload do relatório de Analytics do LinkedIn e ganhe{' '}
              <span className="inline-flex items-center gap-1 font-bold text-amber-700">
                <Coins className="h-3.5 w-3.5" /> {points} pontos
              </span>
              . Esses dados são o que a empresa usa pra entender o que está funcionando.
            </p>
            <Button
              size="sm"
              className="mt-3 bg-orange-600 text-white hover:bg-orange-700"
              onClick={onUploadClick}
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Fazer upload agora
            </Button>
          </div>
          {dismissible && (
            <button
              onClick={() => setDismissed(true)}
              className="text-orange-400 hover:text-orange-700 transition-colors"
              aria-label="Dispensar"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3')}>
      <Upload className="h-4 w-4 text-orange-600 shrink-0" />
      <p className="text-sm text-orange-800 flex-1">
        Faça o upload do extract de <strong>{monthName}</strong> e ganhe{' '}
        <span className="inline-flex items-center gap-0.5 font-semibold text-amber-700">
          <Coins className="h-3 w-3" /> {points} pontos
        </span>
        .
      </p>
      <Button
        size="sm"
        variant="outline"
        className="border-orange-300 text-orange-700 hover:bg-orange-100 shrink-0"
        onClick={onUploadClick}
      >
        <Upload className="h-3.5 w-3.5 mr-1.5" />
        Fazer Upload
      </Button>
      {dismissible && (
        <button
          onClick={() => setDismissed(true)}
          className="text-orange-400 hover:text-orange-600 transition-colors ml-1"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
