/**
 * Script: Seed — Sessão "Marca Pessoal" + Trilha "Discovery de Marca Pessoal"
 *
 * O que faz:
 *  1. Cria (ou reutiliza) a sessão "Marca Pessoal" em globalSessions
 *  2. Cria a trilha "Discovery de Marca Pessoal" com os 8 módulos completos
 *
 * Como rodar:
 *   npx tsx scripts/seed-marca-pessoal.ts
 *
 * Pré-requisito:
 *   - gcloud autenticado localmente (Application Default Credentials), OU
 *   - FIREBASE_SERVICE_ACCOUNT_KEY no .env.local ou .env
 */

import * as admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ─── Carrega variáveis de ambiente (opcional — ADC funciona sem isso) ──────────
function loadEnvFile(filePath: string) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.substring(0, eqIdx).trim();
      let value = trimmed.substring(eqIdx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // arquivo não encontrado, ignora
  }
}

loadEnvFile(resolve(process.cwd(), '.env.local'));
loadEnvFile(resolve(process.cwd(), '.env'));

// ─── Init Admin SDK ───────────────────────────────────────────────────────────
// Segue o mesmo padrão de src/lib/firebase-admin.ts:
// usa FIREBASE_SERVICE_ACCOUNT_KEY se disponível, senão Application Default Credentials (ADC)
const PROJECT_ID = 'boldfy-app';

const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (serviceAccountKey) {
  try {
    const serviceAccount = JSON.parse(serviceAccountKey);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: PROJECT_ID });
    console.log('🔑 Autenticado via FIREBASE_SERVICE_ACCOUNT_KEY');
  } catch (err) {
    console.error('❌ Erro ao parsear FIREBASE_SERVICE_ACCOUNT_KEY:', err);
    process.exit(1);
  }
} else {
  // Application Default Credentials — funciona com gcloud auth application-default login
  admin.initializeApp({ projectId: PROJECT_ID });
  console.log('🔑 Autenticado via Application Default Credentials (gcloud)');
}

const db = admin.firestore();

// ─── Tipos locais (espelham src/types/trilhas.ts) ─────────────────────────────
type ModuloModo = 'aula' | 'leitura' | 'desafio' | 'faca_voce_mesmo' | 'missao_conteudo';

interface QuestaoDesafio {
  pergunta: string;
  opcoes: string[];
  respostaCorreta: number;
  explicacao?: string;
}

interface MissaoGatilho {
  tipo: 'postar_linkedin';
  instrucoes: string;
  exemplos?: string[];
}

interface Modulo {
  id: string;
  titulo: string;
  modo: ModuloModo;
  ordem: number;
  obrigatorio?: boolean;
  videoUrl?: string;
  conteudoHtml?: string;
  questoes?: QuestaoDesafio[];
  pontuacaoBase?: number;
  pontuacaoBonus?: number;
  instrucaoCard?: string;
  missaoGatilho?: MissaoGatilho;
}

// ─── Conteúdo dos módulos ─────────────────────────────────────────────────────

