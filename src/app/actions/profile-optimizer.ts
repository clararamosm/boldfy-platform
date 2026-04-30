'use server';

import { db as adminDb, storage as adminStorage } from '@/lib/firebase-admin';
import { requireAuth, requireStrategistForTL, requireMaster } from '@/lib/auth-guard';
import { ai } from '@/ai/genkit';
import type {
  LinkedInProfileOptimization,
  LinkedInProfileCurrent,
  LinkedInProfileSuggestions,
  ProfileExperience,
  ProfileFeaturedItem,
  ProfileAlignmentIssue,
  ProfileSemanticAlignment,
} from '@/lib/linkedin-analytics-types';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const TRAINING_DOC = `
# REGRAS DE OTIMIZAÇÃO — ALGORITMO 360BREW DO LINKEDIN (Boldfy 2026)

## Contexto
O algoritmo 360Brew executa uma auditoria de pré-distribuição antes de qualquer post chegar a alguém.
O perfil é um documento de treinamento de IA que determina se o conteúdo é distribuído ou suprimido.

## 1. HEADLINE
Fórmula: [Resultado claro / Problema que resolve] | [Cargo/Papel] | [Palavras-chave do nicho/metodologia]
- Tom: neutro focado em ação, verbos no gerúndio/infinitivo ("Ajudando", "Construindo"). Sem "eu" nem terceira pessoa.
- Exemplos aprovados: "Ajudando empresas SaaS a aumentar a receita | Estratégia de Conteúdo e Crescimento", "Geração de demanda B2B SaaS para startups Series A-C", "I help overlooked leaders become impossible to ignore"
- PROIBIDO: Buzzwords ("Visionário", "Inovador", "Apaixonado"), cargos isolados ("CEO", "Empreendedor"), promessas vagas ("Ajudando empresas a crescer")

## 2. SEÇÃO SOBRE
Estrutura obrigatória:
1. Gancho/Problema: problema real de negócios que o TL resolve
2. Metodologia/Palavras-chave: termos técnicos específicos do nicho
3. Prova/Resultados: casos reais, números concretos — sem adjetivos vazios
4. Pilares de conteúdo: mencionar explicitamente os 2–3 tópicos sobre os quais o TL escreve no LinkedIn
5. CTA: convidar o público-alvo a seguir o perfil
- Formatação: parágrafos curtos (máx 3–4 frases), sem blocos corridos. Primeira pessoa.
- PROIBIDO: texto corrido, narrativa vaga, buzzwords, omitir os pilares de conteúdo

## 3. COMPETÊNCIAS
- Sempre 5 (máximo do LinkedIn)
- Prioridade única: espelhar os pilares de conteúdo. Competência fora do nicho = penalidade.
- Idioma: mesma língua dos posts e do ICP
- REMOVER: competências genéricas ("Marketing", "Liderança"), de carreiras passadas sem relação com nicho atual

## 4. EXPERIÊNCIAS
Estrutura: [Contexto breve] → [Ação concreta] → [Resultado em número]
- Cargo atual: SEMPRE preencher. Vazio = gap semântico fatal.
- Experiências antigas: enxutas, filtradas, só o que suporta o nicho atual
- Pessoa: primeira pessoa ativa ("Liderei...", "Escalei...", "Construí...")
- PROIBIDO: "Responsável por...", "Atuei como...", "Fui encarregado de..."

## 5. DESTAQUE (Featured)
- Padrão Boldfy: 2 itens. Item 1 = book a call (conversão). Item 2 = material rico (autoridade).
- SEM descrição — 1 clique direto para o link.
- Título pode ser reescrito para ser mais atrativo.

## 6. GAP ANALYSIS
- Tom: direto, diagnóstico técnico, sem rodeios
- Priorizar por impacto no algoritmo, não por facilidade de correção
- Erros críticos: (1) Identity Mismatch — perfil fala de X, posts falam de Y; (2) Cargo atual em branco

## 7. REGRAS GERAIS
- SEMPRE: usar pilares de conteúdo como bússola semântica
- NUNCA: buzzwords, linguagem corporativa engessada, texto genérico, inventar números
- Teste: "Isso poderia ser de qualquer outro profissional, ou é claramente desta pessoa neste nicho?"
`;

// ---------------------------------------------------------------------------
// Helpers de acesso
// ---------------------------------------------------------------------------

