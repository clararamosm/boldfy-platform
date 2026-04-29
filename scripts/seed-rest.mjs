/**
 * Script: Seed via Firestore REST API
 * Usa um Firebase ID token (do browser) para autenticar — sem service account.
 *
 * Como rodar:
 *   FIREBASE_TOKEN="seu_token_aqui" node scripts/seed-rest.mjs
 *
 * Como pegar o token (no console do browser, na app Boldfy logada):
 *   Já foi extraído — cole abaixo em TOKEN ou passe via env.
 */

const PROJECT_ID = 'boldfy-app';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const TOKEN = process.env.FIREBASE_TOKEN;

if (!TOKEN) {
  console.error('❌ Passe o token: FIREBASE_TOKEN="..." node scripts/seed-rest.mjs');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
};

// ─── Helpers REST ─────────────────────────────────────────────────────────────

function toFirestore(obj) {
  function convert(val) {
    if (val === null || val === undefined) return { nullValue: null };
    if (typeof val === 'string') return { stringValue: val };
    if (typeof val === 'number') return { integerValue: String(val) };
    if (typeof val === 'boolean') return { booleanValue: val };
    if (Array.isArray(val)) return { arrayValue: { values: val.map(convert) } };
    if (typeof val === 'object') {
      return {
        mapValue: {
          fields: Object.fromEntries(
            Object.entries(val)
              .filter(([, v]) => v !== undefined)
              .map(([k, v]) => [k, convert(v)])
          )
        }
      };
    }
    return { stringValue: String(val) };
  }
  return {
    fields: Object.fromEntries(
      Object.entries(obj)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, convert(v)])
    )
  };
}

