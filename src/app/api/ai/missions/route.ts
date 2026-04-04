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

    const { brandContext, companyName } = await req.json();

    const bc = brandContext || {};

    const prompt = `Voce e um especialista em employee advocacy e engajamento de colaboradores no LinkedIn.

CONTEXTO DA EMPRESA:
- Nome: ${companyName || 'Empresa'}
- Proposta de valor: ${bc.valueProposition || 'Nao informada'}
- Tagline: ${bc.tagline || 'Nao informada'}
- Palavras-chave do negocio: ${bc.businessKeywords?.join(', ') || 'Nao informadas'}
- Solucoes: ${bc.solutions?.join(', ') || 'Nao informadas'}
- Dores do publico-alvo: ${bc.targetPainPoints?.join(', ') || 'Nao informadas'}
- Publico-alvo: ${bc.targetAudience || 'Nao informado'}
- Topicos aprovados: ${bc.approvedTopics?.join(', ') || 'Nao informados'}

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
