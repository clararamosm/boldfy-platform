// src/lib/personal-brand.ts
//
// Helpers de leitura/montagem do PersonalBrand v2 com fallback pro schema v1.
//
// Estrategia de migracao: LAZY + DUAL-READ.
//  - Leitura tenta v2 (`users/{uid}.personalBrand`) primeiro.
//  - Quando v2 esta vazio, monta um shape v2 a partir dos campos v1 flat
//    pra que a UI e o prompt nao precisem se preocupar com qual versao
//    o usuario tem.
//  - A primeira vez que o colaborador salva a tela nova, ele migra
//    automaticamente (salva em v2).
//
// Spec-mae: source-of-truth/specs/colaborador-marca-pessoal-e-editor-de-conteudo.md §4

import {
  defaultPersonalBrandVoiceSliders,
  type PersonalBrand,
  type PersonalBrandBasics,
  type PersonalBrandPillar,
} from '@/types/personal-brand';
import type { PillarColorKey } from '@/lib/pillar-colors';

// ──────────────────────────────────────────────────────────────────────────
// Tipos do schema v1 (legado)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Schema v1 da Marca Pessoal — campos flat top-level em `users/{uid}`.
 * Mantidos vivos por compatibilidade ate todos os usuarios migrarem.
 */
export type PersonalBrandV1 = {
  position?: string;
  expertise?: string;
  voice?: string;
  value?: string;
  languageStyle?: string;
  contentPillars?: string[] | string;
};

// ──────────────────────────────────────────────────────────────────────────
// Leitura unificada
// ──────────────────────────────────────────────────────────────────────────

/**
 * Resultado da leitura — sempre devolve um PersonalBrand v2 (ainda que
 * parcial e composto a partir do v1). O caller nao precisa fazer
 * if/else entre versoes.
 */
export type ResolvedPersonalBrand = {
  brand: PersonalBrand;
  // Origem dos dados pra debug/UI. `'v2'` significa que veio limpo do novo
  // schema. `'v1-fallback'` significa que foi composto do legado. `'empty'`
  // significa que o usuario nunca preencheu nada.
  source: 'v2' | 'v1-fallback' | 'empty';
};

/**
 * Le o documento do usuario (qualquer shape) e devolve um PersonalBrand v2.
 * Aceita o `data()` cru do Firestore (FirebaseFirestore.DocumentData ou
 * DocumentSnapshot.data()) — nao depende de SDK especifico (client vs admin).
 */
export function resolvePersonalBrand(userData: Record<string, unknown> | undefined): ResolvedPersonalBrand {
  // Caso 1: ja tem v2 limpo
  const v2 = userData?.personalBrand as PersonalBrand | undefined;
  if (v2 && typeof v2 === 'object' && v2.version === 2 && v2.basics) {
    return { brand: v2, source: 'v2' };
  }

  // Caso 2: fallback a partir do v1
  const v1: PersonalBrandV1 = {
    position: (userData?.position as string) || '',
    expertise: (userData?.expertise as string) || '',
    voice: (userData?.voice as string) || '',
    value: (userData?.value as string) || '',
    languageStyle: (userData?.languageStyle as string) || '',
    contentPillars: userData?.contentPillars as string[] | string | undefined,
  };

  const hasV1Data =
    !!v1.position || !!v1.expertise || !!v1.voice || !!v1.value || !!v1.languageStyle ||
    (Array.isArray(v1.contentPillars) ? v1.contentPillars.length > 0 : !!v1.contentPillars);

  const basics: PersonalBrandBasics = {
    position: v1.position ?? '',
    expertise: v1.expertise ?? '',
  };

  // Tenta extrair pilares do array/CSV v1 e atribuir cores rotativamente.
  const pillarsFromV1 = extractPillarsFromV1(v1.contentPillars);

  const brand: PersonalBrand = {
    version: 2,
    basics,
    // Discovery e voice nao tem mapeamento direto do v1 — ficam undefined.
    // O `voice` string do v1 e perdido na migracao automatica, mas a UI
    // mostra como "Em construcao" e o usuario pode preencher os sliders.
    // Estrategia parcial a partir dos pilares legados se houver.
    ...(pillarsFromV1.length > 0 && {
      strategy: {
        primaryObjective: 'autoridade' as const, // default, usuario pode trocar
        pillars: pillarsFromV1,
      },
    }),
    updatedAt: new Date(0).toISOString(),
    source: 'manual' as const,
  };

  return { brand, source: hasV1Data ? 'v1-fallback' : 'empty' };
}

const FALLBACK_COLORS: PillarColorKey[] = ['orange', 'amber', 'green', 'blue'];

/**
 * Pega o array ou CSV de pilares do v1 e monta a estrutura v2 minima.
 * Como o v1 so tem o nome, descricao e angulo ficam vazios e a cor e
 * atribuida rotativamente da paleta.
 */
function extractPillarsFromV1(raw: string[] | string | undefined): PersonalBrandPillar[] {
  if (!raw) return [];
  const names = Array.isArray(raw)
    ? raw
    : raw.split(',').map((s) => s.trim()).filter(Boolean);

  return names.slice(0, 5).map((name, idx) => ({
    id: slugify(name) || `pilar-${idx + 1}`,
    name,
    description: '',
    color: FALLBACK_COLORS[idx % FALLBACK_COLORS.length],
  }));
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

// ──────────────────────────────────────────────────────────────────────────
// Voice slider → prosa (consumido pelo prompt da IA)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Traduz os sliders 0-100 pra uma descricao em prosa que o prompt da IA
 * consome. Usado pela Camada 4 (PR 6).
 *
 * Exemplo: { formality: 70, tone: 40 } → "Casual (70/100), levemente serio (40/100)..."
 */
export function describeVoiceSliders(brand: PersonalBrand): string {
  const v = brand.voice;
  if (!v) return '';

  const labels: Array<{ key: keyof typeof v.sliders; left: string; right: string }> = [
    { key: 'formality', left: 'Formal', right: 'Casual' },
    { key: 'tone', left: 'Serio', right: 'Divertido' },
    { key: 'complexity', left: 'Tecnico', right: 'Acessivel' },
    { key: 'brevity', left: 'Direto', right: 'Detalhado' },
    { key: 'stance', left: 'Contido', right: 'Provocador' },
    { key: 'register', left: 'Analitico', right: 'Emocional' },
    { key: 'outlook', left: 'Cetico', right: 'Otimista' },
  ];

  const parts: string[] = [];
  for (const { key, left, right } of labels) {
    const val = v.sliders[key];
    if (val === undefined) continue;
    const pick = val >= 50 ? right : left;
    const intensity = val >= 50 ? val : 100 - val;
    parts.push(`${pick} (${intensity}/100 em ${left} ↔ ${right})`);
  }
  return parts.join(', ');
}
