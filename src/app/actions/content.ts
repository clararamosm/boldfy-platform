// src/app/actions/content.ts
'use server';

import { z } from 'zod';
import { db as adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth, requireSelf } from '@/lib/auth-guard';
import { requireActiveModuleByRole } from '@/lib/billing/module-gate';
import { ai } from '@/ai/genkit';
import { ensureAndRenewCredits, checkCreditsAvailable, consumeCredit } from '@/lib/ai-credits';
import {
  PROMPT_VERSION,
  LAYER_1_CONTENT_FIRST,
  LAYER_3_AI_PATTERNS_TO_AVOID,
  LAYER_5_FORM_DECISION,
  buildLayer4BrandContext,
  getLengthDirective,
  getFormatDirective,
  getLanguageDirective,
  type PersonalBrandContext,
  type CompanyBrandContext,
  type PostLength,
  type PostFormat,
  type Locale,
} from '@/lib/ai-prompt/system-prompt-knowledge';

// ---- Helpers ----

async function getCompanyProfile(companyId: string): Promise<Record<string, string>> {
  const companyDocSnap = await adminDb.collection("companies").doc(companyId).get();

  if (companyDocSnap.exists) {
    const data = companyDocSnap.data();
    const bc = data?.brandContext || data?.branding || {};
    const arrToStr = (v: unknown) => Array.isArray(v) ? v.join(', ') : (v as string || '');
    return {
      companyName: data?.companyName || '',
      valueProposition: bc.valueProposition || '',
      tagline: bc.tagline || '',
      businessKeywords: arrToStr(bc.businessKeywords),
      solutions: arrToStr(bc.solutions),
      targetPainPoints: arrToStr(bc.targetPainPoints),
      targetAudience: bc.targetAudience || bc.audience || '',
      approvedTopics: arrToStr(bc.approvedTopics),
      prohibitedPhrases: arrToStr(bc.prohibitedPhrases),
    };
  }
  throw new Error('Perfil da empresa não encontrado.');
}

async function getPersonalBranding(userId: string): Promise<Record<string, string>> {
  const userDocSnap = await adminDb.collection("users").doc(userId).get();

  if (userDocSnap.exists) {
    const data = userDocSnap.data();
    const arrToStr = (v: unknown) => Array.isArray(v) ? v.join(', ') : (v as string || '');
    return {
      authorName: data?.profile?.name || data?.name || '',
      position: data?.position || '',
      voice: data?.voice || '',
      expertise: data?.expertise || '',
      value: data?.value || '',
      languageStyle: data?.languageStyle || '',
      contentPillars: arrToStr(data?.contentPillars),
    };
  }
  return {
    authorName: '',
    position: '',
    voice: '',
    expertise: '',
    value: '',
    languageStyle: '',
    contentPillars: '',
  };
}

// ---- AI Content Alignment ----

const AlignContentActionSchema = z.object({
  content: z.string().min(1, { message: 'O conteúdo não pode estar vazio.' }),
  companyId: z.string(),
  userId: z.string(),
  format: z.enum(['linkedin', 'text-heavy', 'hybrid']),
  length: z.enum(['short', 'medium', 'long']),
});

type AlignContentState = {
  alignedContent?: string | null;
  error?: string | null;
};

