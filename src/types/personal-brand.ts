// src/types/personal-brand.ts
//
// Schema v2 da Marca Pessoal do colaborador.
//
// Vive sob `users/{uid}.personalBrand`. Substitui o schema v1 que tinha 6
// campos flat top-level (`voice`, `expertise`, `value`, `position`,
// `languageStyle`, `contentPillars`). A migracao e LAZY + DUAL-READ:
//
//   1. A tela `/colaborador/marca-pessoal` salva sempre em v2.
//   2. A leitura (prompt da IA, tela em si) tenta v2 primeiro e cai pra v1
//      via `readPersonalBrandWithFallback` em src/lib/personal-brand.ts.
//   3. Usuarios existentes com v1 continuam funcionando ate salvarem a tela
//      nova — entao a v1 fica vazia e v2 passa a alimentar tudo.
//
// Spec-mae: source-of-truth/specs/colaborador-marca-pessoal-e-editor-de-conteudo.md §4

import type { PillarColorKey } from '@/lib/pillar-colors';

// ──────────────────────────────────────────────────────────────────────────
// Bloco 1 — Identidade basica (sempre obrigatorio)
// ──────────────────────────────────────────────────────────────────────────

export type PersonalBrandBasics = {
  position: string;   // Cargo atual
  expertise: string;  // Areas que domina (texto curto, 1-2 frases)
};

// ──────────────────────────────────────────────────────────────────────────
// Bloco 2 — Discovery + Proposta de Valor (MP1 + MP3)
// ──────────────────────────────────────────────────────────────────────────

export type PersonalBrandDiscovery = {
  // MP1 — Frase de partida
  convergence: string;     // Como aparece hoje (verde no workbook)
  aspiration: string;      // Como quer ser visto (amarelo)
  surprise: string;        // O que surpreendeu nas respostas externas (vermelho)
  startingPhrase: string;  // Frase composta livre (opcional)

  // MP3 — Proposta de Valor estruturada
  valueProposition: {
    who: string;       // Pra quem gera valor
    problem: string;   // Que problema resolve
    how: string;       // O que torna o jeito diferente
    result: string;    // Resultado/transformacao
  };
};

// ──────────────────────────────────────────────────────────────────────────
// Bloco 3 — Voz (MP7) com sliders de adjetivos opostos
// ──────────────────────────────────────────────────────────────────────────

/**
 * Sliders 0-100 (50 = neutro). Os 4 primeiros sao obrigatorios; os 3
 * ultimos sao opcionais e ficam num accordion "Refinar mais" na UI.
 */
export type PersonalBrandVoiceSliders = {
  formality: number;   // 0 Formal       ↔ 100 Casual
  tone: number;        // 0 Serio        ↔ 100 Divertido
  complexity: number;  // 0 Tecnico      ↔ 100 Acessivel
  brevity: number;     // 0 Direto       ↔ 100 Detalhado
  stance?: number;     // 0 Contido      ↔ 100 Provocador
  register?: number;   // 0 Analitico    ↔ 100 Emocional
  outlook?: number;    // 0 Cetico       ↔ 100 Otimista
};

export type PersonalBrandVoice = {
  sliders: PersonalBrandVoiceSliders;
  keywords?: string[];      // Palavras-assinatura (opcional)
  avoidWords?: string[];    // Palavras a evitar (opcional)
  description?: string;     // Texto livre pra calibrar a IA mais finamente (opcional)
};

// ──────────────────────────────────────────────────────────────────────────
// Bloco 4 — Estrategia de Conteudo (EC1 + EC2)
// ──────────────────────────────────────────────────────────────────────────

export const PERSONAL_BRAND_OBJECTIVES = [
  'autoridade',
  'conexoes_qualificadas',
  'demanda',
  'talentos',
  'mercado',
] as const;

export type PersonalBrandObjective = (typeof PERSONAL_BRAND_OBJECTIVES)[number];

