/**
 * Utilitários compartilhados para o módulo LinkedIn Analytics.
 * Centraliza helpers de formatação para evitar duplicação nos componentes.
 */

export const MONTH_NAMES_PT: Record<string, string> = {
  '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
  '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
  '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
};

export const MONTH_ABBR_PT: Record<string, string> = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
  '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
};

/** "2024-04" → "Abril 2024" */
export function formatMesAno(mesAno: string): string {
  const [year, month] = mesAno.split('-');
  return `${MONTH_NAMES_PT[month] ?? month} ${year}`;
}

/** "2024-04" → "Abr/24" */
export function formatMesAnoShort(mesAno: string): string {
  const [year, month] = mesAno.split('-');
  return `${MONTH_ABBR_PT[month] ?? month}/${year.slice(2)}`;
}

/** "2024-04-15" → "15/04/2024" */
export function formatDate(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

/** 1234567 → "1.2M" | 12345 → "12k" | 123 → "123" */
export function formatCompactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

/** 1234 → "1.234" (locale pt-BR, sem abreviação) */
export function formatNumber(n: number): string {
  return n.toLocaleString('pt-BR');
}

/** 1234 → "R$ 1.234" */
export function formatCurrency(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}
