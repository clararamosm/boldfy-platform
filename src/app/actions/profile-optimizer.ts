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
  profile: Pick<LinkedInProfileSuggestions, 'headline' | 'about' | 'topSkills' | 'experiences'>,
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
  const headlineHasPillar = containsPillarKeyword(profile.headline);
  const headlineIsGeneric =
    /^(ceo|cto|cmo|coo|founder|fundador|empreendedor|lider|líder|diretor|gerente|manager|vp)\s*$/i.test(
      profile.headline.trim(),
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
      score += 10;
    }
  }

  // Critério 2 — Sobre menciona pilares (25%)
  const aboutMentionsPillars = pillarsLower.filter((p) =>
    profile.about.toLowerCase().includes(p),
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
      fix: 'Declare os 2–3 tópicos sobre os quais você escreve no LinkedIn',
    });
  } else {
    issues.push({
      element: 'about',
      severity: 'high',
      description: 'Seção Sobre não menciona os pilares de conteúdo',
      fix: 'Inclua uma linha declarando os tópicos do seu conteúdo LinkedIn',
    });
  }

  // Critério 3 — Competências espelham pilares (25%)
  const matchedSkills = profile.topSkills.filter((s) => containsPillarKeyword(s)).length;
  const skillScore = Math.round((matchedSkills / 5) * 25);
  score += skillScore;
  if (matchedSkills < 3) {
    issues.push({
      element: 'skills',
      severity: matchedSkills < 2 ? 'high' : 'medium',
      description: `Apenas ${matchedSkills} de 5 competências estão alinhadas com os pilares de conteúdo`,
      fix: 'Substitua competências genéricas por termos que espelham seus tópicos de conteúdo',
    });
  }

  // Critério 4 — Cargo atual preenchido (15%)
  const currentExp = profile.experiences.find((e) => e.isCurrent);
  const currentDesc = currentExp?.rewrittenDescription || currentExp?.description || '';
  if (currentExp && currentDesc.trim().length > 20) {
    score += 15;
  } else if (currentExp) {
    score += 5;
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
      fix: 'Adicione um cargo atual. Se estiver em transição, use "Consultora Independente"',
    });
  }

  // Critério 5 — Sem dissonâncias críticas (10%)
  const highIssues = issues.filter((i) => i.severity === 'high').length;
  if (highIssues < 2) {
    score += 10;
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
  "about": string,  // Preservar parágrafos com \\n\\n entre eles — NÃO juntar em um bloco
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
// Extração de texto de PDF via unpdf
// ---------------------------------------------------------------------------

async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  const { extractText } = await import('unpdf');
  const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
  return Array.isArray(text) ? text.join('\n') : (text as string);
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
  "topSkills": string[],
  "featuredItems": [{ "title": string, "url": null, "imageUrl": null }],
  "headline": string | null,
  "about": string | null
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

  return {
    topSkills: Array.isArray(parsed.topSkills) ? parsed.topSkills : [],
    featuredItems: Array.isArray(parsed.featuredItems) ? parsed.featuredItems : [],
    headline: parsed.headline || null,
    about: parsed.about || null,
  };
}

// ---------------------------------------------------------------------------
// Converter current → edited inicial (cópia editável)
// ---------------------------------------------------------------------------

