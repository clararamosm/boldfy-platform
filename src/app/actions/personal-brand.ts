// src/app/actions/personal-brand.ts
'use server';

/**
 * Server actions para salvar o PersonalBrand v2 do colaborador.
 *
 * Antes (v1) a tela de Marca Pessoal salvava direto via Firestore client SDK
 * (sem validacao, sem audit). Agora passa por server action com Zod + auth
 * guard. O salvamento aqui e o que efetivamente migra o usuario de v1 → v2.
 */

import { z } from 'zod';
import { db as adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireSelf } from '@/lib/auth-guard';
import {
  PERSONAL_BRAND_OBJECTIVES,
  type PersonalBrand,
  type PersonalBrandDiscovery,
} from '@/types/personal-brand';

// Normalizacao de titulo replicada aqui (server-side, sem depender do
// client SDK do lib/trilhas/queries.ts). Mantenha em sync com aquele.
function normalizeTrailTitle(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

// ──────────────────────────────────────────────────────────────────────────
// Schemas Zod
// ──────────────────────────────────────────────────────────────────────────

const SliderValueSchema = z.number().int().min(0).max(100);

const BasicsSchema = z.object({
  position: z.string().trim().max(200),
  expertise: z.string().trim().max(1000),
  experience: z.string().trim().max(2000).optional(),
});

const DiscoverySchema = z.object({
  aspiration: z.string().trim().max(2000),
  startingPhrase: z.string().trim().max(500),
  valueProposition: z.object({
    who: z.string().trim().max(500),
    problem: z.string().trim().max(500),
    how: z.string().trim().max(500),
    result: z.string().trim().max(500),
    differential: z.string().trim().max(500).optional(),
  }),
});

const VoiceSchema = z.object({
  sliders: z.object({
    formality: SliderValueSchema,
    tone: SliderValueSchema,
    complexity: SliderValueSchema,
    brevity: SliderValueSchema,
    stance: SliderValueSchema.optional(),
    register: SliderValueSchema.optional(),
    outlook: SliderValueSchema.optional(),
  }),
  keywords: z.array(z.string().trim().max(40)).max(20).optional(),
  avoidWords: z.array(z.string().trim().max(40)).max(20).optional(),
  description: z.string().trim().max(1000).optional(),
});

const PillarColorSchema = z.enum(['orange', 'amber', 'green', 'blue']);

const PillarSchema = z.object({
  id: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300),
  color: PillarColorSchema,
  angles: z
    .object({
      market: z.string().trim().max(500).optional(),
      personal: z.string().trim().max(500).optional(),
      institutional: z.string().trim().max(500).optional(),
    })
    .optional(),
});

const StrategySchema = z.object({
  primaryObjective: z.enum(PERSONAL_BRAND_OBJECTIVES),
  secondaryObjectives: z.array(z.enum(PERSONAL_BRAND_OBJECTIVES)).max(2).optional(),
  pillars: z.array(PillarSchema).min(0).max(5),
});

const PersonalBrandInputSchema = z.object({
  basics: BasicsSchema,
  discovery: DiscoverySchema.optional(),
  voice: VoiceSchema.optional(),
  strategy: StrategySchema.optional(),
  source: z.enum(['onboarding', 'manual', 'trilha']).default('manual'),
});

export type PersonalBrandInput = z.infer<typeof PersonalBrandInputSchema>;

// ──────────────────────────────────────────────────────────────────────────
// savePersonalBrand
// ──────────────────────────────────────────────────────────────────────────

export type SavePersonalBrandResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Salva o PersonalBrand v2 do colaborador. Faz UPSERT em
 * `users/{uid}.personalBrand`. Mantem os campos legados (`voice`,
 * `expertise`, etc.) intactos pra nao quebrar leituras antigas — o
 * fallback v1→v2 em `lib/personal-brand.ts` ja prioriza v2 quando ambos
 * existem, entao a migracao e gradual e nao destrutiva.
 */
