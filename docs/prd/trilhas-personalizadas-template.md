# PRD — Trilha Personalizada Template (Sessão Pré-Mockada por Empresa)

**Status:** Draft (revisado contra o código)
**Owner:** Clara
**Última atualização:** 2026-05-10
**Tipo:** Feature de produto — Onboarding de empresa + Sistema de Trilhas

---

## TL;DR

Toda empresa nova criada na Boldfy nasce com uma **sessão pré-mockada** chamada "Trilhas Personalizadas — Template" dentro do seu próprio espaço de sessões customizadas. A sessão contém 5 trilhas-esqueleto (Visão/Missão/Valores, Identidade Visual, Identidade Verbal, Produto/Proposta de Valor, Pitch de Marca). Cada trilha vem **vazia de módulos**, só com **título** e **descrição em texto plano** — a descrição explica por que aquela trilha existe e dá sugestões do que o admin poderia colocar ali. Admin lê a descrição como guia, apaga, escreve a sua, e adiciona módulos do zero usando o Trail Builder normal.

A implementação **espelha o padrão existente de `seedNativeRewards`** (server action idempotente, batch write, locale-aware, com migration function pareada) — zero código novo de plataforma, zero mudança em UI existente no slice 1.

---

## Problema

Hoje, quando uma empresa nova é criada na Boldfy, o admin tem dois caminhos no menu **Trilhas**: ativar trilhas globais (já produzidas pela Boldfy) ou criar trilhas customizadas do zero. O segundo caminho é poderoso, mas começa numa página em branco — e ninguém sabe o que construir primeiro.

Dois sintomas que o produto já mostra:

- O admin não enxerga **o que** uma trilha customizada deveria existir para a sua empresa (visão, identidade visual, identidade verbal, produto, pitch). Sem um modelo, ele copia a estrutura das globais — que são genéricas — ou simplesmente não cria.
- O ramp-up de novos colaboradores em onboarding comercial (sales rep novo, founder pitchando, time de marketing entrando) depende exatamente desse conteúdo proprietário da empresa. Sem ele, a Boldfy é uma ferramenta de capacitação genérica, não uma plataforma de cultura e narrativa interna.

Custo de não resolver: trilhas customizadas viram um feature que ninguém usa, e a Boldfy perde o seu papel mais defensável — ser o lugar onde a marca da empresa vira produto editorial para os colaboradores.

---

## Goals

1. **Eliminar a página em branco.** 100% das empresas novas têm a sessão template visível na primeira vez que abrem **Admin → Trilhas → aba Empresa**, com as 5 trilhas-esqueleto e descrições que explicam o porquê de cada uma.
2. **Aumentar criação de trilhas customizadas em 30+ dias após criação da empresa.** Meta: ≥ 40% das empresas novas têm pelo menos uma trilha personalizada com módulos reais (não apenas a descrição-guia) em até 30 dias da criação.
3. **Não confundir com trilhas globais.** Zero ambiguidade visual e estrutural entre "Trilha Global ativada" e "Trilha Personalizada Template" — admin entende em < 5 segundos a diferença.
4. **Servir o caso de uso de onboarding comercial.** Empresas que usam Boldfy para ramp-up de vendedores/founders conseguem montar conteúdo proprietário de marca em < 2 semanas (vs. abandono do feature hoje).

---

## Non-Goals

1. **Não vamos produzir conteúdo real para essas trilhas.** A Boldfy entrega o esqueleto. Conteúdo (módulos, vídeo, texto, quiz) é da empresa.
2. **Não vamos prescrever módulos.** As trilhas vêm vazias de módulos. Cada admin decide a estrutura que faz sentido pra empresa dele. Sugestões existem só como texto na descrição da trilha — pra inspirar, não pra impor.
3. **Não vamos criar entidade de dados nova.** A sessão template usa a estrutura existente de `Sessao` + `Trilha`, com flags **opcionais** que sinalizam a natureza template. Reaproveitar schema = menos código novo, menos divergência futura.
4. **Não vamos travar a sessão.** Admin pode editar livremente, deletar, mudar ordem, deletar a sessão inteira — usando os fluxos de CRUD que já existem em `src/app/admin/trilhas/page.tsx`. Sem locks especiais.
5. **Não vamos versionar o template inicialmente.** Quando atualizarmos a estrutura sugerida (v2 do template), empresas existentes não recebem atualização automática.
6. **Não vamos mexer em `firestore.rules`.** O seed roda via Admin SDK em server action — bypassa rules. Subcoleções `sessions` e `trails` já têm rules genéricas que cobrem o caso.
7. **Não vamos suportar markdown na descrição.** Confirmado: `Trilha.descricao` é renderizada como texto plano (`<p>{trail.descricao}</p>` em `trail-card.tsx`, `<CardDescription>{trail.descricao}</CardDescription>` em `trail-intro-screen.tsx`). Hierarquia da descrição-guia é feita com quebras de linha, sem `**` ou `#`.

