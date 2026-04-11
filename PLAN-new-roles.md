# Plano: Novos Roles — Thought Leader + Strategist

## Resumo

Adicionar dois novos roles à plataforma Boldfy:
1. **`thoughtleader`** — Executivo da empresa cliente cujo conteúdo é produzido pela equipe Boldfy (Content Full-Service)
2. **`strategist`** — Profissional da Boldfy que gerencia contas de empresas e produz conteúdo para os TLs

Toda a produção de conteúdo acontece **dentro da Boldfy** (sem integração Notion para conteúdo).

---

## FASE 1: Infraestrutura de Roles (Foundation)

### 1.1 — Middleware + Session Cookie
**Arquivos:** `src/middleware.ts`, `src/lib/session.ts`

- Adicionar novas rotas protegidas:
  ```
  PROTECTED_PREFIXES: ['/admin', '/colaborador', '/master', '/thoughtleader', '/strategist']
  ```
- Atualizar ROLE_ROUTES:
  ```
  thoughtleader: '/thoughtleader'
  strategist: '/strategist'
  ```
- Regra especial: **strategist pode acessar `/admin` routes** (com `?companyId=`) — mesmo padrão do master
- Regra especial: **strategist pode acessar `/thoughtleader` routes** (com `?userId=`) — para ver a visão do TL

### 1.2 — Login Redirect
**Arquivo:** `src/app/login/page.tsx`

- Adicionar redirects:
  ```
  thoughtleader → /thoughtleader/dashboard
  strategist → /strategist/empresas
  ```

### 1.3 — Auth Context
**Arquivo:** `src/contexts/auth-context.tsx`

- Atualizar tipo `AuthUser.role` para incluir `'thoughtleader' | 'strategist'`
- Auto-activate TLs no primeiro login (mesmo padrão do colaborador: Pendente → Ativo)

### 1.4 — Auth Guard Hook
**Arquivo:** `src/hooks/use-auth-guard.ts`

- Adicionar suporte para `role: 'thoughtleader'` e `role: 'strategist'`
- Strategist em modo admin: detectar `?companyId=` e entrar em "Modo Estrategista" (similar ao Modo Master)
- Strategist em modo TL: detectar `?userId=` para ver visão do Thought Leader específico

### 1.5 — Server Auth Guards
**Arquivo:** `src/lib/auth-guard.ts`

- `requireStrategist(idToken)` — exige role strategist
- `requireStrategistOrAdmin(idToken, companyId)` — permite strategist da empresa OU admin
- `requireStrategistForTL(idToken, tlUserId)` — verifica que o strategist está linkado à empresa do TL

### 1.6 — Firestore Rules
**Arquivo:** `firestore.rules`

- Strategist pode ler/escrever users da empresa linkada (como admin)
- Strategist pode ler/escrever subcollections de TLs da empresa linkada
- TL pode ler próprio doc + subcollections (scheduledPosts, contentPipeline, generatedContent)
- TL pode update de contentPipeline (aprovar/rejeitar posts)
- Company subcollection `contentStrategy` e `brandManual` — read por TL e strategist, write por strategist

### 1.7 — i18n
**Arquivo:** `src/lib/i18n/dictionaries/pt-BR.ts`, `en.ts`

- Adicionar seções: `thoughtLeader`, `strategist`, `contentPipeline`
- Nav items, page titles, status labels, etc.

---

## FASE 2: User Management (CRUD)

### 2.1 — Strategist Management (Master cria)
**Arquivo:** `src/app/actions/users.ts` (nova action)

- `inviteStrategist(formData)` — master only
  - Cria user com `role: 'strategist'`
  - Sem companyId (strategist é global, linkado a múltiplas empresas)
  - Campo `assignedCompanies: string[]` no user doc
  - Envia email de convite

### 2.2 — Master Empresas: Assign Strategist
**Arquivo:** `src/app/master/empresas/page.tsx`

- Ao criar empresa, dropdown para selecionar strategist existente
- Campo `strategistId` no company doc
- Ao criar empresa com TL seats, define `tlLicenses` separado de `licenses` (colaborador)

### 2.3 — TL Management (Master ou Admin cria)
**Arquivo:** `src/app/actions/users.ts` (nova action)

