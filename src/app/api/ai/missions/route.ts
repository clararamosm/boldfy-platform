export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ai } from "@/ai/genkit";
import { auth as adminAuth, db as adminDb } from "@/lib/firebase-admin";
import { checkRateLimit } from "@/lib/rate-limit";

const MissionsSchema = z.object({
  brandContext: z.record(z.unknown()).optional(),
  companyName: z.string().min(1).max(200).optional(),
  locale: z.enum(["en", "pt-BR"]).default("pt-BR"),
});

export async function POST(req: NextRequest) {
  try {
    // Verificar autenticacao + role (only admins/masters can generate missions)
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    let uid: string;
    try {
      const decoded = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
      uid = decoded.uid;
    } catch {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    // Rate limiting: 5 requests per minute for mission generation
    const rateCheck = checkRateLimit(`ai-missions:${uid}`, 5, 60_000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Try again later.", retryAfterMs: rateCheck.retryAfterMs },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rateCheck.retryAfterMs / 1000)) } }
      );
    }

    // Verify user is admin or master (only they can generate missions)
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 403 });
    }
    const userData = userDoc.data();
    const role = userData?.role;
    if (!role || !['admin', 'master'].includes(role)) {
      return NextResponse.json({ error: "Insufficient permissions — admin required" }, { status: 403 });
    }

    // Ensure user belongs to a company
    if (!userData?.companyId && role !== 'master') {
      return NextResponse.json({ error: "User has no associated company" }, { status: 403 });
    }

    // Validate input
    const rawBody = await req.json();
    const parsed = MissionsSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }
    const { brandContext, companyName, locale } = parsed.data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bc = (brandContext || {}) as Record<string, any>;
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
    const aiResult = JSON.parse(cleanText);

    return NextResponse.json(aiResult);
  } catch (error) {
    console.error("Error generating missions:", error);
    return NextResponse.json(
      { error: "Failed to generate missions" },
      { status: 500 }
    );
  }
}
