// Parser do XLSX do LinkedIn Analytics
// Lê o arquivo no browser (client-side) e retorna dados estruturados
// O server action recebe apenas o JSON resultante — nunca o arquivo binário

import * as XLSX from 'xlsx';
import type { ParsedLinkedInData, LinkedInDailyEngagement, LinkedInTopPost, LinkedInDailyFollower, LinkedInDemographic } from './linkedin-analytics-types';

// ---------------------------------------------------------------------------
// Funções auxiliares de parse
// ---------------------------------------------------------------------------

/**
 * Converte número PT-BR com separador de milhar "." para number
 * "325.719" → 325719   |   "1.234.567" → 1234567   |   12840 → 12840
 */
function parseNumberPtBR(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return Math.round(val);
  const str = String(val).trim().replace(/\./g, '').replace(',', '.');
  const n = parseFloat(str);
  return isNaN(n) ? 0 : Math.round(n);
}

/**
 * Converte data PT-BR "DD/MM/YYYY" ou serial do Excel para "YYYY-MM-DD"
 */
function parseDatePtBR(val: unknown): string {
  if (!val) return '';

  // Serial numérico do Excel (dias desde 1900-01-01)
  if (typeof val === 'number') {
    const date = XLSX.SSF.parse_date_code(val);
    if (date) {
      const m = String(date.m).padStart(2, '0');
      const d = String(date.d).padStart(2, '0');
      return `${date.y}-${m}-${d}`;
    }
  }

  const str = String(val).trim();

  // "DD/MM/YYYY"
  const ptMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ptMatch) {
    const [, d, m, y] = ptMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // "YYYY-MM-DD" já está no formato correto
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }

  return '';
}

/**
 * Converte percentual PT-BR para número 0–100
 * "menos de 1%" → 0.5   |   "12,5%" → 12.5   |   "25%" → 25
 */