const MODULOS: Modulo[] = [
  // ──────────────────────────────────────────────────────────────────────────
  // M1 — Aula: O que é (e o que não é) marca pessoal
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'm1-o-que-e-marca-pessoal',
    titulo: 'O que é (e o que não é) marca pessoal',
    modo: 'aula',
    ordem: 1,
    obrigatorio: true,
    // videoUrl será adicionado depois que o vídeo for gravado
    // Roteiro completo abaixo como referência de produção:
    // SLIDE 1 — A pergunta que ninguém faz antes de postar
    // Narração (Fai): "Você já parou pra pensar por que você posta no LinkedIn?
    // Não o motivo que você diz nos comentários. O motivo de verdade.
    // A maioria das pessoas começa a postar sem saber o que quer construir.
    // E aí fica rodando em círculo — sem engajamento, sem resultado, sem direção.
    // Antes de falar sobre o que fazer, a gente precisa falar sobre o que você está construindo.
    // Isso tem nome: marca pessoal."
    //
    // SLIDE 2 — O que marca pessoal não é
    // Narração (Fai): "Primeiro, vamos limpar o caminho.
    // Marca pessoal não é ter milhares de seguidores.
    // Não é postar todo dia às 9h com hashtag certinho.
    // Não é fingir uma versão mais polida de você mesmo.
    // Tem um cara chamado Jeff Bezos que definiu melhor do que eu conseguiria:
    // 'Sua marca pessoal é o que as pessoas falam de você quando você sai da sala.'
    // Pensa nisso por um segundo. Quando você não está presente — o que as pessoas dizem?"
    //
    // SLIDE 3 — O que marca pessoal realmente é
    // Narração (Fai): "Marca pessoal é percepção.
    // É a soma de tudo que você comunica — consciente ou não.
    // Como você escreve. Com quem você se associa. Sobre o que você fala.
    // Sobre o que você não fala.
    // A boa notícia? Você já tem uma marca pessoal.
    // A pergunta é: ela está sendo construída por você — ou pelo acaso?
    // Nessa trilha, você vai descobrir o que já existe — e o que você quer construir.
    // Vamos começar."
  },

  // ──────────────────────────────────────────────────────────────────────────
  // M2 — Aula: Como você se vê vs. como te veem
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'm2-como-voce-se-ve',
    titulo: 'Como você se vê vs. como te veem',
    modo: 'aula',
    ordem: 2,
    obrigatorio: true,
    // SLIDE 1 — A pergunta que desestabiliza
    // Narração (Fai): "Se eu te perguntar 'quem é você profissionalmente?' — o que você diria?
    // A maioria das pessoas responde com cargo e empresa.
    // 'Sou gerente de marketing na empresa X.'
    // Mas isso não é quem você é. É onde você está.
    // Hoje, eu quero que você pense em outra coisa:
    // Existe uma diferença entre como você se vê e como as pessoas te veem?
    // Quase sempre. E esse gap é exatamente onde a sua marca pessoal mora."
    //
    // SLIDE 2 — O gap de percepção (diagrama de três pontos)
    // Narração (Fai): "Pensa assim: são três pontos.
    // Como você se vê — sua autopercepção, seus valores, o que você acha que transmite.
    // Como você quer ser visto — sua aspiração, onde você quer chegar, o que quer representar.
    // E como te veem de verdade — o que as pessoas percebem, o que fica na memória delas.
    // Esses três pontos raramente coincidem.
    // E não tem problema nisso. O problema é não saber onde eles estão."
    //
    // SLIDE 3 — O gap como mapa, não como falha
    // Narração (Fai): "Esse gap não é uma falha. É um mapa.
    // Quando você entende onde está a distância, você sabe onde focar.
    // Quem pula essa etapa e vai direto pra 'criar conteúdo' fica perdido.
    // Porque sem saber onde está, não dá pra saber pra onde ir.
    // No próximo exercício, você vai começar a mapear esse gap.
    // Não pula. Essa é a parte que faz tudo o mais fazer sentido."
  },

  // ──────────────────────────────────────────────────────────────────────────
  // M3 — Desafio: Checkpoint de marca pessoal
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'm3-checkpoint',
    titulo: 'Checkpoint: o que você já aprendeu',
    modo: 'desafio',
    ordem: 3,
    obrigatorio: true,
    pontuacaoBase: 40,
    pontuacaoBonus: 20,
    questoes: [
      {
        pergunta: 'Qual é a definição de marca pessoal que melhor representa o que você aprendeu?',
        opcoes: [
          'O número de seguidores que você tem no LinkedIn',
          'O que as pessoas falam de você quando você sai da sala',
          'A frequência com que você publica conteúdo',
          'O seu cargo e empresa atual',
        ],
        respostaCorreta: 1,
        explicacao:
          'Jeff Bezos disse exatamente isso: marca pessoal é o que as pessoas falam de você quando você não está presente. Não é sobre volume de conteúdo ou métricas — é sobre percepção.',
      },
      {
        pergunta: 'Quais são os três pontos do "gap de percepção" apresentados na aula?',
        opcoes: [
          'Cargo, empresa e senioridade',
          'LinkedIn, Instagram e portfólio',
          'Como você se vê, como quer ser visto e como te veem de verdade',
          'Conteúdo, consistência e comunidade',
        ],
        respostaCorreta: 2,
        explicacao:
          'O gap de percepção existe entre três pontos: sua autopercepção (como você se vê), sua aspiração (como quer ser visto) e a percepção real das pessoas (como te veem de verdade). Entender esse gap é o primeiro passo do discovery.',
      },
      {
        pergunta: 'Alguém que ainda não postou nada no LinkedIn tem marca pessoal?',
        opcoes: [
          'Não — marca pessoal só existe com presença digital ativa',
          'Sim — marca pessoal é a percepção que as pessoas têm de você, com ou sem conteúdo',
          'Depende — só se tiver mais de 500 conexões',
          'Talvez — se a pessoa trabalhar em uma empresa conhecida',
        ],
        respostaCorreta: 1,
        explicacao:
          'Todo mundo já tem uma marca pessoal — ela é construída pela soma de tudo que você comunica, consciente ou não. Postar no LinkedIn acelera e direciona essa construção, mas a marca já existe antes disso.',
      },
      {
        pergunta: 'Por que entender o gap de percepção é importante antes de criar conteúdo?',
        opcoes: [
          'Para escolher o melhor horário de publicação',
          'Para saber quantos posts fazer por semana',
          'Para não ficar rodando em círculo sem saber o que construir',
          'Para copiar o estilo de quem já tem muitos seguidores',
        ],
        respostaCorreta: 2,
        explicacao:
          'Sem saber onde você está (gap de percepção), não dá pra saber pra onde ir. Quem pula essa etapa cria conteúdo sem direção — e não entende por que não tem resultado.',
      },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // M4 — Faça Você Mesmo: O exercício do espelho
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'm4-exercicio-espelho',
    titulo: 'O exercício do espelho',
    modo: 'faca_voce_mesmo',
    ordem: 4,
    obrigatorio: true,
    instrucaoCard: `**O exercício do espelho** — 3 partes, ~20 minutos

**Parte 1 — Como você se vê** (5 min)
Responda no papel (ou bloco de notas):
- Se eu precisasse descrever meu jeito de trabalhar em 3 palavras, quais seriam?
- Qual problema eu resolvo melhor do que a maioria das pessoas?
- O que me faz diferente no meu contexto profissional?

Não edite. Escreva o que vier primeiro.

---

**Parte 2 — Como você quer ser visto** (5 min)
- Daqui a 2 anos, quando alguém pensar no meu nome profissionalmente, o que eu quero que venha à mente?
- Que tipo de oportunidade eu quero que chegue até mim por causa da minha marca?
- Em uma frase: "Eu quero ser conhecido como ___"

---

**Parte 3 — Como te veem de verdade** (assíncrona)
Envie uma mensagem curta para 3 pessoas que trabalham (ou trabalharam) com você:

> "Ei, estou fazendo um exercício de desenvolvimento profissional. Me faz um favor? Descreve em 2-3 palavras como você me vê profissionalmente. Pode ser honesto — tô pedindo justamente isso."

Guarde as respostas. Você vai precisar delas no próximo módulo.`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // M5 — Aula: Três palavras que te definem
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'm5-tres-palavras',
    titulo: 'Três palavras que te definem',
    modo: 'aula',
    ordem: 5,
    obrigatorio: true,
    // SLIDE 1 — Palavras fracas vs. palavras fortes
    // Narração (Fai): "Você já deve ter visto um perfil do LinkedIn que diz:
    // 'Profissional apaixonado, proativo e orientado a resultados.'
    // E não disse absolutamente nada sobre quem é aquela pessoa.
    // O problema não é só clichê. O problema é que essas palavras não te diferenciam —
    // porque todo mundo usa as mesmas.
    // Hoje você vai aprender a encontrar palavras que realmente te representam.
    // E tem três filtros pra isso."
    //
    // SLIDE 2 — Filtro 1: É verdade, não aspiração
    // Narração (Fai): "Filtro 1: É verdade agora — não o que você quer ser.
    // Tem uma diferença enorme entre 'quem eu sou' e 'quem eu quero ser'.
    // A marca pessoal precisa ser construída sobre o que já existe.
    // Você pode evoluir — mas começa do real.
    // Se a palavra só aparece quando você está no seu melhor dia, ela não é sua marca.
    // É sua aspiração. E aspiração vira marca com o tempo — não de uma hora pra outra."
    //
    // SLIDE 3 — Filtros 2 e 3
    // Narração (Fai): "Filtro 2: Apareceu em mais de um lugar.
    // Se uma palavra veio de você, e também apareceu no retorno de quem trabalha com você —
    // essa palavra tem peso. Ela não é só percepção sua. É algo que as pessoas percebem também.
    //
    // Filtro 3: Diferencia no seu contexto.
    // 'Comunicativo' pode ser comum em marketing mas raro em engenharia.
    // O que diferencia você não é absoluto — é relativo ao ambiente onde você atua.
    // Com esses três filtros, você vai sair do exercício anterior com 2 a 3 palavras
    // que realmente representam sua marca hoje.
    // Vamos pro próximo módulo aplicar isso."
  },

  // ──────────────────────────────────────────────────────────────────────────
  // M6 — Faça Você Mesmo: Mapeando suas palavras
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'm6-mapeando-palavras',
    titulo: 'Mapeando suas palavras',
    modo: 'faca_voce_mesmo',
    ordem: 6,
    obrigatorio: true,
    instrucaoCard: `**Mapeando suas palavras** — ~15 minutos

Você precisa das respostas do Exercício do Espelho (Módulo 4) para fazer isso.

---

**Passo 1 — Reúna todo o material**
Liste todas as palavras e expressões que apareceram:
- Suas respostas da Parte 1 (como você se vê)
- Suas respostas da Parte 2 (como quer ser visto)
- As respostas das 3 pessoas da Parte 3 (como te veem)

Coloque tudo junto. Pode ser uma lista feia — não tem problema.

---

**Passo 2 — Aplique os 3 filtros**

Para cada palavra ou expressão, pergunte:

✅ **Filtro 1:** É verdade hoje — não só no meu melhor dia?
✅ **Filtro 2:** Apareceu em mais de uma fonte (eu + outra pessoa)?
✅ **Filtro 3:** Diferencia no meu contexto profissional atual?

Palavras que passam nos 3 filtros ficam. O resto, por enquanto, vai pro lado.

---

**Passo 3 — Escolha 2 a 3 palavras**

Não precisa ser perfeito. Não precisa ser definitivo.
Essas são as palavras que representam sua marca *hoje*.
Elas vão evoluir — mas começar com clareza faz toda a diferença.

Anote: **"Minha marca pessoal hoje é: ___"**

Guarde isso. Você vai usar nas próximas trilhas.`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // M7 — Leitura: Da percepção ao posicionamento
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'm7-da-percepcao-ao-posicionamento',
    titulo: 'Da percepção ao posicionamento',
    modo: 'leitura',
    ordem: 7,
    obrigatorio: true,
    conteudoHtml: `<article>

<h2>Você chegou até aqui. O que isso significa?</h2>

<p>Você mapeou como se vê. Recebeu retorno de quem trabalha com você. Aplicou filtros. Escolheu palavras.</p>

<p>Isso não é pouca coisa. A maioria das pessoas que "trabalha a marca pessoal" começa com a conta do LinkedIn, não com esse processo.</p>

<p>Mas tem uma coisa importante de entender antes de ir para a próxima trilha:</p>

<blockquote>
  <strong>Discovery é o começo — não o destino.</strong>
</blockquote>

<p>O que você fez aqui foi criar uma fundação. Saber quem você é, como é percebido e o que te diferencia. Isso é o pré-requisito para tudo o que vem depois.</p>

<hr />

<h2>O que vem depois</h2>

<p>Nas próximas trilhas desta sessão, você vai transformar esse material em posicionamento — uma forma clara de comunicar quem você é e o valor que gera para quem está ao seu redor.</p>

<p>Posicionamento não é um slogan. Não é um "elevator pitch" decorado. É a consistência entre o que você pensa, o que você faz e o que você comunica.</p>

<p>Quando essas três coisas estão alinhadas, sua marca pessoal deixa de ser um esforço consciente e passa a ser uma consequência natural de como você trabalha.</p>

<hr />

<h2>Uma última coisa antes de ir</h2>

<p>Guarde as palavras que você encontrou. Elas vão aparecer de novo — no seu perfil, no seu conteúdo, nas conversas que você vai ter.</p>

<p>Por enquanto, o que importa é que você tem clareza sobre onde está. Essa clareza é o que vai fazer o próximo passo fazer sentido.</p>

<p>Até a próxima trilha.</p>

</article>`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // M8 — Missão de Conteúdo: Sua primeira missão de marca
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'm8-primeira-missao-de-marca',
    titulo: 'Sua primeira missão de marca',
    modo: 'missao_conteudo',
    ordem: 8,
    obrigatorio: false,
    missaoGatilho: {
      tipo: 'postar_linkedin',
      instrucoes: `Você fez o exercício do espelho. Você encontrou suas palavras. Agora é hora de colocar isso no mundo — do jeito mais natural possível.

**Sua missão:** publique um post no LinkedIn que parta de algo que você descobriu ou percebeu ao longo desta trilha.

Pode ser uma reflexão sobre marca pessoal, uma descoberta sobre como te veem, ou até a pergunta que te desestabilizou.

Não precisa ser um manifesto. Um post honesto e curto já conta.

---

**Dois ângulos pra você escolher:**

**Ângulo 1 — O que eu descobri**
Compartilhe algo que você não sabia (ou não tinha parado pra pensar) sobre sua marca pessoal. O que o exercício revelou?

*Exemplo de abertura:*
"Pedi pra 3 pessoas me descreverem em 2 palavras. As respostas me surpreenderam — e me mostraram um gap que eu não sabia que existia."

---

**Ângulo 2 — A intenção**
Fale sobre o que você quer construir daqui pra frente. Não precisa ter tudo resolvido — intenção já é posicionamento.

*Exemplo de abertura:*
"Eu quero ser conhecido como [palavra/expressão]. Por enquanto, é isso que eu sei. E é suficiente pra começar."

---

Quando publicar, cole o link do post aqui para registrar sua missão concluída.`,
      exemplos: [
        'Pedi pra 3 pessoas me descreverem em 2 palavras. As respostas me surpreenderam — e me mostraram um gap que eu não sabia que existia.',
        'Eu quero ser conhecido como [palavra/expressão]. Por enquanto, é isso que eu sei. E é suficiente pra começar.',
      ],
    },
  },
];