- `inviteThoughtLeader(formData)` — master ou admin da empresa
  - Cria user com `role: 'thoughtleader'`, `companyId`, `status: 'Pendente'`
  - Precisa de LinkedIn OAuth (igual colaborador, mas obrigatório)
  - Campo `tlLicenses` na empresa controla quantos TLs podem existir
  - Envia email de convite

### 2.4 — Admin Colaboradores: Seção TL
**Arquivo:** `src/app/admin/colaboradores/page.tsx`

- Adicionar tab ou seção separada "Thought Leaders" abaixo dos colaboradores
- Admin pode convidar TL (se tiver `tlLicenses` disponíveis)
- Mostra lista de TLs com status, LinkedIn connection, strategist atribuído

### 2.5 — Master Estrategistas Page (NOVA)
**Arquivo:** `src/app/master/estrategistas/page.tsx` (NOVO)

- CRUD de strategists
- Tabela: nome, email, empresas atribuídas, status
- Dialog para convidar novo strategist
- Dialog para atribuir/remover empresas

---

## FASE 3: Thought Leader Layout + Pages

### 3.1 — TL Layout
**Arquivo:** `src/app/thoughtleader/layout.tsx` (NOVO)

- Guard: `useAuthGuard({ role: 'thoughtleader', checkLinkedInToken: true })`
- Subscription gate (mesma lógica do colaborador)
- LinkedIn token warnings
- Sidebar com menus:
  ```
  Dashboard         → /thoughtleader/dashboard
  Backlog           → /thoughtleader/backlog        (aprovações de conteúdo)
  Calendário        → /thoughtleader/calendario
  LinkedIn Feed     → /thoughtleader/linkedin-feed
  LinkedIn Leads    → /thoughtleader/linkedin-leads  (coming soon)
  Estratégia        → /thoughtleader/estrategia      (read-only)
  Manual de Marca   → /thoughtleader/manual          (read-only)
  ```

### 3.2 — TL Sidebar Nav
**Arquivo:** `src/components/dashboard/thoughtleader-sidebar-nav.tsx` (NOVO)

### 3.3 — TL Dashboard
**Arquivo:** `src/app/thoughtleader/dashboard/page.tsx` (NOVO)

- Métricas LinkedIn do perfil do TL (impressões, engajamento, seguidores)
- Posts recentes com performance
- Próximos posts agendados
- Cards de status: posts pendentes de aprovação, posts agendados, posts publicados este mês
- SEM ranking, SEM pontos, SEM missões

### 3.4 — TL Backlog (Aprovações)
**Arquivo:** `src/app/thoughtleader/backlog/page.tsx` (NOVO)

- Lista de conteúdos do pipeline com status
- Filtro por status: "Aprovar Ideia", "Em Produção", "Aprovar Post", "Pronto pra Postar"
- Card de cada conteúdo mostra: título, editorial, etapa, formato, data prevista
- Ação: **Aprovar** ou **Solicitar Ajuste** (com campo de comentário)
- Quando TL aprova ideia → status muda para "Em produção"
- Quando TL aprova post → status muda para "Post aprovado" → automaticamente "Pronto pra postar"
- "Pronto pra postar" + data = gatilho de agendamento no LinkedIn

### 3.5 — TL Calendário
**Arquivo:** `src/app/thoughtleader/calendario/page.tsx` (NOVO)

- Reutiliza componente de calendário do colaborador
- Mostra posts do pipeline (status "Pronto pra postar" e "Postado")
- SEM missões no calendário (diferença do colaborador)
- Read-only para o TL (ele não agenda diretamente, quem agenda é o strategist)

### 3.6 — TL LinkedIn Feed
- Reutiliza `/colaborador/linkedin-feed` (mesma lógica, rota diferente)

### 3.7 — TL Estratégia (read-only)
**Arquivo:** `src/app/thoughtleader/estrategia/page.tsx` (NOVO)

- Renderiza a Estratégia de Conteúdo definida pelo strategist
- Seções: Tipos de Conteúdo, Mensagens e Posicionamento, Dores, Soluções, Pilares, Narrativa Central
- Estilo visual: cards estilizados (mesmo layout dos PDFs)
- Read-only para o TL