---

## Padrões do código a seguir (referências reais)

Esta seção lista os padrões existentes no codebase que a implementação tem que espelhar. **Toda decisão técnica abaixo é cópia ou adaptação direta de algo que já roda em produção.**

### 1. Padrão de seed na criação de empresa
**Referência:** `src/app/actions/company-setup.ts` — `seedNativeRewards(companyId)`

Características que o nosso `seedTemplatePersonalizado` deve copiar:
- **Server action** (`'use server'` no topo do arquivo).
- **Usa Admin SDK** (`adminDb` de `@/lib/firebase-admin`) para writes — bypassa firestore rules.
- **Idempotente:** lê o estado antes de escrever, skipa se já existe (no `seedNativeRewards`, a checagem é `where('isNative', '==', true).limit(1).get()`).
- **Batch write** (`adminDb.batch()`) para múltiplas escritas atômicas.
- **Lê locale do doc da empresa** para escolher idioma do conteúdo.
- **Retorna** `Promise<{ created: number; skipped: boolean }>`.
- **Função de migração pareada** com `requireMaster(idToken)` — exemplo: `migrateAllCompaniesNativeRewards`. Permite rodar uma vez em empresas existentes via endpoint master.
- **Não tem try/catch wrap** dentro de `seedNativeRewards` em si — confia em Firestore Admin SDK. Mas no nosso caso vamos fazer **diferente** (ver decisão abaixo).

### 2. Padrão de uso na `inviteAdmin`
**Referência:** `src/app/actions/users.ts:516` — `await seedNativeRewards(companyId);`

A chamada está logo depois do slug ser gerado (linha 501) e **antes** do `if (skipInvite)`. Isso significa que roda **em ambos os casos** (com ou sem admin convidado), o que é o comportamento que queremos.

**Desvio justificado do padrão:** vamos chamar `seedTemplatePersonalizado` **dentro de try/catch** para que falha do seed não quebre a criação da empresa. Native rewards são parte central do produto (sistema de pontos), então `seedNativeRewards` faz sentido subir exception. Trilhas template são guia/onboarding — uma empresa criada sem elas ainda funciona perfeitamente, e podemos rodar a migration depois pra cobrir.

```ts
try {
  await seedTemplatePersonalizado(companyId);
} catch (err) {
  console.error('[inviteAdmin] seedTemplatePersonalizado falhou (nao bloqueante):', err);
}
```

### 3. Padrão de activity log
**Referência:** `src/app/actions/users.ts:504` (no fluxo da `inviteAdmin`).

`appendActivityLog(companyId, { kind, actorRole, actorUid, summary }, { idempotencyKey })`. Função é defensiva — loga erro internamente mas não joga exception. Vamos adicionar uma entry após o seed:

```ts
await appendActivityLog(companyId, {
  kind: 'template_personalizado.seeded',
  actorRole: 'master',
  actorUid: null,
  summary: 'Sessao template "Trilhas Personalizadas" criada com 5 trilhas',
}, { idempotencyKey: `${companyId}_template_seed` });
```

### 4. Padrão de timestamps
**Referência:** múltiplos lugares em `inviteAdmin` e `seedNativeRewards`.

- Server action (Admin SDK): `FieldValue.serverTimestamp()` de `firebase-admin/firestore`.
- Cliente (firestore web SDK): `Timestamp.now()` de `firebase/firestore`.

Como nosso seed é server action, usar **`FieldValue.serverTimestamp()`** em `criadaEm` da Sessão e cada Trilha.

