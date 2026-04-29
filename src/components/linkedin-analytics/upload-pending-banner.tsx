'use client';

import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

const MONTH_NAMES_PT: Record<string, string> = {
  '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
  '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
  '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
};

interface UploadPendingBannerProps {
  onUploadClick: () => void;
  currentMonth?: string; // "YYYY-MM" — se não passado, usa o mês atual
  dismissible?: boolean;
}

export function UploadPendingBanner({ onUploadClick, currentMonth, dismissible = true }: UploadPendingBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const mesAno = currentMonth ?? new Date().toISOString().substring(0, 7);
  const [, month] = mesAno.split('-');
  const monthName = MONTH_NAMES_PT[month] ?? mesAno;

  return (
    <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
      <Upload className="h-4 w-4 text-orange-600 shrink-0" />
      <p className="text-sm text-orange-800 flex-1">
        O relatório do LinkedIn Analytics de <strong>{monthName}</strong> já está disponível para upload.
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
