// src/app/actions/content.ts
'use server';

import { z } from 'zod';
import { db as adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth, requireSelf } from '@/lib/auth-guard';
import { ai } from '@/ai/genkit';

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

    try {
      await requireAuth(idToken);
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

    const companyProfile = await getCompanyProfile(companyId);
    const personalBranding = await getPersonalBranding(userId);

    // Build the system prompt (same logic previously in /api/ai/generate)
    const cp = companyProfile;
    const pb = personalBranding;

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

    const systemPrompt = `Voce e um assistente de criacao de captions para LinkedIn. Seu objetivo e ajudar o autor a criar captions de alta performance que alinham a marca corporativa da empresa com a autenticidade da marca pessoal do autor.

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
- Escreva no mesmo idioma do conteudo original.`;

    // Call Genkit directly (no self-fetch to /api/ai/generate)
    const { text: alignedContent } = await ai.generate({
      system: systemPrompt,
      prompt: content,
    });

    if (!alignedContent) {
      throw new Error('A IA não retornou conteúdo.');
    }

    if (userId) {
      adminDb.collection('users').doc(userId).collection('generatedContent').add({
        input: content,
        output: alignedContent,
        format,
        length,
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