### 5. Padrão de schema de Sessao customizada (CRUD existente)
**Referência:** `src/app/admin/trilhas/page.tsx:173` — `saveCompanySession`.

Quando admin cria uma sessão customizada hoje, o doc tem:
```ts
{ titulo, descricao, ordem, ativa: true, criadaEm: Timestamp.now() }
```

Nosso seed cria uma sessão com **os mesmos campos** + o novo `tipo: 'template_personalizado'`. UI que lista sessões em `loadCompanyData` (linha 115) já vai pegar a nossa automaticamente, sem mudança de código.

### 6. Padrão de schema de Trilha customizada (CRUD existente)
**Referência:** `src/app/admin/trilhas/page.tsx:271` — `saveCompanyTrail`.

Trilha customizada hoje tem:
```ts
{
  sessionId, titulo, descricao, ordem, ativa: true,
  pontuacaoTotal, pontuacaoBonus, pontuacaoBonusTrilha,
  tempoEstimadoMin, modulos, criadaEm, atualizadaEm
}
```

Nosso seed cria 5 trilhas com **os mesmos campos** + a nova flag `isTemplate: true`, com:
- `modulos: []`
- `pontuacaoTotal: 0`, `pontuacaoBonus: 0`, `pontuacaoBonusTrilha: 0`
- `tempoEstimadoMin: 0`
- `ativa: false` (não publicada por padrão — não aparece pro colaborador até admin ativar)

### 7. Padrão de i18n
**Referência:** uso de `useT()` e `useLocale()` em todas as páginas admin.

Conteúdo das 5 trilhas (título + descrição) precisa estar disponível em **pt-BR e en**. Vamos colocar em `src/lib/trilhas/template-content.ts` como constante, com a estrutura:

```ts
export const TEMPLATE_CONTENT = {
  'pt-BR': { sessaoTitulo, sessaoDescricao, trilhas: [...] },
  'en': { sessaoTitulo, sessaoDescricao, trilhas: [...] },
};
```

Seed lê `companyDoc.data()?.locale || 'pt-BR'` (mesmo padrão de `seedNativeRewards`).

---

## Personas e User Stories

### Persona principal: **Admin de empresa nova**
Geralmente: founder, head of marketing, head of people, ou líder comercial. Acabou de fazer onboarding na Boldfy, configurou contexto de marca, ativou algumas trilhas globais. Agora chegou na pergunta: "e o conteúdo da MINHA empresa?"

- Como admin de empresa nova, quero ver uma lista de trilhas que faria sentido eu criar pra minha empresa, com explicação do porquê de cada uma, para entender o potencial sem precisar começar do zero.
- Como admin, quero saber claramente que essas trilhas template **não** são conteúdo que a Boldfy produziu — são esqueletos vazios pra eu construir — para não distribuí-las acidentalmente para o time vazias.
- Como admin, quero ler a descrição-guia de cada trilha e depois apagá-la, escrevendo a minha própria descrição, sem que isso quebre nada.
- Como admin, quero adicionar os módulos que eu achar que fazem sentido em cada trilha, sem ter um esqueleto de módulos pré-criado me dizendo o que fazer.
- Como admin, quero poder deletar a sessão template inteira se ela não fizer sentido para mim, sem prejudicar nada do resto da plataforma.

### Persona secundária: **Admin de empresa em onboarding comercial**
- Como líder comercial, quero ver "Pitch de Marca" como uma trilha sugerida, com explicação do porquê ela faz sentido, para validar a ideia antes de investir tempo construindo.
- Como líder comercial, quero que vendedores novos cheguem na plataforma e encontrem trilhas que façam sentido para o nosso negócio (não só capacitação genérica de LinkedIn).

### Persona terciária: **Colaborador**
- Como colaborador novo na empresa, quero entender Visão/Missão/Valores, Identidade Visual, Identidade Verbal, Produto e Pitch da minha empresa em um lugar só, para acelerar meu ramp-up.
- Como colaborador, quero que essas trilhas pareçam parte da empresa (não da Boldfy), para que o conteúdo tenha autoridade interna.

### Persona interna: **Time da Boldfy (CS)**
- Como CS, quero ver na conta da empresa quais trilhas template ainda estão sem módulos vs. quais já foram construídas, para saber onde abrir conversa de ativação.

---

## Slices de Implementação