function parsePercentage(val: unknown): number {
  if (!val) return 0;
  const str = String(val).trim().toLowerCase();
  if (str.includes('menos de 1') || str === '<1%') return 0.5;
  const clean = str.replace('%', '').replace(',', '.').trim();
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

/**
 * Normaliza URL do LinkedIn para comparação
 * "linkedin.com/feed/update/urn:li:activity:745..." → "urn:li:activity:745..."
 */
export function normalizeLinkedInUrl(url: string): string {
  if (!url) return '';
  const match = url.match(/urn:li:activity:\d+/);
  return match ? match[0] : url.trim();
}

/**
 * Infere o mês de referência (YYYY-MM) a partir de um array de datas "YYYY-MM-DD"
 * Usa o mês mais frequente nas datas
 */
function inferMesAno(dates: string[]): string {
  const counts: Record<string, number> = {};
  for (const d of dates) {
    if (!d) continue;
    const key = d.substring(0, 7); // "YYYY-MM"
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? '';
}

/**
 * Retorna o valor de uma célula como string, ignorando undefined/null
 */
function cellStr(sheet: XLSX.WorkSheet, row: number, col: number): string {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  const cell = sheet[addr];
  if (!cell || cell.v === undefined || cell.v === null) return '';
  return String(cell.v).trim();
}

/**
 * Retorna o valor de uma célula como raw (number ou string)
 */
function cellRaw(sheet: XLSX.WorkSheet, row: number, col: number): unknown {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  const cell = sheet[addr];
  if (!cell) return undefined;
  return cell.v;
}

// ---------------------------------------------------------------------------
// Parsers de cada aba
// ---------------------------------------------------------------------------

function parseAba0Descoberta(sheet: XLSX.WorkSheet): { totalImpressions: number; totalReach: number } {
  // Aba 0: duas linhas com label na col A e valor na col B
  // Percorre as primeiras 10 linhas buscando labels conhecidas
  let totalImpressions = 0;
  let totalReach = 0;

  for (let r = 0; r < 10; r++) {
    const label = cellStr(sheet, r, 0).toLowerCase();
    const val = cellRaw(sheet, r, 1);
    if (label.includes('impres')) {
      totalImpressions = parseNumberPtBR(val);
    } else if (label.includes('alcan') || label.includes('usuário') || label.includes('usuario')) {
      totalReach = parseNumberPtBR(val);
    }
  }

  return { totalImpressions, totalReach };
}

function parseAba1Engajamento(sheet: XLSX.WorkSheet): LinkedInDailyEngagement[] {
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1');
  const rows: LinkedInDailyEngagement[] = [];

  // Linha 0 é cabeçalho — começa na 1
  for (let r = 1; r <= range.e.r; r++) {
    const dateRaw = cellRaw(sheet, r, 0);
    const impRaw = cellRaw(sheet, r, 1);
    const engRaw = cellRaw(sheet, r, 2);

    const date = parseDatePtBR(dateRaw);
    if (!date) continue;

    rows.push({
      date,
      impressions: parseNumberPtBR(impRaw),
      engagement: parseNumberPtBR(engRaw),
    });
  }

  return rows;
}

function parseAba2TopPosts(sheet: XLSX.WorkSheet): {
  topPostsByEngagement: LinkedInTopPost[];
  topPostsByImpressions: LinkedInTopPost[];
  totalPostsPublished: number;
} {
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1');
  const byEngagement: LinkedInTopPost[] = [];
  const byImpressions: LinkedInTopPost[] = [];
  const seenUrls = new Set<string>();

  // Tabela esquerda: cols 0-2 (URL | Data | Engajamento)
  // Tabela direita: cols 4-6 (URL | Data | Impressões)
  // Linha 0 é cabeçalho — começa na 1
  for (let r = 1; r <= range.e.r; r++) {
    // Tabela esquerda
    const urlEng = cellStr(sheet, r, 0);
    const dateEngRaw = cellRaw(sheet, r, 1);
    const engRaw = cellRaw(sheet, r, 2);

    if (urlEng && urlEng.includes('linkedin')) {
      const date = parseDatePtBR(dateEngRaw);
      const normalized = normalizeLinkedInUrl(urlEng);
      seenUrls.add(normalized);
      byEngagement.push({
        url: urlEng,
        date,
        engagement: parseNumberPtBR(engRaw),
        impressions: 0, // preenchido depois se possível
      });
    }

    // Tabela direita
    const urlImp = cellStr(sheet, r, 4);
    const dateImpRaw = cellRaw(sheet, r, 5);
    const impRaw = cellRaw(sheet, r, 6);

    if (urlImp && urlImp.includes('linkedin')) {
      const date = parseDatePtBR(dateImpRaw);
      const normalized = normalizeLinkedInUrl(urlImp);
      seenUrls.add(normalized);
      byImpressions.push({
        url: urlImp,
        date,
        engagement: 0,
        impressions: parseNumberPtBR(impRaw),
      });
    }
  }

  // Cruzar: se mesmo post aparece nos dois lados, preencher métricas cruzadas
  for (const post of byEngagement) {
    const norm = normalizeLinkedInUrl(post.url);
    const match = byImpressions.find(p => normalizeLinkedInUrl(p.url) === norm);
    if (match) post.impressions = match.impressions;
  }
  for (const post of byImpressions) {
    const norm = normalizeLinkedInUrl(post.url);
    const match = byEngagement.find(p => normalizeLinkedInUrl(p.url) === norm);
    if (match) post.engagement = match.engagement;
  }

  return {
    topPostsByEngagement: byEngagement.slice(0, 3),
    topPostsByImpressions: byImpressions.slice(0, 3),
    totalPostsPublished: seenUrls.size,
  };
}

function parseAba3Seguidores(sheet: XLSX.WorkSheet): {
  totalFollowers: number;
  totalNewFollowers: number;
  dailyNewFollowers: LinkedInDailyFollower[];
} {
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1');
  let totalFollowers = 0;
  const dailyNewFollowers: LinkedInDailyFollower[] = [];

  // Linha 0: "Seguidores" | total  — ou o total pode estar em col B linha 0
  // Percorrer primeiras linhas buscando o total
  for (let r = 0; r < 3; r++) {
    const label = cellStr(sheet, r, 0).toLowerCase();
    const valB = cellRaw(sheet, r, 1);
    if (label.includes('seguidor') || label.includes('follower')) {
      const n = parseNumberPtBR(valB);
      if (n > 0) {
        totalFollowers = n;
        break;
      }
    }
  }

  // Série diária começa depois do cabeçalho
  for (let r = 1; r <= range.e.r; r++) {
    const dateRaw = cellRaw(sheet, r, 0);
    const newFollRaw = cellRaw(sheet, r, 1);
    const date = parseDatePtBR(dateRaw);
    if (!date) continue;
    dailyNewFollowers.push({
      date,
      newFollowers: parseNumberPtBR(newFollRaw),
    });
  }

  const totalNewFollowers = dailyNewFollowers.reduce((sum, d) => sum + d.newFollowers, 0);

  return { totalFollowers, totalNewFollowers, dailyNewFollowers };
}

function parseAba4Demographics(sheet: XLSX.WorkSheet): LinkedInDemographic[] {
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1');
  const rows: LinkedInDemographic[] = [];

  // Linha 0 é cabeçalho — começa na 1
  for (let r = 1; r <= range.e.r; r++) {
    const category = cellStr(sheet, r, 0);
    const label = cellStr(sheet, r, 1);
    const pctRaw = cellRaw(sheet, r, 2);

    if (!category && !label) continue;

    rows.push({
      category,
      label,
      percentage: parsePercentage(pctRaw),
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Função principal de parse
// ---------------------------------------------------------------------------

export function parseLinkedInXlsx(buffer: ArrayBuffer): ParsedLinkedInData {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });

  if (workbook.SheetNames.length < 4) {
    throw new Error('Arquivo inválido: esperadas pelo menos 4 abas no relatório do LinkedIn Analytics.');
  }

  const sheets = workbook.SheetNames.map(name => workbook.Sheets[name]);

  // Aba 0 — Descoberta
  const { totalImpressions, totalReach } = parseAba0Descoberta(sheets[0]);

  // Aba 1 — Engajamento diário
  const dailyEngagement = parseAba1Engajamento(sheets[1]);
  const totalEngagement = dailyEngagement.reduce((sum, d) => sum + d.engagement, 0);

  // Aba 2 — Top posts
  const { topPostsByEngagement, topPostsByImpressions, totalPostsPublished } = parseAba2TopPosts(sheets[2]);

  // Aba 3 — Seguidores
  const { totalFollowers, totalNewFollowers, dailyNewFollowers } = parseAba3Seguidores(sheets[3]);

  // Aba 4 — Dados demográficos (opcional)
  const demographics = sheets[4] ? parseAba4Demographics(sheets[4]) : [];

  // Inferir mesAno e período
  const allDates = [
    ...dailyEngagement.map(d => d.date),
    ...dailyNewFollowers.map(d => d.date),
  ].filter(Boolean);

  const mesAno = inferMesAno(allDates);

  const sortedDates = [...allDates].sort();
  const start = sortedDates[0] ?? '';
  const end = sortedDates[sortedDates.length - 1] ?? '';

  if (!mesAno) {
    throw new Error('Não foi possível identificar o mês de referência. Verifique se o arquivo é um export válido do LinkedIn Analytics.');
  }

  return {
    mesAno,
    period: { start, end },
    totalImpressions,
    totalReach,
    totalEngagement,
    dailyEngagement,
    totalPostsPublished,
    topPostsByEngagement,
    topPostsByImpressions,
    totalFollowers,
    totalNewFollowers,
    dailyNewFollowers,
    demographics,
  };
}
