// src/lib/trilhas/template-content.ts
//
// Conteudo da sessao "Trilhas Personalizadas — Template" que e seedada
// automaticamente toda vez que uma empresa nova e criada (ver
// seedTemplatePersonalizado em src/app/actions/company-setup.ts).
//
// As 5 trilhas vem com modulos: [] — admin constroi do zero usando o
// Trail Builder normal. A descricao de cada trilha funciona como
// guia removivel: explica por que aquela trilha existe e da sugestoes
// do que colocar ali. Texto plano (sem markdown) — renderizado em
// <p> e <CardDescription> sem processador de markdown.
//
// Hierarquia visual feita com QUEBRAS DE LINHA + TITULOS EM CAIXA ALTA.
//
// Conteudo voltado para o USUARIO usa acentuacao portuguesa completa.
// Comentarios de codigo seguem a convencao interna sem acentos.

export type TemplateLocale = 'pt-BR' | 'en';

export type TemplateTrilha = {
  /** Titulo curto da trilha — vai pro Firestore como Trilha.titulo */
  titulo: string;
  /** Descricao-guia removivel — vai pro Firestore como Trilha.descricao */
  descricao: string;
};

export type TemplateContent = {
  /** Titulo da Sessao container */
  sessaoTitulo: string;
  /** Descricao da Sessao container */
  sessaoDescricao: string;
  /** As 5 trilhas-esqueleto, em ordem */
  trilhas: TemplateTrilha[];
};

const PT_BR: TemplateContent = {
  sessaoTitulo: 'Trilhas Personalizadas — Template',
  sessaoDescricao:
    'Estas trilhas são esqueletos para você adaptar com o conteúdo da sua empresa.\n\n' +
    'Cada trilha tem uma descrição explicando por que ela existe e o que você poderia colocar ali. ' +
    'Apague essa instrução e construa os módulos do jeito que faz sentido pra você.',
  trilhas: [
    {
      titulo: 'Visão, Missão e Valores',
      descricao:
        'POR QUE ESTA TRILHA EXISTE\n' +
        'É a fundação. Sem isso, o colaborador não tem matéria-prima pra contextualizar o resto. ' +
        'Visual e verbal são manifestações da identidade — a identidade vem antes.\n\n' +
        'SUGESTÃO DO QUE COLOCAR AQUI\n' +
        'Quem é a empresa por dentro, por que existe, pra onde vai, o que defende. ' +
        'Pode ser depoimento do CEO/founder, história da empresa, valores em prática com exemplos reais, missão e visão explicadas.\n\n' +
        'Apague este texto e descreva esta trilha no contexto da sua empresa. Depois, construa os módulos que fizerem sentido pra você.',
    },
    {
      titulo: 'Identidade Visual',
      descricao:
        'POR QUE ESTA TRILHA EXISTE\n' +
        'Colaborador precisa saber como a marca aparece, e como respeitar isso quando criar conteúdo próprio.\n\n' +
        'SUGESTÃO DO QUE COLOCAR AQUI\n' +
        'Logo, paleta de cores, tipografia, uso correto e usos errados, exemplos visuais, brand book em PDF, templates de carrossel/imagens.\n\n' +
        'Apague este texto e descreva esta trilha no contexto da sua empresa. Depois, construa os módulos que fizerem sentido pra você.',
    },
    {
      titulo: 'Identidade Verbal',
      descricao:
        'POR QUE ESTA TRILHA EXISTE\n' +
        'Evita conteúdo de fachada — o colaborador entende o tom da marca antes de criar conteúdo em nome próprio com a empresa como contexto.\n\n' +
        'SUGESTÃO DO QUE COLOCAR AQUI\n' +
        "Tom de voz, vocabulário próprio, do's & don'ts da escrita corporativa, frase assinatura se houver, exemplos antes/depois.\n\n" +
        'Apague este texto e descreva esta trilha no contexto da sua empresa. Depois, construa os módulos que fizerem sentido pra você.',
    },
    {
      titulo: 'Produto e Proposta de Valor',
      descricao:
        'POR QUE ESTA TRILHA EXISTE\n' +
        'Colaborador que não entende o produto vai falar besteira. Conhecer o produto é base pra criar conteúdo legítimo.\n\n' +
        'SUGESTÃO DO QUE COLOCAR AQUI\n' +
        'O que a empresa vende, pra quem, e por quê. Diferenciais. Casos de uso. Linguagem pra explicar o produto sem virar pitch deck.\n\n' +
        'Apague este texto e descreva esta trilha no contexto da sua empresa. Depois, construa os módulos que fizerem sentido pra você.',
    },
    {
      titulo: 'Pitch de Marca',
      descricao:
        'POR QUE ESTA TRILHA EXISTE\n' +
        'Todo colaborador eventualmente vai ter que apresentar a empresa em algum contexto profissional. ' +
        'Padronizar isso ajuda o time inteiro — especialmente vendedores, founders, e RH em recrutamento.\n\n' +
        'SUGESTÃO DO QUE COLOCAR AQUI\n' +
        'Pitch de 30 segundos, 2 minutos e 5 minutos. Pitch pra cliente, pra investidor, pra possível talento. Quando usar cada um.\n\n' +
        'Apague este texto e descreva esta trilha no contexto da sua empresa. Depois, construa os módulos que fizerem sentido pra você.',
    },
  ],
};