export async function savePersonalBrand(
  idToken: string,
  userId: string,
  input: unknown,
): Promise<SavePersonalBrandResult> {
  try {
    await requireSelf(idToken, userId);

    const parsed = PersonalBrandInputSchema.safeParse(input);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      const path = first?.path?.join('.') ?? '';
      const msg = first?.message ?? 'Dados invalidos.';
      return { ok: false, error: path ? `${path}: ${msg}` : msg };
    }

    const data = parsed.data;

    // Valida regra de unicidade de IDs dos pilares (Zod nao cobre cross-field)
    if (data.strategy?.pillars) {
      const ids = data.strategy.pillars.map((p) => p.id);
      if (new Set(ids).size !== ids.length) {
        return { ok: false, error: 'IDs de pilares duplicados.' };
      }
    }

    const personalBrand: PersonalBrand = {
      version: 2,
      basics: data.basics,
      ...(data.discovery && { discovery: data.discovery }),
      ...(data.voice && { voice: data.voice }),
      ...(data.strategy && { strategy: data.strategy }),
      updatedAt: new Date().toISOString(),
      source: data.source,
    };

    const userRef = adminDb.collection('users').doc(userId);

    // UPDATE — usa um payload chato (sem dot-paths) pra evitar conflito
    // com o tipo do v1 flat e sobrescrever o personalBrand inteiro.
    await userRef.set(
      {
        personalBrand,
        // Mantem retrocompat: o `position` flat continua existindo (alguns
        // componentes leem dele direto). Espelha do v2.
        position: data.basics.position,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return { ok: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
    return { ok: false, error: errorMessage };
  }
}

// ──────────────────────────────────────────────────────────────────────────
// importWorkbookToBrand (PR 2)
// ──────────────────────────────────────────────────────────────────────────

/**
 * MAPPING workbook → PersonalBrand v2.
 *
 * Trilhas relevantes (match por TITULO normalizado — `code` foi descartado):
 *  - "Discovery de Marca Pessoal"   → bloco Discovery (posicionamento)
 *  - "Promessa e Proposta de Valor" → valueProposition estruturada
 *
 * As CHAVES (`aspiration`, `who`, etc.) sao os `id` dos input tags
 * (<input-field> / <input-area>) dentro do HTML do módulo `faca_voce_mesmo`
 * da trilha (ver `src/components/trilhas/player/workbook-parser.ts`).
 *
 * REGRA: quando criar/editar essas trilhas no Master, use estes IDs nos
 * atributos `id` dos input tags. Se um ID nao bate, o campo correspondente
 * fica vazio (degrada graciosamente). Se voce renomear a trilha, o match
 * por titulo quebra — sincronize o `WORKBOOK_TRAIL_TITLES` abaixo.
 */
// Titulos das trilhas que alimentam a Marca Pessoal. A LISTA AUTORITATIVA
// vive em src/lib/trilhas/brand-import.ts — duplicada aqui apenas pra
// fazer o mapping "qual trilha alimenta qual bloco do PersonalBrand v2".
// Se renomear, sincronize com o brand-import.ts.
const WORKBOOK_TRAIL_TITLES = {
  discovery: 'Discovery de Marca Pessoal',
  valueProposition: 'Promessa e Proposta de Valor',
} as const;

const WORKBOOK_FIELD_MAP = {
  discovery: {
    // So o que a IA precisa pro prompt: aspiracao projetada + sintese.
    // O workbook pode ter outros campos (convergence, surprise) — esses
    // ficam la como ferramentas internas e nao sao puxados pra ca.
    aspiration: 'aspiration',
    startingPhrase: 'starting_phrase',
  },
  valueProposition: {
    who: 'vp_who',
    problem: 'vp_problem',
    how: 'vp_how',
    result: 'vp_result',
    differential: 'vp_differential',
  },
} as const;

export type ImportWorkbookPreview = {
  // Bloco preenchido a partir do workbook (vazio se nada bateu).
  discovery: Partial<PersonalBrandDiscovery>;
  // Titulos de trilha encontrados (no formato cadastrado pelo Master).
  trailsFound: { title: string; trailId: string }[];
  // Titulos que tem trilha cadastrada mas o user ainda nao respondeu.
  trailsNotAnswered: string[];
  // Titulos esperados mas nao cadastrados (Master precisa criar).
  trailsMissing: string[];
};

export type ImportWorkbookResult =
  | { ok: true; preview: ImportWorkbookPreview }
  | { ok: false; error: string };

/**
 * Le os workbookResponses do colaborador pras trilhas relevantes (match
 * por titulo) e devolve um preview do que o import preencheria no
 * PersonalBrand. NAO grava — a UI mostra o diff e o user confirma o save
 * (que vai via `savePersonalBrand` normal).
 */
export async function previewWorkbookImport(
  idToken: string,
  userId: string,
): Promise<ImportWorkbookResult> {
  try {
    await requireSelf(idToken, userId);

    // Resolve trilhas alvo por titulo (case/accent-insensitive).
    const wanted = [
      { key: 'discovery' as const, title: WORKBOOK_TRAIL_TITLES.discovery },
      { key: 'valueProposition' as const, title: WORKBOOK_TRAIL_TITLES.valueProposition },
    ];

    // Itera 1x pelas sessoes globais buscando matches por titulo normalizado.
    const sessionsSnap = await adminDb.collection('globalSessions').get();
    const titleToTrailId = new Map<string, string>(); // normalized title → trailId

    for (const sess of sessionsSnap.docs) {
      const trailsSnap = await sess.ref.collection('trails').get();
      for (const t of trailsSnap.docs) {
        const data = t.data() as { titulo?: string };
        if (!data.titulo) continue;
        titleToTrailId.set(normalizeTrailTitle(data.titulo), t.id);
      }
    }

    const found: { title: string; trailId: string; key: 'discovery' | 'valueProposition' }[] = [];
    const missing: string[] = [];
    for (const w of wanted) {
      const trailId = titleToTrailId.get(normalizeTrailTitle(w.title));
      if (trailId) {
        found.push({ title: w.title, trailId, key: w.key });
      } else {
        missing.push(w.title);
      }
    }

    // Le `workbookResponses` (todos os modulos) de cada trilha encontrada.
    const notAnswered: string[] = [];
    const allAnswers: Record<'discovery' | 'valueProposition', Record<string, string | string[]>> = {
      discovery: {},
      valueProposition: {},
    };

    for (const { title, trailId, key } of found) {
      const wbSnap = await adminDb
        .collection('users')
        .doc(userId)
        .collection('workbookResponses')
        .where('trailId', '==', trailId)
        .get();

      if (wbSnap.empty) {
        notAnswered.push(title);
        continue;
      }
      // Mergeia respostas de todos os modulos da trilha — o `id` do campo
      // precisa ser unico dentro da trilha pra evitar collision.
      const merged: Record<string, string | string[]> = {};
      for (const docSnap of wbSnap.docs) {
        const respostas = (docSnap.data() as { respostas?: Record<string, string | string[]> }).respostas ?? {};
        Object.assign(merged, respostas);
      }
      allAnswers[key] = merged;
    }

    const pickString = (m: Record<string, string | string[]> | undefined, key: string): string | undefined => {
      if (!m) return undefined;
      const v = m[key];
      if (typeof v === 'string') return v.trim() || undefined;
      if (Array.isArray(v)) return v.join(', ').trim() || undefined;
      return undefined;
    };

    const discMap = WORKBOOK_FIELD_MAP.discovery;
    const vpMap = WORKBOOK_FIELD_MAP.valueProposition;

    const discovery: Partial<PersonalBrandDiscovery> = {};

    const asp = pickString(allAnswers.discovery, discMap.aspiration);
    const start = pickString(allAnswers.discovery, discMap.startingPhrase);
    if (asp) discovery.aspiration = asp;
    if (start) discovery.startingPhrase = start;

    const who = pickString(allAnswers.valueProposition, vpMap.who);
    const problem = pickString(allAnswers.valueProposition, vpMap.problem);
    const how = pickString(allAnswers.valueProposition, vpMap.how);
    const result = pickString(allAnswers.valueProposition, vpMap.result);
    const differential = pickString(allAnswers.valueProposition, vpMap.differential);
    if (who || problem || how || result || differential) {
      discovery.valueProposition = {
        who: who ?? '',
        problem: problem ?? '',
        how: how ?? '',
        result: result ?? '',
        ...(differential && { differential }),
      };
    }

    return {
      ok: true,
      preview: {
        discovery,
        trailsFound: found.map(({ title, trailId }) => ({ title, trailId })),
        trailsNotAnswered: notAnswered,
        trailsMissing: missing,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
    return { ok: false, error: errorMessage };
  }
}