### Slice 1 — Seed (backend + dados, risco quase zero)

**Objetivo:** toda empresa nova nasce com a sessão template. Nenhuma mudança visual em UI existente. Admin vê a sessão na lista de sessões customizadas como qualquer outra (sem badge ainda — vem no Slice 2).

**Arquivos novos:**
- `src/lib/trilhas/template-content.ts` — constantes pt-BR e en com título da sessão + título/descrição das 5 trilhas. Sem dependências do código existente.
- (Função adicionada em arquivo existente: ver abaixo.)

**Arquivos tocados (mudanças mínimas, additivas):**

1. `src/types/trilhas.ts` — adicionar 2 campos opcionais:
   ```ts
   // Em Sessao:
   tipo?: 'global' | 'customizada' | 'template_personalizado';
   
   // Em Trilha (já tem isGlobal? — adicionar ao lado):
   isTemplate?: boolean;
   ```
   **Retrocompat:** sessões/trilhas existentes não têm esses campos. Front trata `tipo === undefined` como "customizada" e `isTemplate === undefined` como `false`. Sem migration de dados necessária pra schema.

2. `src/app/actions/company-setup.ts` — adicionar função `seedTemplatePersonalizado(companyId)` no mesmo arquivo de `seedNativeRewards`, espelhando estrutura. Adicionar também `migrateAllCompaniesTemplatePersonalizado(idToken)` ao lado de `migrateAllCompaniesNativeRewards`.

3. `src/app/actions.ts` — adicionar export das novas funções (mesma linha 14 onde já exporta as de company-setup).

4. `src/app/actions/users.ts` — dentro de `inviteAdmin`, **logo depois** da linha 516 (`await seedNativeRewards(companyId);`), adicionar:
   ```ts
   try {
     await seedTemplatePersonalizado(companyId);
   } catch (err) {
     console.error('[inviteAdmin] seedTemplatePersonalizado falhou (nao bloqueante):', err);
   }
   ```
   Justificativa do try/catch: ver **Padrões → 2** acima.

**Não vou tocar no Slice 1:**
- Trail Builder (`src/components/trilhas/trail-builder.tsx`)
- Trail Player (`src/components/trilhas/player/*`)
- Página `src/app/admin/trilhas/page.tsx` (ela já carrega sessões customizadas naturalmente — a nossa vai aparecer)
- Página `src/app/admin/trilhas/[id]/page.tsx` do colaborador
- `firestore.rules` (server action via Admin SDK bypassa)
- Qualquer componente de UI

**Critérios de aceitação (Slice 1):**
- Master cria empresa nova → Firestore tem `companies/{novoId}/sessions/{templateSessaoId}` com `tipo: 'template_personalizado'` + 5 docs em `trails` com `isTemplate: true`, `modulos: []`, `ativa: false`.
- Admin da empresa nova abre **Trilhas → aba Empresa** → vê a sessão "Trilhas Personalizadas — Template" listada com as 5 trilhas (sem badge novo, mas visível).
- Admin clica numa trilha template → abre o Trail Builder com a descrição-guia preenchida e `modulos: []`. Pode editar normalmente.
- Admin tenta deletar a sessão → funciona, fluxo igual a deletar qualquer sessão customizada.
- `seedTemplatePersonalizado` é **idempotente** — chamar 2x não cria duplicata (checagem via `where('isTemplate', '==', true).limit(1)`).
- Empresa criada com `skipInvite: true` também recebe o seed.
- Activity log tem entry `template_personalizado.seeded`.
- Empresas criadas **antes** do deploy não recebem o seed automaticamente (decisão Q1 sobre rodar migration).

**Validações pré-implementação (vou rodar antes de codar):**
- [ ] Confirmar que `Trail Builder` abre uma trilha com `modulos: []` sem quebrar (já vi no código que faz `modulos: trail.modulos || []`, mas vou abrir e testar o caminho visual).
- [ ] Confirmar que `Trail Card` no admin renderiza trilha com `pontuacaoTotal: 0` e `0 modulos` sem visual quebrado (badge mostra "0 modulos" segundo `trail-card.tsx:40`).
- [ ] Confirmar que trilha com `ativa: false` **não aparece** pro colaborador (`useT` filtra por `ativa` no carregamento — preciso confirmar).
- [ ] Confirmar que sessão com `ativa: true` mas sem trilhas ativas não cria estado vazio confuso pro colaborador.

