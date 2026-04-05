'use server';

import { db as adminDb } from '@/lib/firebase-admin';
import { ai } from '@/ai/genkit';
import { requireAuth } from '@/lib/auth-guard';
import { FieldValue } from 'firebase-admin/firestore';

// ─── Types ────────────────────────────────────────────────────

export type HotTopic = {
  titulo: string;
  contexto: string;
  angulo: string;
};

export type HotTopicsData = {
  topics: HotTopic[];
  geradoEm: string;
  semana: string;
};

// ─── Get hot topics for a company ─────────────────────────────

export async function getHotTopics(
  idToken: string,
): Promise<{ data?: HotTopicsData; error?: string }> {
  try {
    const authUser = await requireAuth(idToken);
    if (!authUser.companyId) return { error: 'Empresa nao encontrada.' };

    const companyDoc = await adminDb.collection('companies').doc(authUser.companyId).get();
    if (!companyDoc.exists) return { error: 'Empresa nao encontrada.' };

    const data = companyDoc.data();
    const hotTopics = data?.hotTopics as HotTopicsData | undefined;

    if (!hotTopics || !hotTopics.topics?.length) {
      return { data: { topics: [], geradoEm: '', semana: '' } };
    }

    return { data: hotTopics };
  } catch (err) {
    console.error('Error fetching hot topics:', err);
    return { error: err instanceof Error ? err.message : 'Erro desconhecido' };
  }
}

// ─── Generate hot topics for a single company ─────────────────

export async function generateHotTopicsForCompany(
  companyId: string,
): Promise<{ topics: HotTopic[]; error?: string }> {
  try {
    const companyDoc = await adminDb.collection('companies').doc(companyId).get();
    if (!companyDoc.exists) return { topics: [], error: 'Empresa nao encontrada.' };

    const data = companyDoc.data();
    const bc = data?.brandContext || data?.branding || {};
    const arrToStr = (v: unknown) => Array.isArray(v) ? v.join(', ') : (v as string || '');

    const companyName = data?.companyName || '';
    const businessKeywords = arrToStr(bc.businessKeywords);
    const solutions = arrToStr(bc.solutions);
    const targetAudience = bc.targetAudience || bc.audience || '';
    const targetPainPoints = arrToStr(bc.targetPainPoints);
    const approvedTopics = arrToStr(bc.approvedTopics);

    // Need at least keywords or topics to generate
    if (!businessKeywords && !approvedTopics) {
      return { topics: [], error: 'Brand context incompleto — configure keywords ou topicos aprovados.' };
    }

    const now = new Date();
    const weekLabel = `${now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} - ${new Date(now.getTime() + 6 * 86400000).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`;

    const prompt = `Voce e um estrategista de conteudo B2B para LinkedIn.

Contexto da empresa:
- Nome: ${companyName}
- Setor/Keywords: ${businessKeywords || 'N/A'}
- Solucoes: ${solutions || 'N/A'}
- Publico-alvo: ${targetAudience || 'N/A'}
- Dores do publico: ${targetPainPoints || 'N/A'}
- Topicos aprovados: ${approvedTopics || 'N/A'}

Tarefa: Gere exatamente 6 topicos quentes e relevantes para o setor desta empresa nesta semana. Os topicos devem ser atuais, conversar com as dores do publico-alvo, e ser adequados para um colaborador postar no LinkedIn dando sua opiniao pessoal.

Para cada topico, forneca:
1. titulo: Frase curta e direta (max 8 palavras) que descreve o tema
2. contexto: 1-2 frases explicando por que esse tema esta em alta ou e relevante agora
3. angulo: Sugestao de angulo pessoal que o colaborador pode usar (ex: "Conte sua experiencia com...", "De sua opiniao sobre...")

IMPORTANTE:
- Nao repita os topicos aprovados literalmente — use-os como direcao mas traga angulos frescos
- Misture: 2 topicos de tendencia do setor, 2 sobre dores/desafios do publico, 2 sobre oportunidades/inovacao
- Seja especifico, nao generico. "IA no recrutamento" e melhor que "tecnologia"
- Linguagem em portugues BR, informal-profissional

Responda APENAS com JSON valido, sem markdown, sem explicacao. Formato:
[{"titulo":"...","contexto":"...","angulo":"..."},...]`;

    const { text } = await ai.generate({ prompt });

    if (!text) return { topics: [], error: 'IA nao retornou resposta.' };

    // Parse JSON — handle potential markdown wrapping
    let cleanText = text.trim();
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    let topics: HotTopic[];
    try {
      topics = JSON.parse(cleanText);
    } catch {
      console.error('Failed to parse AI response:', cleanText);
      return { topics: [], error: 'Erro ao processar resposta da IA.' };
    }

    if (!Array.isArray(topics) || topics.length === 0) {
      return { topics: [], error: 'IA retornou formato invalido.' };
    }

    // Validate and clean
    topics = topics.slice(0, 8).map(t => ({
      titulo: String(t.titulo || '').slice(0, 100),
      contexto: String(t.contexto || '').slice(0, 300),
      angulo: String(t.angulo || '').slice(0, 300),
    })).filter(t => t.titulo && t.contexto);

    // Save to company doc
    const hotTopicsData: HotTopicsData = {
      topics,
      geradoEm: now.toISOString(),
      semana: weekLabel,
    };

    await adminDb.collection('companies').doc(companyId).update({
      hotTopics: hotTopicsData,
      hotTopicsUpdatedAt: FieldValue.serverTimestamp(),
    });

    return { topics };
  } catch (err) {
    console.error(`Error generating hot topics for company ${companyId}:`, err);
    return { topics: [], error: err instanceof Error ? err.message : 'Erro desconhecido' };
  }
}

// ─── Admin trigger: regenerate hot topics ─────────────────────

export async function regenerateHotTopics(
  idToken: string,
): Promise<{ topics?: HotTopic[]; error?: string }> {
  try {
    const authUser = await requireAuth(idToken);
    if (!authUser.companyId) return { error: 'Empresa nao encontrada.' };
    if (authUser.role !== 'admin' && authUser.role !== 'master') {
      return { error: 'Apenas admins podem regenerar topicos.' };
    }

    const result = await generateHotTopicsForCompany(authUser.companyId);
    return result;
  } catch (err) {
    console.error('Error regenerating hot topics:', err);
    return { error: err instanceof Error ? err.message : 'Erro desconhecido' };
  }
}