// ─── Configuração da Trilha ────────────────────────────────────────────────────

const TRILHA_DATA = {
  titulo: 'Discovery de Marca Pessoal',
  descricao:
    'Antes de postar, você precisa saber o que está construindo. Nesta trilha, você vai mapear como se vê, como te veem e o que te diferencia — a fundação de tudo que vem depois.',
  ordem: 1,
  ativa: true,
  isGlobal: true,
  // Pontuação total (sem bônus): 4×aula(100) + 1×desafio(40) + 2×fvm(30) + 1×leitura(20) + 1×missão(100) = 420
  // Com bônus do desafio: +20 = 440
  // FVM não tem pontuação no MODO_CONFIG padrão, mas estamos usando pontos customizados
  pontuacaoTotal: 420,   // base: aulas(400) + desafio(40) + leitura(20) — FVM não conta no padrão
  pontuacaoBonus: 20,    // bônus do desafio (>80%)
  pontuacaoBonusTrilha: 0,
  tempoEstimadoMin: 61,  // M1(4) + M2(3) + M3(5) + M4(20) + M5(4) + M6(15) + M7(4) + M8(15) = ~70 min
  modulos: MODULOS,
};

// ─── Configuração da Sessão ────────────────────────────────────────────────────

const SESSAO_DATA = {
  titulo: 'Marca Pessoal',
  descricao:
    'Uma jornada completa para construir e comunicar sua marca pessoal com consistência e autenticidade.',
  ordem: 2, // Onboarding é 1
  ativa: true,
  locale: 'pt-BR',
};