### Slice 2 — UI (PR separado, depois do Slice 1 estar rodando em prod)

**Objetivo:** diferenciar visualmente a sessão template das outras, e proteger admin de publicar trilha vazia.

Este slice toca componentes existentes — vou planejar com mais cuidado quando chegar nele. Escopo provável:
- Badge `Template` ou `Editável` no card de trilha quando `isTemplate === true` (`src/components/trilhas/trail-card.tsx`).
- Banner no topo da sessão quando `tipo === 'template_personalizado'` (`src/app/admin/trilhas/page.tsx`).
- Bloqueio de publicação: trilha com `modulos: []` não pode ter `ativa: true`. Adicionar guard em `toggleCompanyTrailActive` (linha 224 da mesma página).
- Aviso ao publicar se descrição ainda contém o texto original do seed (proteção extra contra colaborador ver instruções).

**Não está no escopo desse PRD detalhar Slice 2** — vamos especificar quando o Slice 1 estiver pronto e a gente tiver visto como ficou na prática.

---

## Conteúdo das 5 Trilhas Template

> Cada trilha vem com **título** + **descrição em texto plano** (sem markdown — confirmado contra renderização atual). Hierarquia simulada com quebras de linha. As constantes abaixo vão para `src/lib/trilhas/template-content.ts`.

### Sessão (container)

**Título:** `Trilhas Personalizadas — Template`

**Descrição:**
```
Estas trilhas sao esqueletos para voce adaptar com o conteudo da sua empresa.

Cada trilha tem uma descricao explicando por que ela existe e o que voce poderia colocar ali. Apague essa instrucao e construa os modulos do jeito que faz sentido pra voce.
```

### Trilha 1 — Visão, Missão e Valores

**Descrição:**
```
POR QUE ESTA TRILHA EXISTE
E a fundacao. Sem isso, o colaborador nao tem materia-prima pra contextualizar o resto. Visual e verbal sao manifestacoes da identidade — a identidade vem antes.

SUGESTAO DO QUE COLOCAR AQUI
Quem e a empresa por dentro, por que existe, pra onde vai, o que defende. Pode ser depoimento do CEO/founder, historia da empresa, valores em pratica com exemplos reais, missao e visao explicadas.

Apague este texto e descreva esta trilha no contexto da sua empresa. Depois, construa os modulos que fizerem sentido pra voce.
```

### Trilha 2 — Identidade Visual

**Descrição:**
```
POR QUE ESTA TRILHA EXISTE
Colaborador precisa saber como a marca aparece, e como respeitar isso quando criar conteudo proprio.

SUGESTAO DO QUE COLOCAR AQUI
Logo, paleta de cores, tipografia, uso correto e usos errados, exemplos visuais, brand book em PDF, templates de carrossel/imagens.

Apague este texto e descreva esta trilha no contexto da sua empresa. Depois, construa os modulos que fizerem sentido pra voce.
```

### Trilha 3 — Identidade Verbal

**Descrição:**
```
POR QUE ESTA TRILHA EXISTE
Evita conteudo de fachada — o colaborador entende o tom da marca antes de criar conteudo em nome proprio com a empresa como contexto.

SUGESTAO DO QUE COLOCAR AQUI
Tom de voz, vocabulario proprio, do's & don'ts da escrita corporativa, frase assinatura se houver, exemplos antes/depois.

Apague este texto e descreva esta trilha no contexto da sua empresa. Depois, construa os modulos que fizerem sentido pra voce.
```

### Trilha 4 — Produto e Proposta de Valor

**Descrição:**
```
POR QUE ESTA TRILHA EXISTE
Colaborador que nao entende o produto vai falar besteira. Conhecer o produto e base pra criar conteudo legitimo.

SUGESTAO DO QUE COLOCAR AQUI
O que a empresa vende, pra quem, e por que. Diferenciais. Casos de uso. Linguagem pra explicar o produto sem virar pitch deck.

Apague este texto e descreva esta trilha no contexto da sua empresa. Depois, construa os modulos que fizerem sentido pra voce.
```

### Trilha 5 — Pitch de Marca