async function firestoreGet(path) {
  const res = await fetch(`${BASE_URL}/${path}`, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function firestoreQuery(collection, field, value) {
  const body = {
    structuredQuery: {
      from: [{ collectionId: collection }],
      where: {
        fieldFilter: {
          field: { fieldPath: field },
          op: 'EQUAL',
          value: { stringValue: value },
        }
      },
      limit: 1,
    }
  };
  const res = await fetch(`${BASE_URL}:runQuery`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`QUERY → ${res.status}: ${await res.text()}`);
  const results = await res.json();
  // Resultado é array — primeiro item com documento
  const found = results.find(r => r.document);
  return found ? found.document : null;
}

async function firestoreCreate(collection, data) {
  const res = await fetch(`${BASE_URL}/${collection}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(toFirestore(data)),
  });
  if (!res.ok) throw new Error(`CREATE ${collection} → ${res.status}: ${await res.text()}`);
  const doc = await res.json();
  // Extrair ID do nome: projects/.../documents/collection/ID
  const id = doc.name.split('/').pop();
  return id;
}

// ─── Dados da Sessão ──────────────────────────────────────────────────────────

const SESSAO = {
  titulo: 'Marca Pessoal',
  descricao: 'Uma jornada completa para construir e comunicar sua marca pessoal com consistência e autenticidade.',
  ordem: 2,
  ativa: true,
  locale: 'pt-BR',
};

// ─── Módulos ──────────────────────────────────────────────────────────────────

const MODULOS = [
  {
    id: 'm1-o-que-e-marca-pessoal',
    titulo: 'O que é (e o que não é) marca pessoal',
    modo: 'aula',
    ordem: 1,
    obrigatorio: true,
    videoUrl: '',
  },
  {
    id: 'm2-como-voce-se-ve',
    titulo: 'Como você se vê vs. como te veem',
    modo: 'aula',
    ordem: 2,
    obrigatorio: true,
    videoUrl: '',
  },
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
        explicacao: 'Jeff Bezos disse exatamente isso: marca pessoal é o que as pessoas falam de você quando você não está presente. Não é sobre volume de conteúdo ou métricas — é sobre percepção.',
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
        explicacao: 'O gap de percepção existe entre três pontos: sua autopercepção (como você se vê), sua aspiração (como quer ser visto) e a percepção real das pessoas (como te veem de verdade). Entender esse gap é o primeiro passo do discovery.',
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
        explicacao: 'Todo mundo já tem uma marca pessoal — ela é construída pela soma de tudo que você comunica, consciente ou não. Postar no LinkedIn acelera e direciona essa construção, mas a marca já existe antes disso.',
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
        explicacao: 'Sem saber onde você está (gap de percepção), não dá pra saber pra onde ir. Quem pula essa etapa cria conteúdo sem direção — e não entende por que não tem resultado.',
      },
    ],
  },
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
  {
    id: 'm5-tres-palavras',
    titulo: 'Três palavras que te definem',
    modo: 'aula',
    ordem: 5,
    obrigatorio: true,
    videoUrl: '',
  },
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
Essas são as palavras que representam sua marca hoje.
Elas vão evoluir — mas começar com clareza faz toda a diferença.

Anote: **"Minha marca pessoal hoje é: ___"**

Guarde isso. Você vai usar nas próximas trilhas.`,
  },
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
<blockquote><strong>Discovery é o começo — não o destino.</strong></blockquote>
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

Pode ser uma reflexão sobre marca pessoal, uma descoberta sobre como te veem, ou até a pergunta que te desestabilizou. Não precisa ser um manifesto. Um post honesto e curto já conta.

---

**Dois ângulos pra você escolher:**

**Ângulo 1 — O que eu descobri**
"Pedi pra 3 pessoas me descreverem em 2 palavras. As respostas me surpreenderam — e me mostraram um gap que eu não sabia que existia."

**Ângulo 2 — A intenção**
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

// ─── Dados da Trilha ──────────────────────────────────────────────────────────

const TRILHA = {
  titulo: 'Discovery de Marca Pessoal',
  descricao: 'Antes de postar, você precisa saber o que está construindo. Nesta trilha, você vai mapear como se vê, como te veem e o que te diferencia — a fundação de tudo que vem depois.',
  ordem: 1,
  ativa: true,
  isGlobal: true,
  pontuacaoTotal: 420,
  pontuacaoBonus: 20,
  pontuacaoBonusTrilha: 0,
  tempoEstimadoMin: 61,
  modulos: MODULOS,
};

// ─── Runner ───────────────────────────────────────────────────────────────────

async function run() {
  console.log('🚀 Seed via REST API\n');

  // 1. Verificar se sessão já existe
  console.log('🔍 Verificando sessão "Marca Pessoal"...');
  const existingSessao = await firestoreQuery('globalSessions', 'titulo', SESSAO.titulo);

  let sessionId;
  if (existingSessao) {
    sessionId = existingSessao.name.split('/').pop();
    console.log(`  ⚠️  Sessão já existe: ${sessionId}`);
  } else {
    console.log('  📦 Criando sessão...');
    sessionId = await firestoreCreate('globalSessions', SESSAO);
    console.log(`  ✅ Sessão criada: ${sessionId}`);
  }

  // 2. Verificar se trilha já existe
  console.log('\n🔍 Verificando trilha "Discovery de Marca Pessoal"...');
  const existingTrilha = await firestoreQuery(
    `globalSessions/${sessionId}/trails`,
    'titulo',
    TRILHA.titulo
  );

  if (existingTrilha) {
    const trailId = existingTrilha.name.split('/').pop();
    console.log(`  ⚠️  Trilha já existe: ${trailId}`);
    console.log('  ℹ️  Delete a trilha manualmente e rode novamente para recriar.');
  } else {
    console.log('  📚 Criando trilha com 8 módulos...');
    const trailId = await firestoreCreate(
      `globalSessions/${sessionId}/trails`,
      { ...TRILHA, sessionId }
    );
    console.log(`  ✅ Trilha criada: ${trailId}`);
    console.log(`\n  📋 Módulos (${MODULOS.length}):`);
    MODULOS.forEach(m => {
      const pts = m.modo === 'aula' ? '100 pts'
        : m.modo === 'desafio' ? `${m.pontuacaoBase} pts (+${m.pontuacaoBonus} bônus)`
        : m.modo === 'leitura' ? '20 pts'
        : m.modo === 'faca_voce_mesmo' ? '30 pts'
        : '100 pts';
      console.log(`    ${m.ordem}. [${m.modo}] ${m.titulo} — ${pts}`);
    });
  }

  console.log('\n' + '═'.repeat(55));
  console.log('  ✅ CONCLUÍDO!');
  console.log('═'.repeat(55));
  console.log(`\n  Sessão:  globalSessions/${sessionId}`);
  console.log(`  Trilhas: globalSessions/${sessionId}/trails`);
  console.log('\n  Acesse o painel master → Trilhas para confirmar.\n');
}

run().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