const EN: TemplateContent = {
  sessaoTitulo: 'Personalized Trails — Template',
  sessaoDescricao:
    'These trails are skeletons for you to adapt with your company content.\n\n' +
    'Each trail has a description explaining why it exists and what you could put there. ' +
    'Delete that instruction and build the modules the way that makes sense to you.',
  trilhas: [
    {
      titulo: 'Vision, Mission and Values',
      descricao:
        'WHY THIS TRAIL EXISTS\n' +
        'It is the foundation. Without this, the team member has no raw material to contextualize the rest. ' +
        'Visual and verbal are expressions of identity — identity comes first.\n\n' +
        'SUGGESTION OF WHAT TO PUT HERE\n' +
        'Who the company is inside, why it exists, where it is going, what it stands for. ' +
        'Could be a CEO/founder testimonial, company history, values in practice with real examples, mission and vision explained.\n\n' +
        'Delete this text and describe this trail in your company context. Then, build the modules that make sense to you.',
    },
    {
      titulo: 'Visual Identity',
      descricao:
        'WHY THIS TRAIL EXISTS\n' +
        'Team members need to know how the brand shows up, and how to respect that when creating their own content.\n\n' +
        'SUGGESTION OF WHAT TO PUT HERE\n' +
        'Logo, color palette, typography, correct and incorrect usage, visual examples, brand book PDF, carousel/image templates.\n\n' +
        'Delete this text and describe this trail in your company context. Then, build the modules that make sense to you.',
    },
    {
      titulo: 'Verbal Identity',
      descricao:
        'WHY THIS TRAIL EXISTS\n' +
        'Avoids facade content — the team member understands the brand tone before creating content in their own name with the company as context.\n\n' +
        'SUGGESTION OF WHAT TO PUT HERE\n' +
        "Tone of voice, brand-specific vocabulary, writing do's & don'ts, signature phrase if any, before/after examples.\n\n" +
        'Delete this text and describe this trail in your company context. Then, build the modules that make sense to you.',
    },
    {
      titulo: 'Product and Value Proposition',
      descricao:
        'WHY THIS TRAIL EXISTS\n' +
        'A team member who does not understand the product will say nonsense. Knowing the product is the base for creating legitimate content.\n\n' +
        'SUGGESTION OF WHAT TO PUT HERE\n' +
        'What the company sells, to whom, and why. Differentiators. Use cases. Language to explain the product without turning it into a pitch deck.\n\n' +
        'Delete this text and describe this trail in your company context. Then, build the modules that make sense to you.',
    },
    {
      titulo: 'Brand Pitch',
      descricao:
        'WHY THIS TRAIL EXISTS\n' +
        'Every team member will eventually need to present the company in some professional context. ' +
        'Standardizing this helps the whole team — especially salespeople, founders, and HR in recruiting.\n\n' +
        'SUGGESTION OF WHAT TO PUT HERE\n' +
        '30-second, 2-minute, and 5-minute pitches. Pitch for client, for investor, for potential talent. When to use each one.\n\n' +
        'Delete this text and describe this trail in your company context. Then, build the modules that make sense to you.',
    },
  ],
};

const TEMPLATE_CONTENT: Record<TemplateLocale, TemplateContent> = {
  'pt-BR': PT_BR,
  en: EN,
};

/**
 * Returns the template content for the given locale.
 * Falls back to pt-BR if locale is missing or unknown.
 */
export function getTemplateContent(locale: string | undefined | null): TemplateContent {
  if (locale === 'en') return TEMPLATE_CONTENT.en;
  return TEMPLATE_CONTENT['pt-BR'];
}