**Descrição:**
```
POR QUE ESTA TRILHA EXISTE
Todo colaborador eventualmente vai ter que apresentar a empresa em algum contexto profissional. Padronizar isso ajuda o time inteiro — especialmente vendedores, founders, e RH em recrutamento.

SUGESTAO DO QUE COLOCAR AQUI
Pitch de 30 segundos, 2 minutos e 5 minutos. Pitch pra cliente, pra investidor, pra possivel talento. Quando usar cada um.

Apague este texto e descreva esta trilha no contexto da sua empresa. Depois, construa os modulos que fizerem sentido pra voce.
```

> **Versão `en`** segue a mesma estrutura traduzida — vou escrever quando confirmar com Clara que o copy pt-BR está bom.

> **Acentuação:** removi acentos pra evitar problemas de encoding em Firestore (notei que outros campos do código também não usam acentos consistentemente). Pode revisar se preferir acentos completos.

---

## Mudanças de Schema

### `src/types/trilhas.ts` — únicas mudanças no schema

```ts
export interface Sessao {
  // ... campos existentes intactos
  tipo?: 'global' | 'customizada' | 'template_personalizado';
}

export interface Trilha {
  // ... campos existentes intactos
  // (já existe isGlobal?: boolean — adicionar isTemplate ao lado)
  isTemplate?: boolean;
}
```

**Retrocompatibilidade:** ambos campos são **opcionais**. Sessões e trilhas que existem hoje no Firestore não precisam de migration — `undefined` é tratado pelo front como "customizada" / "não-template".

**Nada muda em `Modulo`, `ProgressoTrilha`, `WorkbookResponse`, `TrilhaAtivadaEmpresa`, ou qualquer outro tipo.**

### `firestore.rules` — não muda

A coleção `companies/{id}/sessions` e a deep sub `companies/{id}/sessions/{id}/trails` já têm rules genéricas (linhas 205-254) que cobrem o caso. Server action escreve via Admin SDK e bypassa. Cliente do admin/colaborador lê via rules existentes.

---

## Fluxo do Admin (UX no Slice 1)

```
1. Empresa criada → seed roda → sessão template existe com 5 trilhas vazias (ativa: false)
2. Admin abre Admin → Trilhas
3. Aba "Globais" → catálogo Boldfy (sem mudança)
4. Aba "Empresa" → vê a sessão "Trilhas Personalizadas — Template" no topo da lista de sessões customizadas
   (Aparece igual a qualquer outra sessão — sem badge especial nesse slice)
5. Clica numa trilha template → abre Trail Builder
6. Vê a descrição-guia explicando por que aquela trilha existe e o que poderia colocar ali
   Modulos: lista vazia. Pode adicionar do zero.
7. Apaga a descrição, escreve a sua, adiciona módulos, salva
8. Toggle "ativa" → trilha vira visível pro colaborador
```

**No Slice 2** entra: badge na trilha template, banner explicativo no topo da sessão, bloqueio de toggle "ativa" se `modulos: []`.

---

## Success Metrics

### Leading (mede em 7-30 dias)
- **% de empresas novas que abrem pelo menos uma trilha template** — meta: ≥ 80% em 7 dias.
- **% de empresas novas que adicionam pelo menos 1 módulo a alguma trilha template** — meta: ≥ 50% em 14 dias.
- **% de empresas novas que editam a descrição de pelo menos 1 trilha template** — meta: ≥ 60% em 14 dias.
- **% de empresas novas que deletam a sessão template** — sinal negativo se > 20%.

### Lagging (mede em 60-90 dias)
- **% de empresas com pelo menos 1 trilha personalizada publicada** — meta: ≥ 40% em 60 dias.
- **Engajamento dos colaboradores em trilhas customizadas** — comparar % de conclusão entre customizadas e globais.
- **Redução de churn em primeiros 90 dias** — empresas que ativam ≥ 1 trilha customizada têm churn menor?

### Como medir
- Activity log já tem entry `template_personalizado.seeded`.
- Pra eventos de uso (open, edit, add module), adicionar entries no activity log dentro dos handlers existentes da `admin/trilhas/page.tsx` — mas isso é **fora do escopo do Slice 1** (touching UI). Pode ir no Slice 2 ou virar um Slice 3 só de telemetria.
- Avaliação semanal nas primeiras 4 semanas pós-launch.

---