### 3.8 — TL Manual de Marca (read-only)
**Arquivo:** `src/app/thoughtleader/manual/page.tsx` (NOVO)

- Renderiza o Manual de Marca Pessoal definido pelo strategist
- Seções: Personalidade, Mentalidade, Arquétipos, Tom de Voz, Linguagem, Vocabulário
- Estilo visual: cards estilizados (mesmo layout dos PDFs)
- Read-only para o TL

---

## FASE 4: Strategist Layout + Pages

### 4.1 — Strategist Layout
**Arquivo:** `src/app/strategist/layout.tsx` (NOVO)

- Guard: `useAuthGuard({ role: 'strategist' })`
- Sidebar com menus:
  ```
  Empresas           → /strategist/empresas        (lista de empresas atribuídas)
  ```
- Ao clicar numa empresa, expande sub-menus:
  ```
  [Empresa X]
    Admin Panel      → /admin/dashboard?companyId=X  (modo strategist)
    Thought Leaders  → /strategist/empresas/[id]/tls
  ```
- Ao clicar num TL, abre o workspace do TL:
  ```
  [Felipe Beraldi]
    Dashboard        → /strategist/tl/[userId]/dashboard
    Pipeline         → /strategist/tl/[userId]/pipeline
    Calendário       → /strategist/tl/[userId]/calendario
    Estratégia       → /strategist/tl/[userId]/estrategia
    Manual de Marca  → /strategist/tl/[userId]/manual
  ```

### 4.2 — Strategist Empresas
**Arquivo:** `src/app/strategist/empresas/page.tsx` (NOVO)

- Lista de empresas atribuídas ao strategist
- Card por empresa: nome, plano, TLs ativos, próximos posts
- Click → navega para sub-página da empresa

### 4.3 — Strategist TL List
**Arquivo:** `src/app/strategist/empresas/[companyId]/tls/page.tsx` (NOVO)

- Lista de TLs daquela empresa
- Status de LinkedIn, posts pendentes, último post publicado
- Click → abre workspace do TL

### 4.4 — Strategist TL Dashboard
**Arquivo:** `src/app/strategist/tl/[userId]/dashboard/page.tsx` (NOVO)

- Mesmo dashboard do TL, mas com acesso full
- Métricas LinkedIn, posts recentes, performance

### 4.5 — Strategist TL Pipeline (Editor de Conteúdo)
**Arquivo:** `src/app/strategist/tl/[userId]/pipeline/page.tsx` (NOVO)

- **Este é o coração do fluxo Full-Service**
- Kanban ou lista com colunas de status:
  ```
  Backlog → Aprovar Ideia → Em Produção → Aprovar Post → Post Aprovado → Pronto pra Postar → Postado
  ```
- Formulário de criação de post:
  - Título (title / text)
  - Caption (textarea / rich text)
  - Data prevista (date picker)
  - Status (select — pipeline status)
  - Editorial (select — vem da Estratégia de Conteúdo: ex. "Visão de Mercado", "Bastidores", "Decisões")
  - Etapa (select — Visibilidade, Autoridade, Conversão)
  - Formato (select — Vídeo, Texto, GIF, One pager, Carrossel, Foto, Quote, Meme, Print)
  - Lead Magnet (checkbox)
  - Media (upload de imagem/PDF para carrossel)
- Quando strategist muda status para "Aprovar Ideia" → aparece no backlog do TL
- Quando TL aprova → strategist vê status mudar para "Em Produção"
- Strategist produz → muda para "Aprovar Post"
- TL aprova post → status vira "Post Aprovado" → auto "Pronto pra Postar"
- "Pronto pra Postar" + Data atingida → system agenda no LinkedIn via scheduledPosts

### 4.6 — Strategist TL Calendário
- Mesmo calendário do TL, mas editável
- Strategist pode drag-and-drop posts para reagendar
- Pode criar posts diretamente no calendário

### 4.7 — Strategist TL Estratégia (editável)
**Arquivo:** `src/app/strategist/tl/[userId]/estrategia/page.tsx` (NOVO)

