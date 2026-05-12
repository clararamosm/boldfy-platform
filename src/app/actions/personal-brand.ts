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
import { TRAIL_CODE_REGEX } from '@/types/trilhas';

// ──────────────────────────────────────────────────────────────────────────
// Schemas Zod
// ──────────────────────────────────────────────────────────────────────────

const SliderValueSchema = z.number().int().min(0).max(100);

const BasicsSchema = z.object({
  position: z.string().trim().max(200),
  expertise: z.string().trim().max(1000),
});

const DiscoverySchema = z.object({
  convergence: z.string().trim().max(2000),
  aspiration: z.string().trim().max(2000),
  surprise: z.string().trim().max(2000),
  startingPhrase: z.string().trim().max(500),
  valueProposition: z.object({
    who: z.string().trim().max(500),
    problem: z.string().trim().max(500),
    how: z.string().trim().max(500),
    result: z.string().trim().max(500),
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
 * Trilhas relevantes:
 *  - MP01 (Discovery de Marca Pessoal) → campos do bloco Discovery
 *  - MP03 (Proposta de Valor)          → valueProposition estruturada
 *
 * As CHAVES (`convergence`, `aspiration`, etc.) referem-se ao `id` de cada
 * <input-field> / <input-area> dentro do HTML do módulo `faca_voce_mesmo`
 * da trilha (ver `src/components/trilhas/player/workbook-parser.ts`).
 *
 * IMPORTANTE: quando criar/editar a trilha MP01 ou MP03 no Master, use estes
 * IDs exatos nos atributos `id` dos input tags pra o import funcionar. Se um
 * ID nao bate, o campo correspondente fica vazio (degrada graciosamente —
 * nao quebra o import).
 */
const WORKBOOK_FIELD_MAP = {
  // Trilha MP01 → bloco Discovery
  MP01: {
    convergence: 'mp1_convergence',
    aspiration: 'mp1_aspiration',
    surprise: 'mp1_surprise',
    startingPhrase: 'mp1_starting_phrase',
  },
  // Trilha MP03 → bloco Discovery.valueProposition
  MP03: {
    who: 'mp3_who',
    problem: 'mp3_problem',
    how: 'mp3_how',
    result: 'mp3_result',
  },
} as const;

export type ImportWorkbookPreview = {
  // Bloco preenchido a partir do workbook (vazio se nada bateu).
  discovery: Partial<PersonalBrandDiscovery>;
  // Quais trilhas foram encontradas/lidas.
  trailsFound: { code: string; trailId: string }[];
  // Quais codigos da trilha existem cadastrados mas o user nao respondeu.
  trailsNotAnswered: string[];
  // Codigos que nao tem trilha cadastrada (Master precisa criar).
  trailsMissing: string[];
};

export type ImportWorkbookResult =
  | { ok: true; preview: ImportWorkbookPreview }
  | { ok: false; error: string };

/**
 * Le os workbookResponses do colaborador pras trilhas relevantes (MP01,
 * MP03) e devolve um preview do que o import preencheria no PersonalBrand.
 * NAO grava — a tela mostra o diff e o user confirma o save (que vai via
 * `savePersonalBrand` normal).
 */
export async function previewWorkbookImport(
  idToken: string,
  userId: string,
): Promise<ImportWorkbookResult> {
  try {
    await requireSelf(idToken, userId);

    const codes = Object.keys(WORKBOOK_FIELD_MAP);
    const found: { code: string; trailId: string }[] = [];
    const missing: string[] = [];
    const notAnswered: string[] = [];

    // Resolve trilhas pelos codigos via collectionGroup (admin SDK).
    const codeToTrailId = new Map<string, string>();
    for (const code of codes) {
      if (!TRAIL_CODE_REGEX.test(code)) {
        missing.push(code);
        continue;
      }
      const snap = await adminDb
        .collectionGroup('trails')
        .where('code', '==', code)
        .limit(5)
        .get();

      // Filtra so trilhas globais (Boldfy)
      const globalDoc = snap.docs.find((d) => {
        const parentPath = d.ref.parent.parent?.path ?? '';
        return parentPath.startsWith('globalSessions/');
      });

      if (!globalDoc) {
        missing.push(code);
      } else {
        codeToTrailId.set(code, globalDoc.id);
        found.push({ code, trailId: globalDoc.id });
      }
    }

    // Le `workbookResponses` de cada trilha encontrada. O ID do doc segue
    // o padrao `{trailId}_{moduleId}` (varios modulos por trilha).
    const allAnswers: Record<string, Record<string, string | string[]>> = {};
    for (const { code, trailId } of found) {
      const wbSnap = await adminDb
        .collection('users')
        .doc(userId)
        .collection('workbookResponses')
        .where('trailId', '==', trailId)
        .get();

      if (wbSnap.empty) {
        notAnswered.push(code);
        continue;
      }
      // Mergeia respostas de todos os modulos da trilha (o mapping abaixo
      // procura por ID de campo individual; o `id` precisa ser unico
      // dentro da trilha pra isso funcionar sem ambiguidade).
      const merged: Record<string, string | string[]> = {};
      for (const docSnap of wbSnap.docs) {
        const respostas = (docSnap.data() as { respostas?: Record<string, string | string[]> }).respostas ?? {};
        Object.assign(merged, respostas);
      }
      allAnswers[code] = merged;
    }

    const pickString = (m: Record<string, string | string[]> | undefined, key: string): string | undefined => {
      if (!m) return undefined;
      const v = m[key];
      if (typeof v === 'string') return v.trim() || undefined;
      if (Array.isArray(v)) return v.join(', ').trim() || undefined;
      return undefined;
    };

    const mp1 = allAnswers.MP01;
    const mp3 = allAnswers.MP03;
    const mp1Map = WORKBOOK_FIELD_MAP.MP01;
    const mp3Map = WORKBOOK_FIELD_MAP.MP03;

    const discovery: Partial<PersonalBrandDiscovery> = {};
    if (mp1) {
      const conv = pickString(mp1, mp1Map.convergence);
      const asp = pickString(mp1, mp1Map.aspiration);
      const surp = pickString(mp1, mp1Map.surprise);
      const start = pickString(mp1, mp1Map.startingPhrase);
      if (conv) discovery.convergence = conv;
      if (asp) discovery.aspiration = asp;
      if (surp) discovery.surprise = surp;
      if (start) discovery.startingPhrase = start;
    }
    if (mp3) {
      const who = pickString(mp3, mp3Map.who);
      const problem = pickString(mp3, mp3Map.problem);
      const how = pickString(mp3, mp3Map.how);
      const result = pickString(mp3, mp3Map.result);
      if (who || problem || how || result) {
        discovery.valueProposition = {
          who: who ?? '',
          problem: problem ?? '',
          how: how ?? '',
          result: result ?? '',
        };
      }
    }

    return {
      ok: true,
      preview: {
        discovery,
        trailsFound: found,
        trailsNotAnswered: notAnswered,
        trailsMissing: missing,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
    return { ok: false, error: errorMessage };
  }
}
