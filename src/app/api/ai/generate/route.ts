import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ai } from "@/ai/genkit";
import { auth as adminAuth, db as adminDb } from "@/lib/firebase-admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { FieldValue } from "firebase-admin/firestore";

const GenerateSchema = z.object({
  content: z.string().min(1, "Content is required").max(5000, "Content too long"),
  companyProfile: z.record(z.unknown()).optional(),
  personalBranding: z.record(z.unknown()).optional(),
  format: z.enum(["linkedin", "text-heavy", "hybrid"]).default("linkedin"),
  length: z.enum(["short", "medium", "long"]).default("medium"),
  locale: z.enum(["en", "pt-BR"]).default("pt-BR"),
});

// Default AI credits for new users
const DEFAULT_MONTHLY_CREDITS = 40;

/** Get next renewal date (1st of next month at 00:00 UTC) */
function getNextRenewalDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

export async function POST(req: NextRequest) {
  try {
    // Verificar autenticacao + role
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

    // Rate limiting: 10 requests per minute per user
    const rateCheck = checkRateLimit(`ai-generate:${uid}`, 10, 60_000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Try again later.", retryAfterMs: rateCheck.retryAfterMs },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rateCheck.retryAfterMs / 1000)) } }
      );
    }

    // Verify user exists and has a valid role
    const userRef = adminDb.collection('users').doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 403 });
    }
    const userData = userDoc.data();
    const role = userData?.role;
    if (!role || !['colaborador', 'admin', 'master'].includes(role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Ensure user belongs to a company
    if (!userData?.companyId && role !== 'master') {
      return NextResponse.json({ error: "User has no associated company" }, { status: 403 });
    }

    // Validate input with Zod
    const body = await req.json();
    const parsed = GenerateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }
    const { content, companyProfile, personalBranding, format, length, locale } = parsed.data;
    const isEN = locale === 'en';

    // ── AI Credits Check + Lazy Renewal ──
    let aiCredits = userData?.aiCredits as {
      remaining: number;
      bonusCredits: number;
      monthlyLimit: number;
      renewsAt: { toMillis?: () => number; _seconds?: number } | null;
      totalUsed: number;
    } | undefined;

    // Initialize credits if user has none yet
    if (!aiCredits) {
      aiCredits = {
        remaining: DEFAULT_MONTHLY_CREDITS,
        bonusCredits: 0,
        monthlyLimit: DEFAULT_MONTHLY_CREDITS,
        renewsAt: null,
        totalUsed: 0,
      };
      await userRef.update({
        aiCredits: {
          remaining: DEFAULT_MONTHLY_CREDITS,
          bonusCredits: 0,
          monthlyLimit: DEFAULT_MONTHLY_CREDITS,
          renewsAt: getNextRenewalDate(),
          totalUsed: 0,
        },
      });
    }

    // Lazy renewal: check if renewsAt has passed
    const renewsAtMs = aiCredits.renewsAt?.toMillis?.()
      ?? (aiCredits.renewsAt as { _seconds?: number })?._seconds
        ? (aiCredits.renewsAt as { _seconds: number })._seconds * 1000
        : null;

    if (renewsAtMs && Date.now() >= renewsAtMs) {
      // Reset monthly credits, keep bonusCredits
      aiCredits.remaining = aiCredits.monthlyLimit || DEFAULT_MONTHLY_CREDITS;
      const nextRenewal = getNextRenewalDate();
      await userRef.update({
        'aiCredits.remaining': aiCredits.remaining,
        'aiCredits.renewsAt': nextRenewal,
      });
    }

    // Check if user has credits (remaining + bonusCredits)
    const totalAvailable = (aiCredits.remaining || 0) + (aiCredits.bonusCredits || 0);
    if (totalAvailable <= 0) {
      const renewsAt = renewsAtMs || getNextRenewalDate().getTime();
      const daysUntilRenewal = Math.ceil((renewsAt - Date.now()) / (1000 * 60 * 60 * 24));
      return NextResponse.json(
        {
          error: "credits_exhausted",
          message: `Seus créditos de IA acabaram. Eles renovam em ${daysUntilRenewal} dia${daysUntilRenewal !== 1 ? 's' : ''}.`,
          renewsAt,
          daysUntilRenewal,
        },
        { status: 403 }
      );
    }

    // Extract company brand context fields (objects from actions.ts)
    const cp = companyProfile || {};
    const pb = personalBranding || {};

    const lengthGuide: Record<string, string> = {
      short: `Caption CURTA. Afiada e direta. Poucas linhas. O autor entra com opiniao forte, entrega o ponto e sai. Sem enrolacao, sem contexto excessivo. Ideal para provocacoes, tomadas de posicao e insights rapidos. A secao acionavel pode ser apenas 1-2 items ou pode ser omitida se nao fizer sentido. O bold statement fecha com impacto imediato.`,
      medium: `Caption MEDIA. Equilibra profundidade e agilidade. O hook puxa, o body desenvolve a narrativa com substancia mas sem se alongar, a secao acionavel traz valor concreto (2-3 items), e fecha com conclusao + bold statement. Sweet spot de 31-60 segundos de leitura no mobile.`,
      long: `Caption LONGA. Narrativa completa com todas as 5 secoes bem desenvolvidas. O hook abre com forca, o body conta a historia inteira com detalhes concretos e vividos, a secao acionavel aprofunda com 3-5 items de valor real (licoes, dicas, passos), a conclusao amarra o raciocinio, e o bold statement encerra com frase memoravel. 15-25 linhas no mobile. Para conteudo educacional denso, frameworks, e historias que precisam de espaco pra respirar.`,
    };

    const formatGuide: Record<string, string> = {
      linkedin: `FORMATO LINKEDIN (scroll-friendly, mobile-first):
A escrita precisa ter ritmo visual. Cada frase respira sozinha. O leitor escaneia antes de ler — entao cada linha precisa puxar pra proxima.
Regras de formatacao:
- 1 ideia por linha. Nunca empilhar 2 conceitos na mesma frase.
- Quebras de linha generosas entre blocos de pensamento. O espaco em branco e parte da comunicacao.
- Frases curtas e isoladas criam tensao e cadencia. Varie entre frases de 3-5 palavras e frases de 8-12 palavras.
- Bullet points e listas usam travessao (—) ou ponto simples, nunca emojis como marcadores.
- Cada bloco visual (2-4 linhas) deve ser separado por uma linha em branco.
- O texto deve parecer poetico no scroll — cada linha com peso proprio, como se pudesse existir sozinha.
- Nao e sobre ser raso. E sobre ser denso em poucas palavras. Cada linha carrega significado.
- Evite paragrafos de mais de 2 linhas. Se tem 3 linhas, quebre.`,
      "text-heavy": `FORMATO TEXTO DENSO (editorial, leitura continua):
A escrita flui como um ensaio ou artigo. Ideias conectadas em paragrafos completos, sem quebras artificiais.
Regras de formatacao:
- Paragrafos de 3-5 frases que desenvolvem um raciocinio inteiro antes de quebrar.
- As frases se conectam com transicoes naturais — uma ideia leva a proxima dentro do mesmo paragrafo.
- Nao usar listas, bullet points ou formatacao visual. O poder esta na argumentacao fluida.
- O ritmo e de leitura continua, como um editorial de revista ou uma carta pessoal.
- Cada paragrafo e um bloco de pensamento completo: abre, desenvolve, amarra.
- Use virgulas, ponto e virgula e conectivos pra criar cadencia dentro da frase. Frases mais longas sao bem-vindas quando o raciocinio pede.
- A separacao entre paragrafos e uma unica linha em branco (sem espacamento excessivo).
- O texto deve soar como alguem pensando em voz alta de forma articulada — profundo, conectado, sem pressa.`,
      hybrid: `FORMATO HIBRIDO (equilibrio entre visual e profundidade):
Meio-termo entre o formato LinkedIn e o texto denso. Paragrafos curtos mas completos, com listas ocasionais quando o conteudo pede.
Regras de formatacao:
- Paragrafos de 2-3 frases. Curtos o suficiente pra escanear, completos o suficiente pra desenvolver uma ideia.
- Use listas e bullet points com moderacao — apenas quando listar items realmente faz mais sentido que um paragrafo.
- Alterne entre blocos de texto fluido e momentos de formatacao visual. Nao seja 100% de nenhum dos dois.
- Quebras de linha entre paragrafos, mas sem o espacamento exagerado do formato LinkedIn.
- O ritmo e de conversa — direto mas nao telegrafado, articulado mas nao academico.
- Frases variam entre curtas (impacto) e medias (desenvolvimento). Evite frases muito longas.`,
    };

    const languageDirective = isEN
      ? `LANGUAGE: Write entirely in English. All output must be in English regardless of the input language.`
      : `LANGUAGE: Write entirely in Brazilian Portuguese. All output must be in Brazilian Portuguese regardless of the input language.`;

    const systemPrompt = `${languageDirective}

Voce e um assistente de criacao de captions para LinkedIn. Seu objetivo e ajudar o autor a criar captions de alta performance que alinham a marca corporativa da empresa com a autenticidade da marca pessoal do autor.

Voce NUNCA fala da marca de forma explicita ou forcada. Voce tece a marca dentro da narrativa pessoal do autor, de forma organica.
Voce so gera captions (legendas de texto). Nao gera designs, carousels, nem instrucoes visuais.

---

## CAMADA 1: MELHORES PRATICAS DE LINKEDIN

### Regras do algoritmo 360Brew:
- Salvamentos sao o sinal mais forte. O conteudo precisa ser util o suficiente pra alguem guardar.
- Tempo de leitura ideal: 31-60 segundos. Denso mas escaneavel.
- Comentarios de 15+ palavras valem 5,2x mais que curtida. Provoque reflexao, nao engajamento vazio.
- Copy com padrao de IA e penalizado. Siga as regras anti-padrao abaixo.
- Links externos cortam 60% do alcance. Nunca inclua links na caption.
- NUNCA usar hashtags. Sem excecao. Use keywords e contexto semantico no corpo do texto para indexacao organica.

### Anatomia da caption:

**1. Hook (2 linhas, max ~40 caracteres cada):**
- Targeta a audiencia, ativa curiosidade, da overview sem entregar.
- Use tensao entre L1 e L2 (fato + contraste).
- Varie o estilo de hook. Nunca repetir o mesmo padrao em captions consecutivas.

**2. Body (narrativa — sem quantidade fixa de paragrafos):**
O tamanho e a estrutura do body dependem do conteudo e do FORMATO selecionado. Adapte livremente. Principios universais:
- Escrever mais com menos. Cada frase precisa justificar sua existencia.
- Tom de conversa entre profissionais. Contracoes naturais, cadencia irregular.
- Situacoes concretas > abstracoes. Exemplos reais > teorias genericas.
- A formatacao visual (quebras de linha, listas, tamanho de paragrafo) e definida pelo FORMATO selecionado na secao "FORMATO E TAMANHO". Siga rigorosamente as regras do formato escolhido.
- Ferramentas de formatacao disponiveis (use conforme o formato permitir):
  * Paragrafos sequenciais (narrativa fluida)
  * Bullet points com travessao (—) para listar ideias, aprendizados ou exemplos
  * Listas numeradas quando ha ordem ou hierarquia
  * Listas minimalistas (uma palavra ou frase curta por item)
  * Listas com pouca descricao (item + frase de contexto)
  * Mix de estilos dentro da mesma caption
- IMPORTANTE: No formato "texto denso", NAO use listas ou bullet points. No formato "linkedin", use formatacao visual generosamente. No formato "hibrido", use com moderacao.

**3. Secao acionavel (apos a narrativa):**
Depois de contar a historia ou expor a opiniao, traga algo pratico. Escolha o que fizer mais sentido:
- Licoes aprendidas com a experiencia narrada
- Dicas de como aplicar o que foi contado
- Passos praticos ou framework simples
- Perguntas de reflexao genuinas (nao genericas)
Esta secao e o que faz o conteudo ser salvo. Precisa ter valor real.

**4. Conclusao (encerramento):**
- Statement forte com opiniao ou direcao clara.
- NUNCA perguntas genericas de engajamento ("e voce?", "concorda?", "comenta aqui").
- Pode ser um convite a acao genuino, uma reflexao final ou um posicionamento firme.

**5. Bold statement (frase de impacto final):**
- Encerre com uma frase curta e marcante que resume a essencia do post.
- Funciona como assinatura do conteudo. Deve ser memoravel e compartilhavel.

### Padroes PROIBIDOS (anti-IA):
- Contrastes binarios artificiais ("[Negacao]. [Afirmacao].")
- Frases dramaticas vazias ("A verdade e:", "Deixe isso afundar")
- Repeticoes em serie ("Mais X. Mais Y. Mais Z.")
- Regra de tres forcada (varie: use 2, 4, ou quantidades assimetricas)
- Conclusao que repete a introducao
- Vocabulario inflado: "crucial", "fundamental", "no cenario atual", "jornada", "transformador", "destaca-se", "fomenta", "impulsiona"
- Gerundios de analise superficial ("demonstrando...", "reforcando...")
- Hashtags em qualquer lugar da caption

---

## CAMADA 2: BRAND CONTEXT CORPORATIVO

Dados da empresa do autor. Teca a marca corporativa na narrativa de forma organica — nunca explicita, nunca forcada.

Empresa: ${cp.companyName || 'N/A'}
Proposta de valor: ${cp.valueProposition || 'N/A'}
Tagline: ${cp.tagline || 'N/A'}
Keywords de negocio: ${cp.businessKeywords || 'N/A'}
Solucoes que a empresa oferece: ${cp.solutions || 'N/A'}
Dores do publico-alvo: ${cp.targetPainPoints || 'N/A'}
Publico-alvo: ${cp.targetAudience || 'N/A'}
Topicos aprovados: ${cp.approvedTopics || 'N/A'}
Frases/topicos proibidos: ${cp.prohibitedPhrases || 'Nenhum definido'}

Como usar: O autor conta uma historia ou opiniao pessoal. Voce conecta essa narrativa com as dores, solucoes ou keywords da empresa de forma natural. A marca NUNCA e o assunto principal. Se nao ha conexao natural, NAO force.

---

## CAMADA 3: BRAND CONTEXT PESSOAL

Dados do autor. Use para calibrar a VOZ e o ESTILO da caption.

Nome: ${pb.authorName || 'N/A'}
Cargo: ${pb.position || 'N/A'}
Tom de voz: ${pb.voice || 'N/A'}
Expertise: ${pb.expertise || 'N/A'}
Proposta de valor pessoal: ${pb.value || 'N/A'}
Estilo de linguagem: ${pb.languageStyle || 'N/A'}
Pilares de conteudo: ${pb.contentPillars || 'N/A'}

Como usar: A voz do autor e soberana. O conteudo precisa soar como ele. Se o tom diz "informal e direto", use contracoes, frases curtas, opinioes claras. Os pilares de conteudo sao o filtro — se o pedido esta fora dos pilares, sugira um angulo que reconecte.

---

## FORMATO E TAMANHO

Formato: ${formatGuide[format] || formatGuide.linkedin}
Tamanho: ${lengthGuide[length] || lengthGuide.medium}

---

## REGRAS DE OUTPUT

- Entregue a caption pronta pra copiar e colar. Sem explicacoes antes ou depois, a menos que o autor peca.
- Se o pedido esta vago, peca esclarecimento em vez de assumir.
- Se o pedido esta fora dos pilares de conteudo do autor, mencione e sugira um angulo dentro do nicho.
- NUNCA inclua hashtags. Nem no final, nem no meio, em nenhum lugar.
- ${isEN ? 'Write entirely in English.' : 'Escreva inteiramente em portugues brasileiro.'}`;

    const { text } = await ai.generate({
      system: systemPrompt,
      prompt: content,
    });

    if (!text) {
      return NextResponse.json(
        { error: "Failed to generate content" },
        { status: 500 }
      );
    }

    // ── Consume 1 AI credit ──
    // First consume from monthly remaining, then from bonusCredits
    const updateData: Record<string, unknown> = {
      'aiCredits.totalUsed': FieldValue.increment(1),
    };
    if ((aiCredits.remaining || 0) > 0) {
      updateData['aiCredits.remaining'] = FieldValue.increment(-1);
    } else {
      updateData['aiCredits.bonusCredits'] = FieldValue.increment(-1);
    }
    await userRef.update(updateData);

    const newRemaining = (aiCredits.remaining || 0) > 0
      ? (aiCredits.remaining - 1) + (aiCredits.bonusCredits || 0)
      : (aiCredits.bonusCredits || 0) - 1;

    return NextResponse.json({
      alignedContent: text,
      creditsRemaining: Math.max(0, newRemaining),
    });
  } catch (error) {
    console.error("AI Generate error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