- Formulário completo para definir a Estratégia de Conteúdo
- Campos baseados no PDF template:
  - **Tipos de Conteúdo**: 3 cards (Visibilidade/ToFu, Autoridade/MoFu, Conversão/BoFu) com % e descrição
  - **Mensagens e Posicionamento**: Arqui-inimigo, Posicionamento vs inimigo, Ponto de vista
  - **Narrativa Central**: textarea livre
  - **Dores**: lista de items (título + descrição)
  - **Soluções**: lista de items (título + descrição)
  - **Pilares de Conteúdo**: 3 pilares, cada um com nome, subtítulo, séries (nome + objetivo + insumos)
- Salva em: `companies/{companyId}/thoughtLeaders/{userId}/contentStrategy` (Firestore doc)
- O TL vê isso read-only na aba Estratégia

### 4.8 — Strategist TL Manual de Marca (editável)
**Arquivo:** `src/app/strategist/tl/[userId]/manual/page.tsx` (NOVO)

- Formulário completo para definir o Manual de Marca Pessoal
- Campos baseados no PDF template:
  - **Personalidade**: descrição geral + 3 atributos (título + descrição)
  - **Mentalidade**: lista de princípios (título + descrição)
  - **Arquétipos**: principal (título + descrição) + secundário (título + descrição)
  - **Tom de Voz**: 6 tons (título + descrição)
  - **Situações**: como aparece em diferentes contextos (lista)
  - **Linguagem e Estilo**: 4 estilos de escrita (título + descrição)
  - **Boas Práticas**: lista de "faça" + lista de "não faça"
  - **Vocabulário**: palavras-chave (tags) + expressões características (lista)
  - **Resumo**: posicionamento, proposta de valor, diferencial, missão
- Salva em: `companies/{companyId}/thoughtLeaders/{userId}/brandManual` (Firestore doc)
- O TL vê isso read-only na aba Manual

---

## FASE 5: Content Pipeline (Firestore + Server Actions)

### 5.1 — Firestore Collection
**Coleção:** `companies/{companyId}/thoughtLeaders/{userId}/contentPipeline/{postId}`

Documento:
```typescript
{
  title: string;              // "Leis trabalhistas"
  caption: string;            // Texto do post LinkedIn
  scheduledFor: string | null; // ISO date — data prevista de publicação
  status: 'backlog' | 'aprovar_ideia' | 'em_producao' | 'aprovar_post' | 'post_aprovado' | 'pronto_pra_postar' | 'postado' | 'ajuste' | 'arquivado';
  editorial: string;          // "Visão de Mercado" | "Bastidores e Aprendizados" | "Decisões Estratégicas"
  etapa: string;              // "Visibilidade" | "Autoridade" | "Conversão"
  formato: string;            // "Vídeo" | "Texto" | "GIF" | "One pager" | "Carrossel" | "Foto" | "Quote" | "Meme" | "Print"
  leadMagnet: boolean;
  mediaUrl?: string;          // URL da mídia (imagem, PDF carrossel)
  mediaType?: string;         // MIME type

  // Feedback / aprovação
  tlFeedback?: string;        // Comentário do TL quando rejeita
  tlApprovedAt?: string;      // Timestamp de aprovação

  // LinkedIn tracking (preenchido após publicação)
  linkedinPostId?: string;
  linkedinPostUrl?: string;
  publishedAt?: string;

  // Audit
  createdBy: string;          // strategist userId
  createdAt: string;
  updatedAt: string;
}
```

### 5.2 — Server Actions
**Arquivo:** `src/app/actions/content-pipeline.ts` (NOVO)

- `createPipelinePost(idToken, companyId, tlUserId, data)` — strategist only
- `updatePipelinePost(idToken, companyId, tlUserId, postId, data)` — strategist only
- `approvePipelineIdea(idToken, postId)` — TL approves idea → status: em_producao
- `approvePipelinePost(idToken, postId)` — TL approves post → status: post_aprovado → pronto_pra_postar
- `requestAdjustment(idToken, postId, feedback)` — TL requests changes → status: ajuste
- `schedulePipelinePost(idToken, postId)` — system/strategist moves "pronto_pra_postar" to scheduledPosts

### 5.3 — Auto-scheduling Cron
**Arquivo:** `src/app/api/cron/publish-tl-posts/route.ts` (NOVO)