// ─── Runner ───────────────────────────────────────────────────────────────────

async function run() {
  console.log('🚀 Iniciando seed: Sessão Marca Pessoal\n');

  const sessionsRef = db.collection('globalSessions');

  // ── 1. Verificar se a sessão já existe ──
  console.log('🔍 Verificando se sessão "Marca Pessoal" já existe...');
  const existing = await sessionsRef.where('titulo', '==', SESSAO_DATA.titulo).limit(1).get();

  let sessionId: string;

  if (!existing.empty) {
    sessionId = existing.docs[0].id;
    console.log(`  ⚠️  Sessão já existe: id=${sessionId} — reutilizando.`);
  } else {
    // ── 2. Criar sessão ──
    console.log('  📦 Criando sessão...');
    const sessaoRef = await sessionsRef.add({
      ...SESSAO_DATA,
      criadaEm: admin.firestore.FieldValue.serverTimestamp(),
    });
    sessionId = sessaoRef.id;
    console.log(`  ✅ Sessão criada: id=${sessionId}`);
  }

  // ── 3. Verificar se a trilha já existe ──
  const trailsRef = db.collection(`globalSessions/${sessionId}/trails`);
  console.log('\n🔍 Verificando se trilha "Discovery de Marca Pessoal" já existe...');
  const existingTrail = await trailsRef
    .where('titulo', '==', TRILHA_DATA.titulo)
    .limit(1)
    .get();

  if (!existingTrail.empty) {
    const trailId = existingTrail.docs[0].id;
    console.log(`  ⚠️  Trilha já existe: id=${trailId}`);
    console.log('  ℹ️  Para recriar, delete a trilha manualmente e rode o script novamente.');
  } else {
    // ── 4. Criar trilha com módulos embutidos ──
    console.log('  📚 Criando trilha com 8 módulos...');
    const trailRef = await trailsRef.add({
      ...TRILHA_DATA,
      sessionId,
      criadaEm: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`  ✅ Trilha criada: id=${trailRef.id}`);
    console.log(`\n  📋 Módulos incluídos (${MODULOS.length}):`);
    MODULOS.forEach((m) => {
      const pts = m.modo === 'aula'
        ? '100 pts'
        : m.modo === 'desafio'
        ? `${m.pontuacaoBase} pts (+${m.pontuacaoBonus} bônus)`
        : m.modo === 'leitura'
        ? '20 pts'
        : m.modo === 'faca_voce_mesmo'
        ? '30 pts'
        : m.modo === 'missao_conteudo'
        ? '100 pts'
        : '';
      console.log(`    ${m.ordem}. [${m.modo}] ${m.titulo} — ${pts}`);
    });
  }

  // ── Summary ──
  console.log('\n' + '═'.repeat(60));
  console.log('  ✅ SEED CONCLUÍDO!');
  console.log('═'.repeat(60));
  console.log(`\n  Sessão:  globalSessions/${sessionId}`);
  console.log(`  Trilhas: globalSessions/${sessionId}/trails`);
  console.log('\n📋 Próximos passos:');
  console.log('  1. Acesse o painel master → Trilhas e confirme que apareceu');
  console.log('  2. Adicione o videoUrl em cada módulo Aula após gravar os vídeos');
  console.log('  3. Ative a sessão e a trilha para as empresas quando estiver pronto');
  console.log('');

  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
