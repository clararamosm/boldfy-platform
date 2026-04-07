import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/ai/genkit";
import { auth as adminAuth } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    // Verificar autenticacao
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
    } catch {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const { brandContext, companyName, locale } = await req.json();

    const bc = brandContext || {};
    const isEN = locale === 'en';

    const langDirective = isEN
      ? 'IMPORTANT: All output (mission names and descriptions) MUST be written in English.'
      : 'IMPORTANTE: Todo o output (nomes e descrições das missões) DEVE ser escrito em português brasileiro.';

    const notProvided = isEN ? 'Not provided' : 'Não informada';
    const notProvidedPlural = isEN ? 'Not provided' : 'Não informadas';
    const notProvidedMasc = isEN ? 'Not provided' : 'Não informado';
    const notProvidedMascPlural = isEN ? 'Not provided' : 'Não informados';

    const prompt = isEN
      ? `You are an expert in employee advocacy and LinkedIn engagement for corporate employees.

${langDirective}

COMPANY CONTEXT:
- Name: ${companyName || 'Company'}
- Value proposition: ${bc.valueProposition || notProvided}
- Tagline: ${bc.tagline || notProvided}
- Business keywords: ${bc.businessKeywords?.join(', ') || notProvidedPlural}
- Solutions: ${bc.solutions?.join(', ') || notProvidedPlural}
- Target audience pain points: ${bc.targetPainPoints?.join(', ') || notProvidedPlural}
- Target audience: ${bc.targetAudience || notProvidedMasc}
- Approved topics: ${bc.approvedTopics?.join(', ') || notProvidedMascPlural}

TASK:
Generate exactly 6 mission suggestions for this company's employees. Missions should encourage active LinkedIn presence and strengthen personal and corporate branding.

Vary between these types:
- Publish original content on LinkedIn (opinion, insight, learning)
- Engage with colleagues' posts (like, comment, share)
- Optimize LinkedIn profile (banner, headline, about section)
- Share a company case study or result
- Create educational content about the industry
- Interact with industry content (comment on thought leader posts)

For each mission, return:
- name: short and direct name (max 60 characters)
- description: clear description of what the employee needs to do (2-3 sentences, max 200 characters)
- points: suggested points (between 50 and 300, proportional to effort)

RESPONSE FORMAT:
Return ONLY valid JSON, no markdown, no explanation, in this format:
{"missions": [{"name": "...", "description": "...", "points": 100}, ...]}`
      : `Voce e um especialista em employee advocacy e engajamento de colaboradores no LinkedIn.

${langDirective}

CONTEXTO DA EMPRESA:
- Nome: ${companyName || 'Empresa'}
- Proposta de valor: ${bc.valueProposition || notProvided}
- Tagline: ${bc.tagline || notProvided}
- Palavras-chave do negocio: ${bc.businessKeywords?.join(', ') || notProvidedPlural}
- Solucoes: ${bc.solutions?.join(', ') || notProvidedPlural}
- Dores do publico-alvo: ${bc.targetPainPoints?.join(', ') || notProvidedPlural}
- Publico-alvo: ${bc.targetAudience || notProvidedMasc}
- Topicos aprovados: ${bc.approvedTopics?.join(', ') || notProvidedMascPlural}

TAREFA:
Gere exatamente 6 sugestoes de missoes para os colaboradores desta empresa. As missoes devem incentivar a presenca ativa no LinkedIn e o fortalecimento da marca pessoal e corporativa.

Varie entre estes tipos:
- Publicar conteudo original no LinkedIn (opiniao, insight, aprendizado)
- Engajar com posts de colegas (curtir, comentar, compartilhar)
- Otimizar perfil LinkedIn (banner, headline, sobre)
- Compartilhar case ou resultado da empresa
- Criar conteudo educacional sobre o setor
- Interagir com conteudo do setor (comentar em posts de referencia)

Para cada missao, retorne:
- name: nome curto e direto (max 60 caracteres)
- description: descricao clara do que o colaborador precisa fazer (2-3 frases, max 200 caracteres)
- points: pontos sugeridos (entre 50 e 300, proporcionais ao esforco)

FORMATO DE RESPOSTA:
Retorne APENAS um JSON valido, sem markdown, sem explicacao, neste formato:
{"missions": [{"name": "...", "description": "...", "points": 100}, ...]}`;

    const { text } = await ai.generate({ prompt });

    // Parse the JSON from the AI response
    const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanText);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Error generating missions:", error);
    return NextResponse.json(
      { error: "Failed to generate missions" },
      { status: 500 }
    );
  }
}