- Runs periodically (or triggered by Cloud Scheduler)
- Finds all posts with status "pronto_pra_postar" where scheduledFor <= now
- Creates corresponding scheduledPost in user's subcollection
- Updates status to "postado" after LinkedIn publishes
- Uses same LinkedIn posting infrastructure as colaborador

---

## FASE 6: Company Data Model Updates

### 6.1 — Company Doc Changes
```typescript
// Novos campos no doc companies/{companyId}
{
  strategistId: string | null;   // userId do strategist atribuído
  tlLicenses: number;            // número de seats de Thought Leader (separado de licenses)
  // licenses continua sendo seats de colaborador
}
```

### 6.2 — Strategist User Doc
```typescript
// Doc users/{userId} com role: 'strategist'
{
  role: 'strategist',
  name: string,
  profile: { name, email, avatarUrl },
  assignedCompanies: string[],   // lista de companyIds
  createdAt: timestamp,
}
```

### 6.3 — Thought Leader User Doc
```typescript
// Doc users/{userId} com role: 'thoughtleader'
{
  role: 'thoughtleader',
  name: string,
  companyId: string,
  companyName: string,
  status: 'Pendente' | 'Ativo' | 'Inativo',
  profile: { name, email, avatarUrl },
  linkedinConnection: { ... },   // mesmo schema do colaborador
  createdAt: timestamp,
}
```

---

## FASE 7: Pricing / Billing Considerations

### 7.1 — TL Seats são separados de Colaborador Seats
- `licenses` = seats de colaborador (pricing: R$349-499/seat)
- `tlLicenses` = seats de TL (pricing: R$5.500+ conforme matriz do site)
- Na subscription gate, verificar ambos os limites separadamente
- No checkout Stripe, TL seats terão price_id diferente

### 7.2 — Master Empresas: Mostrar ambos
- Tabela de empresas mostra colunas: Colaboradores (X/Y), TLs (X/Y)

---

## Ordem de Implementação

```
FASE 1: Infraestrutura (middleware, auth, guards, i18n)     ~1 sessão
FASE 2: User Management (CRUD strategist + TL)              ~1 sessão
FASE 3: TL Layout + Pages                                   ~2 sessões
FASE 4: Strategist Layout + Pages                           ~2 sessões
FASE 5: Content Pipeline (Firestore + actions + cron)        ~1 sessão
FASE 6: Company Data Model                                  ~incluso nas fases acima
FASE 7: Billing                                             ~futuro (quando pricing TL estiver definido)
```

**Total estimado: ~7 sessões de trabalho**

---

## Arquivos Novos (resumo)

```
src/app/thoughtleader/
  layout.tsx
  dashboard/page.tsx
  backlog/page.tsx
  calendario/page.tsx
  linkedin-feed/page.tsx
  estrategia/page.tsx
  manual/page.tsx

src/app/strategist/
  layout.tsx
  empresas/page.tsx
  empresas/[companyId]/tls/page.tsx
  tl/[userId]/
    dashboard/page.tsx
    pipeline/page.tsx
    calendario/page.tsx
    estrategia/page.tsx
    manual/page.tsx

src/components/dashboard/
  thoughtleader-sidebar-nav.tsx
  strategist-sidebar-nav.tsx

src/app/actions/
  content-pipeline.ts

src/app/api/cron/
  publish-tl-posts/route.ts

src/app/master/
  estrategistas/page.tsx
```

## Arquivos Modificados (resumo)

```
src/middleware.ts                    — novos roles nas rotas
src/app/login/page.tsx               — novos redirects
src/contexts/auth-context.tsx        — novos roles no tipo + auto-activate TL
src/hooks/use-auth-guard.ts          — suporte strategist mode
src/lib/auth-guard.ts                — novas guards
src/app/actions/users.ts             — inviteStrategist + inviteThoughtLeader
src/app/master/empresas/page.tsx     — assign strategist + TL seats
src/app/admin/colaboradores/page.tsx — seção TLs
firestore.rules                      — regras para novos roles + collections
src/lib/i18n/dictionaries/pt-BR.ts   — novas traduções
src/lib/i18n/dictionaries/en.ts      — novas traduções
```