## Open Questions

| # | Questão | Quem responde | Bloqueia? | Status |
|---|---------|---------------|-----------|--------|
| Q1 | Backfill: rodar `migrateAllCompaniesTemplatePersonalizado` em empresas existentes pós-launch? | Clara + CS | Não bloqueia eng (a função existe pareada), bloqueia rollout | Pendente |
| Q2 | Trilhas template publicadas (depois de admin preencher) devem aparecer pro colaborador como "Trilhas da Empresa" misturadas com globais ativadas, ou em seção separada? | Design + Produto | Sim — afeta Slice 2 | Pendente — não bloqueia Slice 1 |
| Q3 | Quem revisa o copy final das descrições das 5 trilhas? Aprovado o texto da seção **Conteúdo das 5 Trilhas Template** acima? | Clara | Sim — bloqueia ship do Slice 1 | Pendente |
| Q4 | ~~Locale~~ | — | — | **RESOLVIDA** — código já lê `companyDoc.data()?.locale` (mesmo padrão de seedNativeRewards). Vamos suportar pt-BR e en desde o seed. |
| Q5 | Visualmente, "badge Template" usa qual cor da paleta Boldfy? | Design + identidade visual | Sim — afeta Slice 2 | Pendente — não bloqueia Slice 1 |
| Q6 | ~~Markdown na descrição~~ | — | — | **RESOLVIDA** — texto plano (Clara confirmou). |
| Q7 | Acentuação no conteúdo do seed: manter sem acentos (estilo de outros campos) ou colocar acentuação completa (UX melhor)? | Clara | Não bloqueia código, afeta copy | Pendente |

---

## Risks

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| `seedTemplatePersonalizado` falhar e quebrar criação de empresa | Baixa | Alto | Wrap em try/catch dentro de `inviteAdmin` (ver Padrões → 2). Migration pareada cobre empresas que falharem. |
| Trail Builder ou Trail Player quebrar com `modulos: []` | Média | Alto | Validar **antes** de codar (item da checklist em Slice 1). Se quebrar, ou (a) ajustar o seed pra pôr 1 módulo placeholder mínimo, ou (b) corrigir o componente — mas (b) sai do escopo de "não mexer em UI existente". |
| Admin confunde trilha template (vazia) com pronta e tenta distribuir | Alta sem proteção | Alto | **Proteção real só vem no Slice 2** (bloqueio de publicação). No Slice 1, trilhas nascem com `ativa: false`, mitigando parcialmente — admin precisa ativar manualmente. |
| Admin não entende que precisa apagar a descrição-guia e publica trilha com texto da Boldfy | Média | Médio | Mitigação no Slice 2 (aviso ao publicar). Slice 1 sem proteção — risco aceito. |
| Empresas ignoram a sessão e ela vira ruído | Média | Médio | Métricas pós-launch detectam. Considerar nudge no dia 7 (P1 do PRD original). |
| Sessão template "engessa" admins criativos | Baixa | Baixo | Sessão é deletável — fluxo de delete já existe. |

---

## Apêndice — notas de produto

- **Posicionamento interno:** essa feature não é sobre "ter mais trilhas". É sobre **transformar o ato de criar trilhas customizadas em um onboarding visual da própria marca**. O valor pra empresa não é ter conteúdo pronto — é a estrutura forçar o exercício de articular Visão/Identidade/Produto/Pitch.
- **Caso de uso de ramp-up comercial é o mais nítido para sales.** Demo: mostrar essa sessão template (especialmente trilhas 4 e 5) já no pitch.
- **Diferenciação vs. globais é existencial — mas só vai existir no Slice 2.** No Slice 1, a sessão template aparece como qualquer outra sessão customizada. Aceitável como entrega intermediária, mas o valor pleno depende do Slice 2.
- **Por que sem módulos pré-criados:** decisão consciente de não impor estrutura. Cada empresa tem cultura de aprendizado diferente — algumas preferem só vídeo, outras quizzes pesados. Prescrever módulos vira ruído.
- **Por que dois slices:** o slice 1 tem risco quase zero (puramente aditivo, nenhuma UI tocada) e já entrega o valor de "empresa não nasce com página em branco". O slice 2 toca UI existente e merece atenção/teste à parte. Separar protege o "app redondinho que já funciona".