async function requireProfileAccess(idToken: string, tlUserId: string): Promise<void> {
  const caller = await requireAuth(idToken);
  if (caller.uid === tlUserId) return;
  if (caller.role === 'master') return;
  if (caller.role === 'admin') {
    const tlDoc = await adminDb.collection('users').doc(tlUserId).get();
    const tlCompanyId = tlDoc.data()?.companyId;
    if (caller.companyId && caller.companyId === tlCompanyId) return;
    throw new Error('Acesso negado: usuário não pertence à sua empresa.');
  }
  if (caller.role === 'strategist') {
    await requireStrategistForTL(idToken, tlUserId);
    return;
  }
  throw new Error('Acesso negado.');
}

function profileDocRef(tlUserId: string) {
  return adminDb
    .collection('users')
    .doc(tlUserId)
    .collection('linkedinProfile')
    .doc('current');
}

// ---------------------------------------------------------------------------
// Score determinístico 360Brew
// ---------------------------------------------------------------------------

function computeAlignmentScore(
  suggestions: Pick<LinkedInProfileSuggestions, 'headline' | 'about' | 'topSkills' | 'experiences'>,
  contentPillars: string[],
): ProfileSemanticAlignment {
  const issues: ProfileAlignmentIssue[] = [];
  let score = 0;

  const pillarsLower = contentPillars.map((p) => p.toLowerCase());

  function containsPillarKeyword(text: string): boolean {
    const textLow = text.toLowerCase();
    return pillarsLower.some((p) => textLow.includes(p) || p.includes(textLow.slice(0, 20)));
  }

  // Critério 1 — Headline (25%)
  const headlineHasPillar = containsPillarKeyword(suggestions.headline);
  const headlineIsGeneric =
    /^(ceo|cto|cmo|coo|founder|fundador|empreendedor|lider|líder|diretor|gerente|manager|vp)\s*$/i.test(
      suggestions.headline.trim(),
    );
  if (headlineHasPillar && !headlineIsGeneric) {
    score += 25;
  } else {
    if (headlineIsGeneric) {
      issues.push({
        element: 'headline',
        severity: 'high',
        description: 'Headline genérico — não declara nicho nem resultado',
        fix: 'Use a fórmula: [Resultado claro] | [Cargo] | [Palavras-chave do nicho]',
      });
    } else {
      issues.push({
        element: 'headline',
        severity: 'medium',
        description: 'Headline não reflete os pilares de conteúdo do TL',
        fix: 'Inclua termos específicos do nicho alinhados com os temas dos posts',
      });
      score += 10; // parcial
    }
  }

  // Critério 2 — Sobre menciona pilares (25%)
  const aboutMentionsPillars = pillarsLower.filter((p) =>
    suggestions.about.toLowerCase().includes(p),
  ).length;
  const pillarRatio = contentPillars.length > 0 ? aboutMentionsPillars / contentPillars.length : 0;
  if (pillarRatio >= 0.66) {
    score += 25;
  } else if (pillarRatio >= 0.33) {
    score += 12;
    issues.push({
      element: 'about',
      severity: 'medium',
      description: 'Seção Sobre menciona poucos pilares de conteúdo explicitamente',
      fix: 'Declare os 2–3 tópicos sobre os quais você escreve no LinkedIn (ex: "Aqui escrevo sobre X, Y e Z")',
    });
  } else {
    issues.push({
      element: 'about',
      severity: 'high',
      description: 'Seção Sobre não menciona os pilares de conteúdo',
      fix: 'Inclua uma linha declarando os tópicos do seu conteúdo LinkedIn — isso é obrigatório para o algoritmo',
    });
  }

  // Critério 3 — Competências espelham pilares (25%)
  const matchedSkills = suggestions.topSkills.filter((s) => containsPillarKeyword(s)).length;
  const skillScore = Math.round((matchedSkills / 5) * 25);
  score += skillScore;
  if (matchedSkills < 3) {
    issues.push({
      element: 'skills',
      severity: matchedSkills < 2 ? 'high' : 'medium',
      description: `Apenas ${matchedSkills} de 5 competências estão alinhadas com os pilares de conteúdo`,
      fix: 'Substitua competências genéricas ou fora do nicho por termos que espelham seus tópicos de conteúdo',
    });
  }

  // Critério 4 — Cargo atual preenchido (15%)
  const currentExp = suggestions.experiences.find((e) => e.isCurrent);
  if (currentExp && currentExp.description && currentExp.description.trim().length > 20) {
    score += 15;
  } else if (currentExp && (!currentExp.description || currentExp.description.trim().length <= 20)) {
    score += 5; // tem cargo mas sem descrição
    issues.push({
      element: 'experience',
      severity: 'high',
      description: 'Cargo atual sem descrição — gap semântico fatal para o algoritmo',
      fix: 'Preencha com metodologias aplicadas, ferramentas utilizadas e problema de negócios que resolve',
    });
  } else {
    issues.push({
      element: 'experience',
      severity: 'high',
      description: 'Nenhum cargo atual identificado no perfil',
      fix: 'Adicione um cargo atual. Se estiver em transição, use "Consultora Independente" ou "Pausa na Carreira"',
    });
  }

  // Critério 5 — Sem dissonâncias críticas (10%)
  const highIssues = issues.filter((i) => i.severity === 'high').length;
  const identityMismatch = highIssues >= 2;
  if (!identityMismatch) {
    score += 10;
  } else {
    // -10% por Identity Mismatch (já está implícito por não somar)
  }

  const finalScore = Math.min(100, Math.max(0, score));

  return {
    score: finalScore,
    passesAudit: finalScore >= 40,
    issues,
  };
}