function currentToEditedInitial(current: LinkedInProfileCurrent): LinkedInProfileSuggestions {
  return {
    headline: current.headline,
    about: current.about,
    topSkills: current.topSkills,
    experiences: current.experiences.map((e) => ({
      ...e,
      action: 'keep' as const,
      rewrittenDescription: undefined,
    })),
    featuredItems: current.featuredItems.map((f) => ({
      title: f.title,
      ...(f.url != null ? { url: f.url } : {}),
      ...(f.imageUrl != null ? { imageUrl: f.imageUrl } : {}),
      action: 'keep' as const,
      rationale: '',
    })),
    semanticAlignment: { score: 0, passesAudit: false, issues: [] },
    editedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Processamento assíncrono do PDF + print opcional
// ---------------------------------------------------------------------------

async function processPdfInBackground(
  tlUserId: string,
  pdfBuffer: Buffer,
  screenshotBase64?: string,
  screenshotMimeType?: string,
): Promise<void> {
  const docRef = profileDocRef(tlUserId);
  console.log(`[profile-optimizer] Iniciando processamento para ${tlUserId}`);
  try {
    // Salvar PDF no Storage (opcional)
    try {
      const bucket = adminStorage.bucket();
      const file = bucket.file(`linkedinProfiles/${tlUserId}/profile.pdf`);
      await file.save(pdfBuffer, { contentType: 'application/pdf' });
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
      } catch (storageErr) {
        console.warn('[profile-optimizer] Storage indisponível para screenshot:', storageErr);
      }
    }

    // Extrair texto do PDF
    console.log('[profile-optimizer] Extraindo texto do PDF...');
    const pdfText = await extractTextFromPdfBuffer(pdfBuffer);

    // Prompt 1: extrair estrutura do perfil atual
    console.log('[profile-optimizer] Extraindo perfil do texto...');
    let current = await extractProfileFromPdfText(pdfText);

    // Enriquecer com dados do print (competências fixadas, destaque)
    if (screenshotBase64 && screenshotMimeType) {
      console.log('[profile-optimizer] Enriquecendo com print...');
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
      } catch (enrichErr) {
        console.warn('[profile-optimizer] Erro ao enriquecer com print:', enrichErr);
      }
    }

    // Calcular score do perfil atual
    const brandContext = await getBrandContext(tlUserId);
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

    // Criar edited inicial (cópia do current, pronto para edição pela estrategista)
    const editedInitial = currentToEditedInitial(current);

    await docRef.update({
      current,
      currentAlignment,
      edited: editedInitial,
      suggestions: null,
      status: 'ready',
    });
    console.log('[profile-optimizer] Processamento concluído! Score atual:', currentAlignment.score);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[profile-optimizer] ERRO:', errMsg);
    await docRef.update({ status: 'error', errorMessage: errMsg }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Server Actions públicas
// ---------------------------------------------------------------------------

/**
 * Upload do PDF do perfil (+ print opcional).
 * Extrai o perfil atual e cria uma cópia editável para a estrategista.
 * Não gera sugestões de IA — a estrategista edita manualmente.
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
      await docRef.update({ status: 'processing', edited: null, suggestions: null });
    }

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
 * Não recalcula o score — score é calculado apenas via calculateOptimizedScore.
 */
export async function saveProfileEdits(
  idToken: string,
  tlUserId: string,
  edited: LinkedInProfileSuggestions,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const caller = await requireAuth(idToken);
    if (caller.uid === tlUserId && caller.role === 'thoughtleader') {
      return { error: 'Thought Leaders não podem editar as sugestões de perfil.' };
    }
    await requireProfileAccess(idToken, tlUserId);

    await profileDocRef(tlUserId).update({
      edited: { ...edited, editedAt: new Date().toISOString() },
      editedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return { error: message };
  }
}

/**
 * Calcula (ou recalcula) o score 360Brew para o perfil editado.
 * Chamado explicitamente pela estrategista ao clicar em "Gerar score".
 * Salva o score no campo edited.semanticAlignment e retorna o resultado.
 */
export async function calculateOptimizedScore(
  idToken: string,
  tlUserId: string,
  edited: LinkedInProfileSuggestions,
): Promise<{ alignment?: ProfileSemanticAlignment; error?: string }> {
  try {
    await requireProfileAccess(idToken, tlUserId);

    const brandContext = await getBrandContext(tlUserId);
    const contentPillars: string[] = Array.isArray(brandContext.approvedTopics)
      ? (brandContext.approvedTopics as string[])
      : [];

    const alignment = computeAlignmentScore(
      {
        headline: edited.headline,
        about: edited.about,
        topSkills: edited.topSkills,
        experiences: edited.experiences,
      },
      contentPillars,
    );

    // Persiste o score no edited
    const updatedEdited: LinkedInProfileSuggestions = {
      ...edited,
      semanticAlignment: alignment,
      editedAt: new Date().toISOString(),
    };

    await profileDocRef(tlUserId).update({
      edited: updatedEdited,
      editedAt: updatedEdited.editedAt,
    });

    return { alignment };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return { error: message };
  }
}

/**
 * Publica o perfil editado para o TL ver.
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
    if (!data.edited) {
      return { error: 'Nenhuma versão editada disponível para publicar.' };
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
 * Reseta todos os dados do otimizador de perfil para o estado vazio.
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
 * Upload de foto de perfil ou banner para o Storage.
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
      console.warn(`[profile-optimizer] Storage indisponível para ${type}:`, storageErr);
    }

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