export async function handleAlignContent(
  prevState: AlignContentState,
  formData: FormData
): Promise<AlignContentState> {
  try {
    const idToken = formData.get('idToken') as string;
    if (!idToken) return { error: 'Token de autenticação ausente.', alignedContent: null };

    let authUser;
    try {
      authUser = await requireAuth(idToken);
      await requireActiveModuleByRole(authUser);
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Erro de autenticação.', alignedContent: null };
    }

    const validatedData = AlignContentActionSchema.safeParse({
      content: formData.get('content'),
      companyId: formData.get('companyId'),
      userId: formData.get('userId'),
      format: formData.get('format'),
      length: formData.get('length'),
    });

    if (!validatedData.success) {
      return { error: validatedData.error.errors.map(e => e.message).join(', '), alignedContent: null };
    }

    const { content, companyId, userId, format, length } = validatedData.data;

    // Validate user can only access their own data
    if (authUser.uid !== userId) {
      return { error: 'Acesso negado: você só pode gerar conteúdo para si mesmo.', alignedContent: null };
    }

    // Validate user belongs to the company
    if (authUser.companyId !== companyId) {
      return { error: 'Acesso negado: você não pertence a esta empresa.', alignedContent: null };
    }

    // ── AI Credits: renew + check ──
    const credits = await ensureAndRenewCredits(userId);
    const creditCheck = checkCreditsAvailable(credits);
    if (!creditCheck.ok) {
      return { error: creditCheck.error, alignedContent: null };
    }

    const companyProfile = await getCompanyProfile(companyId);
    const personalBranding = await getPersonalBranding(userId);

    const systemPrompt = buildSystemPrompt({
      pb: personalBranding,
      cp: companyProfile,
      format,
      length,
    });

    // Call Genkit directly
    const { text: alignedContent } = await ai.generate({
      system: systemPrompt,
      prompt: content,
    });

    if (!alignedContent) {
      throw new Error('A IA não retornou conteúdo.');
    }

    // ── Consume 1 AI credit after successful generation ──
    await consumeCredit(userId, credits);

    if (userId) {
      adminDb.collection('users').doc(userId).collection('generatedContent').add({
        input: content,
        output: alignedContent,
        format,
        length,
        promptVersion: PROMPT_VERSION,
        starred: false,
        createdAt: FieldValue.serverTimestamp(),
      }).catch(err => console.error('Error saving generated content:', err));
    }

    return { alignedContent, error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
    return { error: `Ocorreu um erro ao alinhar o conteúdo: ${errorMessage}`, alignedContent: null };
  }
}

// ---- Generate Hook Options ----

type GenerateHooksInput = {
  idToken: string;
  content: string;
  companyId: string;
  userId: string;
  format: 'linkedin' | 'text-heavy' | 'hybrid';
  length: 'short' | 'medium' | 'long';
  locale?: 'pt-BR' | 'en';
};

type GenerateHooksResult = {
  hooks?: string[];
  error?: string;
};

export async function generateHooks(input: GenerateHooksInput): Promise<GenerateHooksResult> {
  try {
    if (!input.idToken) return { error: 'Token de autenticação ausente.' };

    let authUser;
    try {
      authUser = await requireAuth(input.idToken);
      await requireActiveModuleByRole(authUser);
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Erro de autenticação.' };
    }

    // Validate user can only access their own data
    if (authUser.uid !== input.userId) {
      return { error: 'Acesso negado: você só pode gerar conteúdo para si mesmo.' };
    }

    // Validate user belongs to the company
    if (authUser.companyId !== input.companyId) {
      return { error: 'Acesso negado: você não pertence a esta empresa.' };
    }

    // ── AI Credits: renew + check ──
    const credits = await ensureAndRenewCredits(input.userId);
    const creditCheck = checkCreditsAvailable(credits);
    if (!creditCheck.ok) {
      return { error: creditCheck.error };
    }

    const companyProfile = await getCompanyProfile(input.companyId);
    const personalBranding = await getPersonalBranding(input.userId);

    const systemPrompt = buildHooksSystemPrompt({
      pb: personalBranding,
      cp: companyProfile,
      locale: input.locale,
    });

    const { text } = await ai.generate({
      system: systemPrompt,
      prompt: `Gere 3 hooks para um post sobre: ${input.content}`,
    });

    if (!text) {
      return { error: 'A IA não retornou hooks.' };
    }

    // Parse the 3 hooks separated by ---
    const hooks = text
      .split('---')
      .map(h => h.trim())
      .filter(h => h.length > 0)
      .slice(0, 3);

    if (hooks.length === 0) {
      return { error: 'Não foi possível gerar hooks.' };
    }

    // NOTE: Credit is NOT consumed here — only when the full post is
    // generated (generateWithHook). This way 1 post = 1 credit.

    return { hooks };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
    return { error: `Erro ao gerar hooks: ${errorMessage}` };
  }
}

// ---- Generate Full Post with Selected Hook ----

type GenerateWithHookInput = {
  idToken: string;
  content: string;
  selectedHook: string;
  companyId: string;
  userId: string;
  format: 'linkedin' | 'text-heavy' | 'hybrid';
  length: 'short' | 'medium' | 'long';
  locale?: 'pt-BR' | 'en';
};

export async function generateWithHook(input: GenerateWithHookInput): Promise<AlignContentState> {
  try {
    if (!input.idToken) return { error: 'Token de autenticação ausente.', alignedContent: null };

    let authUser;
    try {
      authUser = await requireAuth(input.idToken);
      await requireActiveModuleByRole(authUser);
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Erro de autenticação.', alignedContent: null };
    }

    // Validate user can only access their own data
    if (authUser.uid !== input.userId) {
      return { error: 'Acesso negado: você só pode gerar conteúdo para si mesmo.', alignedContent: null };
    }

    // Validate user belongs to the company
    if (authUser.companyId !== input.companyId) {
      return { error: 'Acesso negado: você não pertence a esta empresa.', alignedContent: null };
    }

    // ── AI Credits: renew + check ──
    const credits = await ensureAndRenewCredits(input.userId);
    const creditCheck = checkCreditsAvailable(credits);
    if (!creditCheck.ok) {
      return { error: creditCheck.error, alignedContent: null };
    }

    const companyProfile = await getCompanyProfile(input.companyId);
    const personalBranding = await getPersonalBranding(input.userId);

    const systemPrompt = buildSystemPrompt({
      pb: personalBranding,
      cp: companyProfile,
      format: input.format,
      length: input.length,
      locale: input.locale,
    });

    const { text: alignedContent } = await ai.generate({
      system: systemPrompt,
      prompt: `HOOK OBRIGATÓRIO (use exatamente este hook como as primeiras linhas do post, sem alterar):
${input.selectedHook}

IDEIA DO AUTOR:
${input.content}

Gere o post COMPLETO começando com o hook acima. NÃO mude o hook. A estrutura do que vem depois do hook segue o raciocínio da Camada 5 (forma serve à ideia).`,
    });

    if (!alignedContent) {
      throw new Error('A IA não retornou conteúdo.');
    }

    // ── Consume 1 AI credit after successful generation ──
    await consumeCredit(input.userId, credits);

    if (input.userId) {
      adminDb.collection('users').doc(input.userId).collection('generatedContent').add({
        input: input.content,
        output: alignedContent,
        format: input.format,
        length: input.length,
        promptVersion: PROMPT_VERSION,
        starred: false,
        createdAt: FieldValue.serverTimestamp(),
      }).catch(err => console.error('Error saving generated content:', err));
    }

    return { alignedContent, error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
    return { error: `Erro ao gerar post: ${errorMessage}`, alignedContent: null };
  }
}

// ---- Shared prompt builders ----

/**
 * Monta o system prompt completo a partir das camadas de knowledge.
 * Estrutura: idioma + Camada 1 + Camada 3 + Camada 4 (dinâmica) + Camada 5 +
 * parametrização de tamanho/formato.
 *
 * A "anatomia obrigatória" antiga (5 seções fixas) foi removida — a estrutura
 * do post emerge da natureza da ideia conforme a Camada 5.
 */
type BuildSystemPromptArgs = {
  pb: PersonalBrandContext;
  cp: CompanyBrandContext;
  format: PostFormat;
  length: PostLength;
  locale?: Locale;
};

function buildSystemPrompt({ pb, cp, format, length, locale }: BuildSystemPromptArgs): string {
  return [
    getLanguageDirective(locale),
    LAYER_1_CONTENT_FIRST,
    LAYER_3_AI_PATTERNS_TO_AVOID,
    buildLayer4BrandContext(pb, cp),
    LAYER_5_FORM_DECISION,
    getLengthDirective(length),
    getFormatDirective(format),
  ].join('\n\n---\n\n');
}

/**
 * Prompt enxuto pra geração de 3 hooks (2 linhas cada).
 * Consome a Camada 3 (padrões anti-IA) pra que os hooks também escapem dos
 * padrões batidos. O brand context vai resumido — hooks usam só o essencial.
 */
type BuildHooksPromptArgs = {
  pb: PersonalBrandContext;
  cp: CompanyBrandContext;
  locale?: Locale;
};

function buildHooksSystemPrompt({ pb, cp, locale }: BuildHooksPromptArgs): string {
  const hookRules = `Você é um especialista em hooks para LinkedIn. Seu trabalho é gerar opções de hook (as 2 primeiras linhas de um post) que param o scroll e fazem a pessoa querer ler o resto.

REGRAS:
→ Cada hook tem EXATAMENTE 2 linhas. A primeira linha (L1) e a segunda linha (L2).
→ L1 e L2 juntas criam TENSÃO: L1 abre com um fato, provocação ou cenário. L2 contrasta, surpreende ou direciona.
→ Máximo ~40 caracteres por linha. Frases curtas e afiadas.
→ NUNCA use ** (bold), ## (headings), ou qualquer markdown. Texto puro.
→ NUNCA use hashtags. NUNCA use travessão (—).
→ Varie MUITO o estilo entre os 3 hooks. NÃO repita o mesmo padrão. Os 3 hooks precisam ser CONCEITUALMENTE DISTINTOS — não três variações da mesma ideia com palavras diferentes.
→ Use o repertório de hooks da Camada 5 como base: contraintuitivo/provocador, número específico + consequência, padrão observado em experiência, confissão honesta, stakeholder em risco, urgência com prazo. Cada hook deve cair em uma categoria diferente.
→ Os hooks devem considerar o tom de voz e a expertise do autor (CONTEXTO PESSOAL abaixo).

CONTEXTO DA MARCA (use sutilmente):
Empresa: ${cp.companyName || 'N/A'}
Tópicos aprovados: ${cp.approvedTopics || 'N/A'}

CONTEXTO PESSOAL:
Nome: ${pb.authorName || 'N/A'}
Cargo: ${pb.position || 'N/A'}
Tom de voz: ${pb.voice || 'N/A'}
Expertise: ${pb.expertise || 'N/A'}

FORMATO DE RESPOSTA:
Retorne EXATAMENTE 3 hooks separados por ---. Cada hook tem 2 linhas. Nada mais. Sem numeração, sem explicação, sem aspas.

Exemplo de formato:
Linha 1 do hook A
Linha 2 do hook A
---
Linha 1 do hook B
Linha 2 do hook B
---
Linha 1 do hook C
Linha 2 do hook C`;

  return [
    getLanguageDirective(locale),
    LAYER_3_AI_PATTERNS_TO_AVOID,
    LAYER_5_FORM_DECISION,
    hookRules,
  ].join('\n\n---\n\n');
}

// ---- Toggle Star on Generated Content ----

export async function toggleStarContent(idToken: string, userId: string, contentId: string, starred: boolean): Promise<{ success?: boolean; error?: string }> {
  try {
    await requireSelf(idToken, userId);
    await adminDb.collection('users').doc(userId).collection('generatedContent').doc(contentId).update({ starred });
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
    return { error: errorMessage };
  }
}