export const OBJECTIVE_LABELS: Record<PersonalBrandObjective, string> = {
  autoridade: 'Construir autoridade',
  conexoes_qualificadas: 'Conexoes qualificadas',
  demanda: 'Gerar demanda',
  talentos: 'Atrair talentos',
  mercado: 'Conhecer o mercado',
};

export type PersonalBrandPillar = {
  id: string;            // slug curto, ex: 'previsao-receita'
  name: string;          // Nome curto exibido (3-5 palavras)
  description: string;   // 1 frase: o que esse pilar cobre
  color: PillarColorKey; // chave da paleta (ver src/lib/pillar-colors.ts)
  // 3 angulos opcionais (preenchidos quando o colaborador avancar)
  angles?: {
    market?: string;        // Como esse pilar aparece no angulo Mercado
    personal?: string;      // Angulo Pessoal
    institutional?: string; // Angulo Institucional
  };
};

export type PersonalBrandStrategy = {
  primaryObjective: PersonalBrandObjective;
  secondaryObjectives?: PersonalBrandObjective[]; // ate 2
  pillars: PersonalBrandPillar[];                 // 3 a 5 pilares
};

// ──────────────────────────────────────────────────────────────────────────
// Documento raiz
// ──────────────────────────────────────────────────────────────────────────

/**
 * `source` rastreia de onde veio o preenchimento (analytics).
 *  - 'onboarding': preenchido no onboarding inicial
 *  - 'manual': editado direto pela tela /colaborador/marca-pessoal
 *  - 'trilha': importado de workbookResponses de uma trilha (PR 2)
 */
export type PersonalBrandSource = 'onboarding' | 'manual' | 'trilha';

export type PersonalBrand = {
  version: 2;

  // Bloco 1 sempre obrigatorio
  basics: PersonalBrandBasics;

  // Demais blocos opcionais — desbloqueados conforme o colaborador avanca
  discovery?: PersonalBrandDiscovery;
  voice?: PersonalBrandVoice;
  strategy?: PersonalBrandStrategy;

  // Meta
  updatedAt: string;          // ISO timestamp
  source: PersonalBrandSource;
};

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

export const DEFAULT_SLIDER_VALUE = 50;

export function defaultPersonalBrandVoiceSliders(): PersonalBrandVoiceSliders {
  return {
    formality: DEFAULT_SLIDER_VALUE,
    tone: DEFAULT_SLIDER_VALUE,
    complexity: DEFAULT_SLIDER_VALUE,
    brevity: DEFAULT_SLIDER_VALUE,
  };
}

/**
 * Verifica se um bloco do PersonalBrand pode ser considerado "preenchido"
 * (vs "em construcao") pra render do estado nos cards da tela.
 */
export function isBasicsFilled(b?: PersonalBrandBasics): boolean {
  if (!b) return false;
  return b.position.trim().length > 0 && b.expertise.trim().length > 0;
}

export function isDiscoveryFilled(d?: PersonalBrandDiscovery): boolean {
  if (!d) return false;
  const vp = d.valueProposition;
  return [d.convergence, d.aspiration, d.surprise, vp.who, vp.problem, vp.how, vp.result]
    .some((s) => s && s.trim().length > 0);
}

export function isVoiceFilled(v?: PersonalBrandVoice): boolean {
  if (!v) return false;
  // Voz e considerada preenchida quando algum slider obrigatorio foi mexido
  // (saiu do default 50) OU quando keywords/description estao presentes.
  const sliders = v.sliders;
  const moved =
    sliders.formality !== DEFAULT_SLIDER_VALUE ||
    sliders.tone !== DEFAULT_SLIDER_VALUE ||
    sliders.complexity !== DEFAULT_SLIDER_VALUE ||
    sliders.brevity !== DEFAULT_SLIDER_VALUE;
  const hasExtras = !!(v.keywords?.length || v.avoidWords?.length || v.description?.trim());
  return moved || hasExtras;
}

export function isStrategyFilled(s?: PersonalBrandStrategy): boolean {
  if (!s) return false;
  return s.pillars.length > 0;
}
