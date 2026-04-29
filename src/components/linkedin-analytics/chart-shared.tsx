'use client';

/**
 * Componentes e helpers compartilhados entre os gráficos mensais de
 * impressões e seguidores (evita duplicação de CustomXAxisTick e buildMonthBars).
 */

import { MONTH_ABBR_PT } from '@/lib/linkedin-analytics-utils';

export interface MonthBarBase {
  mesAno: string;
  label: string;  // ex: "Jan", "Fev"
  year: string;
  hasData: boolean;
}

/**
 * Preenche todos os meses entre o primeiro e o último snapshot disponível,
 * inserindo entradas com hasData=false para meses sem dados.
 */
export function buildMonthBars(sortedKeys: string[]): MonthBarBase[] {
  if (!sortedKeys.length) return [];
  const first = sortedKeys[0];
  const last = sortedKeys[sortedKeys.length - 1];

  const result: MonthBarBase[] = [];
  let [cy, cm] = first.split('-').map(Number);
  const [ey, em] = last.split('-').map(Number);

  while (cy < ey || (cy === ey && cm <= em)) {
    const mesAno = `${cy}-${String(cm).padStart(2, '0')}`;
    result.push({
      mesAno,
      label: MONTH_ABBR_PT[String(cm).padStart(2, '0')] ?? String(cm),
      year: String(cy),
      hasData: sortedKeys.includes(mesAno),
    });
    cm++;
    if (cm > 12) { cm = 1; cy++; }
  }
  return result;
}

/**
 * Tick customizado para eixo X dos gráficos mensais.
 * Exibe o ano apenas quando muda (primeiro mês de cada ano).
 */
export function ChartXAxisTick({
  x, y, payload, bars,
}: {
  x?: number;
  y?: number;
  payload?: { value: string };
  bars: MonthBarBase[];
}) {
  const bar = bars.find(b => b.mesAno === payload?.value);
  if (!bar) return null;
  const idx = bars.indexOf(bar);
  const showYear = idx === 0 || bars[idx - 1]?.year !== bar.year;
  return (
    <g transform={`translate(${x},${y})`}>
      {showYear && (
        <text x={0} y={-8} textAnchor="middle" fontSize={10} fill="#64748b" fontWeight={600}>
          {bar.year}
        </text>
      )}
      <text x={0} y={12} textAnchor="middle" fontSize={10} fill={bar.hasData ? '#475569' : '#cbd5e1'}>
        {bar.label}
      </text>
    </g>
  );
}