// ---------------------------------------------------------------------------
// Extração do perfil a partir do texto do PDF
// ---------------------------------------------------------------------------

async function extractProfileFromPdfText(pdfText: string): Promise<LinkedInProfileCurrent> {
  const prompt = `Você vai receber o texto bruto exportado de um perfil do LinkedIn em PDF.
Extraia as informações e retorne um JSON válido com a estrutura abaixo.
Não invente dados. Use exatamente o que está no texto.

ESTRUTURA ESPERADA:
{
  "headline": string,
  "about": string,  // Preservar parágrafos com \n\n entre eles — NÃO juntar em um bloco
  "topSkills": string[],  // máx 5, seção "Principais competências" ou "Top Skills"
  "experiences": [
    {
      "title": string,
      "company": string,
      "period": string,  // ex: "jan. de 2022 – o momento"
      "description": string,
      "isCurrent": boolean  // true se period contém "momento", "present", "atual"
    }
  ],
  "featuredItems": [
    {
      "title": string,
      "url": string | null,
      "imageUrl": null
    }
  ]
}

TEXTO DO PERFIL:
${pdfText.slice(0, 12000)}

Retorne APENAS o JSON, sem markdown, sem explicações.`;

  const { text } = await ai.generate(prompt);
  const clean = text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
  const parsed = JSON.parse(clean);

  return {
    headline: parsed.headline || '',
    about: parsed.about || '',
    topSkills: Array.isArray(parsed.topSkills) ? parsed.topSkills.slice(0, 5) : [],
    experiences: Array.isArray(parsed.experiences) ? parsed.experiences : [],
    featuredItems: Array.isArray(parsed.featuredItems) ? parsed.featuredItems : [],
    extractedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Geração de sugestões pela IA
// ---------------------------------------------------------------------------

async function generateSuggestions(
  current: LinkedInProfileCurrent,
  brandContext: Record<string, unknown>,
  recentPostCaptions: string[],
  bestPracticesText: string,
): Promise<LinkedInProfileSuggestions> {
  const contentPillars: string[] = Array.isArray(brandContext.approvedTopics)
    ? (brandContext.approvedTopics as string[])
    : [];

  const prompt = `Você é especialista em otimização de perfil LinkedIn para fundadores e executivos B2B.
Sua missão é otimizar o perfil abaixo para passar na auditoria do algoritmo 360Brew do LinkedIn.

${TRAINING_DOC}

## BOAS PRÁTICAS BOLDFY
${bestPracticesText ? bestPracticesText.slice(0, 4000) : 'Não disponível.'}

## PERFIL ATUAL DO TL
Headline: ${current.headline}
Sobre: ${current.about}
Competências: ${current.topSkills.join(', ')}
Experiências:
${current.experiences
  .map(
    (e) =>
      `- ${e.title} @ ${e.company} (${e.period})${e.isCurrent ? ' [ATUAL]' : ''}: ${e.description || 'sem descrição'}`,
  )
  .join('\n')}

## BRAND CONTEXT
- Público-alvo (ICP): ${brandContext.targetAudience || 'não definido'}
- Posicionamento: ${brandContext.positioning || 'não definido'}
- Pilares de conteúdo: ${contentPillars.join(', ') || 'não definidos'}
- Proposta de valor: ${brandContext.valueProposition || 'não definida'}
- Tom de voz: ${brandContext.brandVoice || 'não definido'}

## POSTS RECENTES (últimos ${recentPostCaptions.length})
${recentPostCaptions.slice(0, 12).map((c, i) => `${i + 1}. ${c.slice(0, 200)}`).join('\n')}

## TAREFA
Gere sugestões de otimização para cada seção seguindo as regras do 360Brew acima.
- Para cada experiência: decida se 'keep' (já está ótima), 'rewrite' (precisa de reescrita) ou 'add_impact' (precisa só de números/impacto).
- Se action for 'rewrite' ou 'add_impact', preencha rewrittenDescription.
- Para o featured: sugira 2 itens — item 1 = book a call (placeholder de URL), item 2 = material rico relevante.
- O gapAnalysis deve ser um diagnóstico técnico direto em português, listando os 3–5 principais gaps do perfil ATUAL (não do otimizado).

Retorne um JSON válido com esta estrutura:
{
  "headline": string,
  "about": string,  // OBRIGATÓRIO: separar cada parágrafo com \n\n — máx 4 parágrafos curtos
  "topSkills": string[5],
  "experiences": [
    {
      "title": string,
      "company": string,
      "period": string,
      "description": string,
      "isCurrent": boolean,
      "action": "keep" | "rewrite" | "add_impact",
      "rewrittenDescription": string | undefined
    }
  ],
  "featuredItems": [
    {
      "title": string,
      "url": string | null,
      "imageUrl": null,
      "action": "keep" | "replace" | "add",
      "rationale": string
    }
  ],
  "gapAnalysis": string
}

Retorne APENAS o JSON, sem markdown, sem explicações.`;

  const { text } = await ai.generate(prompt);
  const clean = text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
  const parsed = JSON.parse(clean);

  // Calcular score determinístico
  const semanticAlignment = computeAlignmentScore(
    {
      headline: parsed.headline || '',
      about: parsed.about || '',
      topSkills: parsed.topSkills || [],
      experiences: parsed.experiences || [],
    },
    contentPillars,
  );

  return {
    headline: parsed.headline || '',
    about: parsed.about || '',
    topSkills: Array.isArray(parsed.topSkills) ? parsed.topSkills.slice(0, 5) : [],
    experiences: Array.isArray(parsed.experiences) ? parsed.experiences : [],
    featuredItems: Array.isArray(parsed.featuredItems) ? parsed.featuredItems : [],
    semanticAlignment,
    gapAnalysis: parsed.gapAnalysis || '',
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Extração de texto de PDF via pdfjs-dist (já presente no projeto)
// ---------------------------------------------------------------------------

async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  const { extractText } = await import('unpdf');
  const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
  return Array.isArray(text) ? text.join('\n') : (text as string);
}

// ---------------------------------------------------------------------------
// Buscar texto do PDF de boas práticas (Storage global)
// ---------------------------------------------------------------------------

async function getBestPracticesText(): Promise<string> {
  try {
    const bucket = adminStorage.bucket();
    const file = bucket.file('linkedinProfiles/global/best-practices.pdf');
    const [exists] = await file.exists();
    if (!exists) return '';

    const [buffer] = await file.download();
    return await extractTextFromPdfBuffer(buffer);
  } catch (err) {
    console.error('[profile-optimizer] Erro ao ler best-practices.pdf:', err);
    return '';
  }
}

// ---------------------------------------------------------------------------
// Buscar brand context da empresa do TL
// ---------------------------------------------------------------------------

async function getBrandContext(tlUserId: string): Promise<Record<string, unknown>> {
  const userDoc = await adminDb.collection('users').doc(tlUserId).get();
  const companyId = userDoc.data()?.companyId;
  if (!companyId) return {};

  const companyDoc = await adminDb.collection('companies').doc(companyId).get();
  const data = companyDoc.data();
  return (data?.brandContext ?? data?.branding ?? {}) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Buscar posts recentes do contentPipeline
// ---------------------------------------------------------------------------

async function getRecentPostCaptions(tlUserId: string): Promise<string[]> {
  try {
    const snap = await adminDb
      .collection('users')
      .doc(tlUserId)
      .collection('contentPipeline')
      .where('status', '==', 'postado')
      .orderBy('publishedAt', 'desc')
      .limit(12)
      .get();

    return snap.docs
      .map((d) => d.data().caption || d.data().title || '')
      .filter((c) => c.length > 0);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Processamento assíncrono do PDF + print opcional (roda em background)
// ---------------------------------------------------------------------------

async function processPdfInBackground(
  tlUserId: string,
  pdfBuffer: Buffer,
  screenshotBase64?: string,
  screenshotMimeType?: string,
): Promise<void> {
  const docRef = profileDocRef(tlUserId);
  console.log(`[profile-optimizer] Iniciando processamento para ${tlUserId}, buffer size: ${pdfBuffer.length}`);
  try {
    // Salvar PDF no Storage (opcional — não bloqueia o processamento se Storage não estiver configurado)
    try {
      const bucket = adminStorage.bucket();
      const file = bucket.file(`linkedinProfiles/${tlUserId}/profile.pdf`);
      await file.save(pdfBuffer, { contentType: 'application/pdf' });
      console.log('[profile-optimizer] PDF salvo no Storage');
    } catch (storageErr) {
      console.warn('[profile-optimizer] Storage indisponível, continuando sem salvar PDF:', storageErr);
    }

    // Salvar print no Storage (opcional)
    if (screenshotBase64 && screenshotMimeType) {
      try {
        const ext = screenshotMimeType.includes('png') ? 'png' : 'jpg';
        const bucket = adminStorage.bucket();
        const file = bucket.file(`linkedinProfiles/${tlUserId}/profile-screenshot.${ext}`);
        await file.save(Buffer.from(screenshotBase64, 'base64'), { contentType: screenshotMimeType });
        console.log('[profile-optimizer] Screenshot salvo no Storage');
      } catch (storageErr) {
        console.warn('[profile-optimizer] Storage indisponível, continuando sem salvar screenshot:', storageErr);
      }
    }

    // Extrair texto do PDF via unpdf
    console.log('[profile-optimizer] Extraindo texto do PDF...');
    const pdfText = await extractTextFromPdfBuffer(pdfBuffer);
    console.log(`[profile-optimizer] Texto extraído: ${pdfText.length} chars`);

    // Prompt 1: extrair estrutura do perfil atual
    console.log('[profile-optimizer] Executando Prompt 1 (extração)...');
    let current = await extractProfileFromPdfText(pdfText);
    console.log('[profile-optimizer] Prompt 1 concluído, headline:', current.headline?.slice(0, 50));

    // Se tiver print, enriquecer o current com dados da imagem (competências fixadas, destaque)
    if (screenshotBase64 && screenshotMimeType) {
      console.log('[profile-optimizer] Enriquecendo com dados do print...');
      try {
        const enriched = await extractDataFromScreenshot(screenshotBase64, screenshotMimeType);
        current = {
          ...current,
          ...(enriched.topSkills?.length > 0 ? { topSkills: enriched.topSkills } : {}),
          ...(enriched.featuredItems?.length > 0
            ? {
                featuredItems: enriched.featuredItems.map((f) => ({
                  title: f.title,
                  ...(f.url != null ? { url: f.url } : {}),
                  ...(f.imageUrl != null ? { imageUrl: f.imageUrl } : {}),
                })),
              }
            : {}),
          ...(enriched.headline ? { headline: enriched.headline } : {}),
          ...(enriched.about ? { about: enriched.about } : {}),
        };
        console.log('[profile-optimizer] Enriquecimento do print concluído, skills:', current.topSkills);
      } catch (enrichErr) {
        console.warn('[profile-optimizer] Erro ao enriquecer com print, continuando:', enrichErr);
      }
    }

    await docRef.update({ current, status: 'processing' });

    // Buscar contextos necessários para o Prompt 2
    console.log('[profile-optimizer] Buscando brand context e posts...');
    const [brandContext, recentCaptions, bestPracticesText] = await Promise.all([
      getBrandContext(tlUserId),
      getRecentPostCaptions(tlUserId),
      getBestPracticesText(),
    ]);
    console.log(`[profile-optimizer] Brand context ok, posts: ${recentCaptions.length}`);

    // Calcular score do perfil ATUAL (antes da otimização)
    const contentPillars: string[] = Array.isArray(brandContext.approvedTopics)
      ? (brandContext.approvedTopics as string[])
      : [];
    const currentAlignment = computeAlignmentScore(
      {
        headline: current.headline,
        about: current.about,
        topSkills: current.topSkills,
        experiences: current.experiences.map((e) => ({ ...e, action: 'keep' as const })),
      },
      contentPillars,
    );
    console.log('[profile-optimizer] Score do perfil atual calculado:', currentAlignment.score);

    // Prompt 2: gerar sugestões
    console.log('[profile-optimizer] Executando Prompt 2 (sugestões)...');
    const suggestions = await generateSuggestions(
      current,
      brandContext,
      recentCaptions,
      bestPracticesText,
    );
    console.log('[profile-optimizer] Prompt 2 concluído, score:', suggestions.semanticAlignment?.score);

    await docRef.update({
      current,
      currentAlignment,
      suggestions,
      status: 'ready',
    });
    console.log('[profile-optimizer] Processamento concluído com sucesso!');
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errStack = err instanceof Error ? err.stack : '';
    console.error('[profile-optimizer] ERRO no processamento:', errMsg);
    console.error('[profile-optimizer] Stack:', errStack);
    await docRef.update({ status: 'error', errorMessage: errMsg }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Server Actions públicas
// ---------------------------------------------------------------------------

/**
 * Upload do PDF do perfil (+ print opcional) + dispara extração e geração de sugestões em background.
 * Retorna imediatamente com status 'processing'.
 * screenshotBase64/screenshotMimeType: print do perfil LinkedIn (opcional) — a IA usa para extrair
 * as 5 competências fixadas e os cards de Destaque que não aparecem corretamente no PDF.
 */
export async function uploadProfilePdf(
  idToken: string,
  tlUserId: string,
  pdfBase64: string,
  screenshotBase64?: string,
  screenshotMimeType?: string,
): Promise<{ success?: boolean; error?: string }> {
  try {
    await requireProfileAccess(idToken, tlUserId);

    const caller = await requireAuth(idToken);
    // TL não pode fazer upload do próprio PDF — apenas estrategista/admin/master
    if (caller.uid === tlUserId && caller.role === 'thoughtleader') {
      return { error: 'Apenas a estrategista pode enviar o PDF do perfil.' };
    }

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    const docRef = profileDocRef(tlUserId);
    const doc = await docRef.get();

    if (!doc.exists) {
      await docRef.set({
        current: null,
        suggestions: null,
        edited: null,
        editedAt: null,
        status: 'processing',
        publishedAt: null,
      });
    } else {
      await docRef.update({ status: 'processing', suggestions: null });
    }

    // Disparar processamento em background (não await)
    processPdfInBackground(tlUserId, pdfBuffer, screenshotBase64, screenshotMimeType).catch((err) =>
      console.error('[profile-optimizer] processPdfInBackground error:', err),
    );

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return { error: message };
  }
}

/**
 * Retorna o documento completo do otimizador de perfil.
 */
export async function getLinkedInProfile(
  idToken: string,
  tlUserId: string,
): Promise<{ profile?: LinkedInProfileOptimization; error?: string }> {
  try {
    await requireProfileAccess(idToken, tlUserId);

    const doc = await profileDocRef(tlUserId).get();

    if (!doc.exists) {
      const empty: LinkedInProfileOptimization = {
        current: null,
        suggestions: null,
        edited: null,
        editedAt: null,
        status: 'empty',
        publishedAt: null,
      };
      return { profile: empty };
    }

    return { profile: doc.data() as LinkedInProfileOptimization };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return { error: message };
  }
}

/**
 * Salva edições da estrategista (sem publicar para o TL).
 */
export async function saveProfileEdits(
  idToken: string,
  tlUserId: string,
  edited: LinkedInProfileSuggestions,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const caller = await requireAuth(idToken);
    // Só estrategista/admin/master pode editar
    if (caller.uid === tlUserId && caller.role === 'thoughtleader') {
      return { error: 'Thought Leaders não podem editar as sugestões de perfil.' };
    }
    await requireProfileAccess(idToken, tlUserId);

    // Recalcular score com os dados editados
    const brandContext = await getBrandContext(tlUserId);
    const contentPillars: string[] = Array.isArray(brandContext.approvedTopics)
      ? (brandContext.approvedTopics as string[])
      : [];

    const semanticAlignment = computeAlignmentScore(
      {
        headline: edited.headline,
        about: edited.about,
        topSkills: edited.topSkills,
        experiences: edited.experiences,
      },
      contentPillars,
    );

    const editedWithScore: LinkedInProfileSuggestions = {
      ...edited,
      semanticAlignment,
    };

    await profileDocRef(tlUserId).update({
      edited: editedWithScore,
      editedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return { error: message };
  }
}

/**
 * Publica o perfil otimizado para o TL ver.
 * Usa a versão editada se existir, caso contrário usa as sugestões da IA.
 */
export async function publishProfile(
  idToken: string,
  tlUserId: string,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const caller = await requireAuth(idToken);
    if (caller.uid === tlUserId && caller.role === 'thoughtleader') {
      return { error: 'Thought Leaders não podem publicar o perfil diretamente.' };
    }
    await requireProfileAccess(idToken, tlUserId);

    const doc = await profileDocRef(tlUserId).get();
    if (!doc.exists) return { error: 'Perfil não encontrado.' };

    const data = doc.data() as LinkedInProfileOptimization;
    if (!data.suggestions && !data.edited) {
      return { error: 'Nenhuma sugestão disponível para publicar.' };
    }

    await profileDocRef(tlUserId).update({
      status: 'published',
      publishedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return { error: message };
  }
}

/**
 * Upload do PDF de boas práticas global (apenas master).
 */
export async function uploadBestPracticesPdf(
  idToken: string,
  pdfBase64: string,
): Promise<{ success?: boolean; error?: string }> {
  try {
    await requireMaster(idToken);

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const bucket = adminStorage.bucket();
    const file = bucket.file('linkedinProfiles/global/best-practices.pdf');
    await file.save(pdfBuffer, { contentType: 'application/pdf' });

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return { error: message };
  }
}

/**
 * Reseta todos os dados do otimizador de perfil para o estado vazio.
 * Permite começar um novo upload do zero.
 * Apenas estrategista/admin/master pode executar.
 */
export async function resetProfile(
  idToken: string,
  tlUserId: string,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const caller = await requireAuth(idToken);
    if (caller.uid === tlUserId && caller.role === 'thoughtleader') {
      return { error: 'Thought Leaders não podem resetar o perfil.' };
    }
    await requireProfileAccess(idToken, tlUserId);

    await profileDocRef(tlUserId).set({
      current: null,
      suggestions: null,
      edited: null,
      editedAt: null,
      status: 'empty',
      publishedAt: null,
      errorMessage: null,
      currentAlignment: null,
      avatarUrl: null,
      bannerUrl: null,
    });

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return { error: message };
  }
}

/**
 * Recalcula o score de alinhamento 360Brew para o perfil editado/sugerido atual.
 * Útil para recalcular em tempo real no editor sem salvar.
 */
export async function recalculateAlignmentScore(
  idToken: string,
  tlUserId: string,
  partial: Pick<LinkedInProfileSuggestions, 'headline' | 'about' | 'topSkills' | 'experiences'>,
): Promise<{ alignment?: ProfileSemanticAlignment; error?: string }> {
  try {
    await requireProfileAccess(idToken, tlUserId);
    const brandContext = await getBrandContext(tlUserId);
    const contentPillars: string[] = Array.isArray(brandContext.approvedTopics)
      ? (brandContext.approvedTopics as string[])
      : [];

    const alignment = computeAlignmentScore(partial, contentPillars);
    return { alignment };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return { error: message };
  }
}

/**
 * Upload de foto de perfil ou banner para o Storage.
 * type: 'avatar' | 'banner'
 * imageBase64: base64 da imagem (JPEG/PNG)
 * Returns: URL pública do arquivo no Storage (ou undefined se Storage não estiver configurado)
 */
export async function uploadProfileImage(
  idToken: string,
  tlUserId: string,
  type: 'avatar' | 'banner',
  imageBase64: string,
  mimeType: string,
): Promise<{ url?: string; error?: string }> {
  try {
    await requireProfileAccess(idToken, tlUserId);

    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    const buffer = Buffer.from(imageBase64, 'base64');

    let url: string | undefined;

    // Storage é opcional — se não configurado, não bloqueia
    try {
      const bucket = adminStorage.bucket();
      const filePath = `linkedinProfiles/${tlUserId}/${type}.${ext}`;
      const file = bucket.file(filePath);
      await file.save(buffer, {
        contentType: mimeType,
        metadata: { cacheControl: 'public, max-age=3600' },
      });
      await file.makePublic();
      url = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    } catch (storageErr) {
      console.warn(`[profile-optimizer] Storage indisponível para ${type}, continuando sem salvar:`, storageErr);
    }

    // Salvar URL no documento do perfil (só se tiver URL do Storage)
    if (url) {
      const docRef = profileDocRef(tlUserId);
      const doc = await docRef.get();
      if (doc.exists) {
        await docRef.update({ [`${type}Url`]: url });
      } else {
        await docRef.set({
          current: null, suggestions: null, edited: null,
          editedAt: null, status: 'empty', publishedAt: null,
          [`${type}Url`]: url,
        });
      }
    }

    return { url };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return { error: message };
  }
}

/**
 * Upload standalone do print do perfil LinkedIn (imagem).
 * Usado quando o print é enviado SEPARADAMENTE do PDF (ex: perfil já processado).
 * A IA extrai competências fixadas e destaque e faz merge com o current existente.
 * O processamento roda em background.
 */
export async function uploadProfileScreenshot(
  idToken: string,
  tlUserId: string,
  imageBase64: string,
  mimeType: string,
): Promise<{ success?: boolean; error?: string }> {
  try {
    await requireProfileAccess(idToken, tlUserId);

    const caller = await requireAuth(idToken);
    if (caller.uid === tlUserId && caller.role === 'thoughtleader') {
      return { error: 'Apenas a estrategista pode enviar o print do perfil.' };
    }

    // Salvar no Storage (opcional)
    try {
      const ext = mimeType.includes('png') ? 'png' : 'jpg';
      const buffer = Buffer.from(imageBase64, 'base64');
      const bucket = adminStorage.bucket();
      const filePath = `linkedinProfiles/${tlUserId}/profile-screenshot.${ext}`;
      const file = bucket.file(filePath);
      await file.save(buffer, { contentType: mimeType });
    } catch (storageErr) {
      console.warn('[profile-optimizer] Storage indisponível para screenshot, continuando:', storageErr);
    }

    // Enriquecer perfil existente com dados da imagem em background
    enrichProfileFromScreenshotInBackground(tlUserId, imageBase64, mimeType).catch((err) =>
      console.error('[profile-optimizer] enrichProfileFromScreenshotInBackground error:', err),
    );

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return { error: message };
  }
}

// ---------------------------------------------------------------------------
// Extração de dados de perfil a partir de uma imagem (print do LinkedIn)
// ---------------------------------------------------------------------------

interface ScreenshotExtractedData {
  topSkills: string[];
  featuredItems: Array<{ title: string; url: null; imageUrl: null }>;
  headline: string | null;
  about: string | null;
}

async function extractDataFromScreenshot(
  imageBase64: string,
  mimeType: string,
): Promise<ScreenshotExtractedData> {
  const prompt = `Você está vendo um print do perfil LinkedIn de uma pessoa.
Extraia APENAS as informações que são visíveis NA IMAGEM e retorne um JSON com:
{
  "topSkills": string[],        // As 5 competências fixadas no topo do perfil (seção "Principais competências" ou logo abaixo do Sobre). APENAS as fixadas, não todas.
  "featuredItems": [
    {
      "title": string,           // Título do card de Destaque
      "url": null,               // URL não é visível na imagem
      "imageUrl": null           // URL da imagem do card (não disponível no print)
    }
  ],
  "headline": string | null,    // Headline se visível, null caso contrário
  "about": string | null        // Início do Sobre se visível, null caso contrário
}

Se alguma seção não estiver visível na imagem, retorne array vazio ou null.
Retorne APENAS o JSON, sem markdown.`;

  const response = await ai.generate({
    messages: [
      {
        role: 'user',
        content: [
          { text: prompt },
          { media: { url: `data:${mimeType};base64,${imageBase64}`, contentType: mimeType } },
        ],
      },
    ],
  });

  const clean = response.text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
  const parsed = JSON.parse(clean);
  console.log('[profile-optimizer] Screenshot parsed, skills:', parsed.topSkills);

  return {
    topSkills: Array.isArray(parsed.topSkills) ? parsed.topSkills : [],
    featuredItems: Array.isArray(parsed.featuredItems) ? parsed.featuredItems : [],
    headline: parsed.headline || null,
    about: parsed.about || null,
  };
}

// ---------------------------------------------------------------------------
// Enriquecimento do perfil existente com dados do print (standalone — sem PDF)
// ---------------------------------------------------------------------------

async function enrichProfileFromScreenshotInBackground(
  tlUserId: string,
  imageBase64: string,
  mimeType: string,
): Promise<void> {
  const docRef = profileDocRef(tlUserId);
  console.log('[profile-optimizer] Enriquecendo perfil com screenshot standalone...');
  try {
    const enriched = await extractDataFromScreenshot(imageBase64, mimeType);

    const doc = await docRef.get();
    if (!doc.exists) return;

    const existing = doc.data() as { current?: Record<string, unknown> };
    const currentData = existing.current || {};

    const mergedCurrent = {
      ...currentData,
      ...(enriched.topSkills.length > 0 ? { topSkills: enriched.topSkills } : {}),
      ...(enriched.featuredItems.length > 0
        ? {
            featuredItems: enriched.featuredItems.map((f) => ({
              title: f.title,
              ...(f.url != null ? { url: f.url } : {}),
              ...(f.imageUrl != null ? { imageUrl: f.imageUrl } : {}),
            })),
          }
        : {}),
      ...(enriched.headline ? { headline: enriched.headline } : {}),
      ...(enriched.about ? { about: enriched.about } : {}),
    };

    await docRef.update({ current: mergedCurrent });
    console.log('[profile-optimizer] Perfil enriquecido com dados do screenshot standalone!');
  } catch (err) {
    console.error('[profile-optimizer] Erro ao enriquecer com screenshot:', err);
    // Não reverte status — enriquecimento é opcional
  }
}
