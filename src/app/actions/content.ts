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
      short: `Caption CURTA. Post de opiniao pura, estilo bold statement. O autor entra com posicao forte, entrega o ponto e sai. Poucas linhas (5-10 linhas no mobile). Sem lista acionavel — a forca esta na opiniao em si. Se tiver lista, maximo 2 items curtos sem descricao. O formato e quase um manifesto compacto: hook forte, opiniao afiada, frase de impacto final.`,
      medium: `Caption MEDIA. Hook forte, body que desenvolve a ideia com substancia, e uma lista acionavel OBJETIVA (3-4 items curtos, sem descricao — apenas o item em si). A lista usa -> como marcador. Fecha com frase de conclusao e bold statement. Sweet spot de 31-60 segundos de leitura no mobile. A lista nao precisa de titulo com ":" antes — ela pode simplesmente aparecer como continuacao natural do texto.`,
      long: `Caption LONGA. Narrativa envolvente e descritiva que prende o leitor. O hook abre com forca, o body conta uma historia com detalhes concretos e vividos — o leitor precisa sentir que esta vivendo aquilo. A secao acionavel pode ser mais descritiva (3-5 items com uma frase de contexto cada, usando -> como marcador). A conclusao amarra o raciocinio e o bold statement encerra com frase memoravel. 15-25 linhas no mobile. Para conteudo educacional denso, frameworks, e historias que precisam de espaco pra respirar.`,
    };

    const formatGuide: Record<string, string> = {
      linkedin: `FORMATO LINKEDIN (visual, escaneavel, mobile-first):
Este e o formato mais VISUAL e AREJADO. Cada frase carrega peso proprio. A leitura e rapida e ritmica, como poesia moderna.
Regras de formatacao:
-> Blocos CURTOS: maximo 1-3 frases por bloco. NUNCA paragrafos longos de 4+ linhas corridas.
-> Frases que complementam a mesma ideia ficam juntas (sem linha em branco entre elas), mas o bloco todo e curto.
-> Linha em branco entre cada bloco de pensamento. O espaco em branco e parte da comunicacao.
-> Frases curtas e afiadas criam ritmo. Varie entre frases de 3-5 palavras e frases de 8-12 palavras.
-> Listas usam -> e sao CURTAS (so o item, sem descricao ou contexto).
-> Numeracao com 1/ 2/ 3/ tambem funciona para listas curtas.
-> O bold statement final fica ISOLADO na ultima linha, separado por linha em branco.
-> Pense no scroll do mobile: cada bloco e uma "tela" que prende o leitor antes de scrollar pro proximo.

Exemplo de formatacao LinkedIn CORRETA:
"Ser um embaixador da sua marca na rede, todo dia.
Para muitos, a IA virou uma ferramenta essencial nessa missao.

Eu, como Head de Marketing, ja nao imagino meu dia sem a ajuda da IA para otimizar minha presenca no LinkedIn.

Nao e sobre terceirizar minha voz, mas sobre multiplicar minha capacidade de impactar.

A gente fala muito sobre o poder da voz do colaborador.
E, de verdade, ver pessoas que antes se sentiam travadas para postar

Agora usando IA para iniciar um rascunho, refinar um pensamento ou ate superar o famoso bloqueio da pagina em branco, e um game-changer.

1/ traz mais alcance organico
2/ fortalece a marca empregadora
3/ mostra a expertise de quem faz acontecer no dia a dia

Claro, o desafio e manter a autenticidade.

A IA e uma co-piloto, nao a piloto principal. Ela precisa da nossa direcao, da nossa experiencia, do nosso toque pessoal para realmente ressoar.

Para usar a IA no seu conteudo profissional:
-> Use como ponto de partida para rascunhos
-> Explore novos angulos para um mesmo tema
-> Otimize a clareza e concisao do texto
-> Personalize sempre com sua visao unica

A IA nao veio para roubar nossa autenticidade, mas para amplifica-la.
Seu toque humano ainda e insubstituivel."`,
      "text-heavy": `FORMATO TEXTO DENSO (editorial, leitura continua):
Escrita fluida como um ensaio ou artigo. ZERO listas, ZERO marcadores, ZERO formatacao visual. So prosa articulada.
Regras de formatacao:
-> Paragrafos de 3-5 frases que desenvolvem um raciocinio inteiro antes de quebrar.
-> As frases se conectam com transicoes naturais — uma ideia leva a proxima dentro do mesmo paragrafo.
-> NUNCA usar listas, bullet points, ->, numeracao ou qualquer formatacao visual. O poder esta na argumentacao fluida.
-> O ritmo e de leitura continua, como um editorial de revista ou uma carta pessoal.
-> Cada paragrafo e um bloco de pensamento completo: abre, desenvolve, amarra.
-> Use virgulas, ponto e virgula e conectivos pra criar cadencia dentro da frase.
-> A separacao entre paragrafos e uma unica linha em branco.
-> O texto deve soar como alguem pensando em voz alta de forma articulada — profundo, conectado, sem pressa.
-> Se o conteudo teria uma lista, INCORPORE os items dentro de frases conectadas. Ex: em vez de "-> item 1 / -> item 2", escreva "Isso significa usar X, explorar Y, e personalizar Z."`,
      hybrid: `FORMATO HIBRIDO (equilibrio entre visual e profundidade):
Meio-termo entre o formato LinkedIn e o texto denso. Paragrafos pequenos mas COMPLETOS (nao uma frase so), com listas ocasionais.
Regras de formatacao:
-> Paragrafos de 2-4 frases que desenvolvem uma ideia. Mais denso que LinkedIn, mas sem os blocos longos de 5+ linhas do texto denso.
-> Use listas com moderacao — apenas quando listar items realmente faz mais sentido que um paragrafo. Marcador: ->
-> Listas podem ter uma frase curta de contexto por item (diferente do LinkedIn que e so o item).
-> Alterne entre blocos de texto fluido e momentos de lista. Nao seja 100% de nenhum dos dois.
-> Uma linha em branco entre paragrafos. Sem espacamento exagerado.
-> O ritmo e de conversa — direto mas nao telegrafado, articulado mas nao academico.`,
    };

    const systemPrompt = `Voce e um assistente de criacao de captions para LinkedIn. Seu objetivo e ajudar o autor a criar captions de alta performance que alinham a marca corporativa da empresa com a autenticidade da marca pessoal do autor.

Voce NUNCA fala da marca de forma explicita ou forcada. Voce tece a marca dentro da narrativa pessoal do autor, de forma organica.
Voce so gera captions (legendas de texto puro). Nao gera designs, carousels, nem instrucoes visuais.

REGRAS CRITICAS DE FORMATACAO (LinkedIn nao suporta rich text):
-> NUNCA use ** (bold/negrito). LinkedIn NAO renderiza markdown. O texto aparece com os asteriscos literais.
-> NUNCA use ## ou ### (headings). LinkedIn NAO renderiza headings. Os caracteres aparecem literais.
-> NUNCA use * como marcador de lista. Use -> em vez disso.
-> NUNCA use - como marcador de lista. Use -> em vez disso.
-> O unico recurso de formatacao disponivel no LinkedIn e: quebras de linha e texto puro. Use isso com inteligencia.
-> Para dar enfase, use a propria construcao da frase (posicao, ritmo, isolamento) — nao formatacao visual.

REGRA CRITICA DE QUEBRAS DE LINHA:
-> As regras de quebra de linha DEPENDEM DO FORMATO selecionado. Siga rigorosamente o formato escolhido.
-> No formato LINKEDIN: blocos curtos de 1-3 frases com espaco entre eles. Mais arejado.
-> No formato HIBRIDO: paragrafos de 2-4 frases. Intermediario.
-> No formato TEXTO DENSO: paragrafos de 3-5 frases. Mais compacto.
-> Em TODOS os formatos: frases que complementam a mesma ideia ficam juntas (sem linha em branco entre elas).
-> Em TODOS os formatos: linha em branco para separar blocos de pensamento diferentes.

REGRAS DO ALGORITMO:
-> Salvamentos sao o sinal mais forte. O conteudo precisa ser util o suficiente pra alguem guardar.
-> Tempo de leitura ideal: 31-60 segundos. Denso mas escaneavel.
-> Comentarios de 15+ palavras valem 5,2x mais que curtida. Provoque reflexao, nao engajamento vazio.
-> Copy com padrao de IA e penalizado. Siga as regras anti-padrao abaixo.
-> Links externos cortam 60% do alcance. Nunca inclua links na caption.
-> NUNCA usar hashtags. Sem excecao.

ANATOMIA DA CAPTION:

1. Hook (2 linhas, max ~40 caracteres cada):
-> Targeta a audiencia, ativa curiosidade, da overview sem entregar.
-> Use tensao entre L1 e L2 (fato + contraste).
-> Varie o estilo de hook.

2. Body (narrativa):
O tamanho e a estrutura dependem do conteudo e do FORMATO selecionado.
-> Escrever mais com menos. Cada frase precisa justificar sua existencia.
-> Tom de conversa entre profissionais. Contracoes naturais, cadencia irregular.
-> Situacoes concretas > abstracoes. Exemplos reais > teorias genericas.
-> Siga rigorosamente as regras do formato escolhido (ver FORMATO E TAMANHO).

3. Secao acionavel (apos a narrativa):
Traga algo pratico. Use -> como marcador. Escolha o que fizer mais sentido:
-> Licoes aprendidas
-> Dicas praticas
-> Passos ou framework simples
-> Perguntas de reflexao genuinas (nao genericas)
A quantidade de descricao por item depende do TAMANHO selecionado (curto = sem descricao, medio = sem descricao, longo = com frase de contexto).

4. Conclusao + Bold statement:
-> Statement forte com opiniao ou direcao clara.
-> NUNCA perguntas genericas de engajamento ("e voce?", "concorda?", "comenta aqui").
-> Encerre com uma frase curta e marcante que resume a essencia do post.

PADROES PROIBIDOS (anti-IA):
-> Contrastes binarios artificiais ("[Negacao]. [Afirmacao].")
-> Frases dramaticas vazias ("A verdade e:", "Deixe isso afundar")
-> Repeticoes em serie ("Mais X. Mais Y. Mais Z.")
-> Regra de tres forcada (varie: use 2, 4, ou quantidades assimetricas)
-> Conclusao que repete a introducao
-> Vocabulario inflado: "crucial", "fundamental", "no cenario atual", "jornada", "transformador", "destaca-se", "fomenta", "impulsiona"
-> Gerundios de analise superficial ("demonstrando...", "reforcando...")
-> Hashtags em qualquer lugar da caption
-> Qualquer uso de ** (bold), ## (heading), * (marcador), - (marcador)

BRAND CONTEXT CORPORATIVO (tecer na narrativa de forma organica, nunca explicita):

Empresa: ${cp.companyName || 'N/A'}
Proposta de valor: ${cp.valueProposition || 'N/A'}
Tagline: ${cp.tagline || 'N/A'}
Keywords de negocio: ${cp.businessKeywords || 'N/A'}
Solucoes: ${cp.solutions || 'N/A'}
Dores do publico-alvo: ${cp.targetPainPoints || 'N/A'}
Publico-alvo: ${cp.targetAudience || 'N/A'}
Topicos aprovados: ${cp.approvedTopics || 'N/A'}
Frases/topicos proibidos: ${cp.prohibitedPhrases || 'Nenhum definido'}

O autor conta uma historia ou opiniao pessoal. Conecte com as dores, solucoes ou keywords da empresa de forma natural. A marca NUNCA e o assunto principal. Se nao ha conexao natural, NAO force.

BRAND CONTEXT PESSOAL (calibrar voz e estilo):

Nome: ${pb.authorName || 'N/A'}
Cargo: ${pb.position || 'N/A'}
Tom de voz: ${pb.voice || 'N/A'}
Expertise: ${pb.expertise || 'N/A'}
Proposta de valor pessoal: ${pb.value || 'N/A'}
Estilo de linguagem: ${pb.languageStyle || 'N/A'}
Pilares de conteudo: ${pb.contentPillars || 'N/A'}

A voz do autor e soberana. O conteudo precisa soar como ele.

FORMATO E TAMANHO:

Formato: ${formatGuide[format] || formatGuide.linkedin}
Tamanho: ${lengthGuide[length] || lengthGuide.medium}

REGRAS DE OUTPUT:
-> Entregue a caption pronta pra copiar e colar. TEXTO PURO. Sem explicacoes antes ou depois.
-> Se o pedido esta vago, peca esclarecimento em vez de assumir.
-> Se o pedido esta fora dos pilares de conteudo do autor, mencione e sugira um angulo dentro do nicho.
-> NUNCA inclua hashtags.
-> NUNCA use ** ## ### * ou - como marcador.
-> Use -> como unico marcador de lista.
-> Escreva no mesmo idioma do conteudo original.`;

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
