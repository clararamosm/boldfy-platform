# Spec — Acesso do Admin ao conteúdo dos líderes (Modo Executivo)

**Status:** rascunho para revisão
**Autora do pedido:** Clara
**Data:** 30/06/2026

---

## 1. Contexto e problema

Hoje, no fluxo de Modo Executivo, **apenas o próprio Thought Leader (TL)** consegue aprovar, pedir ajuste e interagir com os posts dele. Na prática, os líderes nem sempre têm tempo de entrar na plataforma para destravar o pipeline, e o conteúdo fica parado em `aprovar_post`.

O admin da empresa hoje só enxerga, no Modo Executivo, a parte de **Analytics dos Thought Leaders** (dropdown de seleção + dashboard read-only). Ele não tem visão do calendário, do backlog nem poder de aprovar/comentar.

## 2. Objetivo

Dar ao **admin da empresa** as mesmas **ações de conteúdo que o próprio TL tem** — aprovar, comentar e pedir ajuste — porém:

- escopado **somente aos líderes da própria empresa** (`admin.companyId === tl.companyId`);
- com acesso a **todos os executivos daquela conta** (enquanto cada conta de executivo continua vendo só a dela);
- **registrando quem fez cada ação** (o admin, no lugar do líder), com rastreabilidade visível.

Assim, quando o líder não consegue entrar, o admin destrava o post por ele — sem perder o histórico de quem aprovou.

## 3. Escopo

### Dentro do escopo
- **Reorganizar o grupo "Modo Executivo"** do admin. Hoje ele só tem **Analytics** (com dropdown de líder); passa a ter: **Backlog** (consolidado), **Calendário geral** (todos os líderes) e **um item por executivo**, cada um com **Calendário** + **Analytics** individuais.
- O **Analytics deixa de ser item solto com dropdown** e passa a viver **dentro de cada perfil de líder**.
- Admin vê, dos TLs da própria empresa: **backlog consolidado**, **calendário geral** (todos) e, por líder, **calendário** + **analytics**.
- Admin pode: **aprovar ideia**, **aprovar post**, **pedir ajuste** e **comentar/resolver comentário**.
- Toda ação grava **autor (id, nome, papel)** e aparece como (a) **comentário do Boldfy Bot** na thread do post e (b) **tag/marcação inline** na aprovação.

### Fora do escopo (fase 2)
- Admin **criar/editar** posts do zero (paridade total com estrategista). Por ora o admin atua sobre o conteúdo existente, não produz.
- Replicar para o admin as demais abas que o TL/estrategista têm (Manual de Marca, Estratégia, Perfil LinkedIn) — só **conteúdo (calendário + backlog)**.
- Padronizar o seletor de líder nas outras páginas (mencionado pela Clara como ideia futura).
- Notificação externa (e-mail/push) ao líder quando o admin aprova.

## 4. Papéis e regra de acesso

| Papel | Vê | Sobre quem | Pode |
|---|---|---|---|
| `thoughtleader` (executivo) | calendário + backlog + ações | **só a própria conta** | aprovar, pedir ajuste, comentar |
| `admin` (empresa) | calendário + backlog + ações + analytics | **todos os TLs da própria empresa** | aprovar, pedir ajuste, comentar |
| `strategist` | tudo | empresas atribuídas | inalterado |
| `master` | tudo | global | inalterado |

**Regra única de autorização:** o admin só acessa um TL e seus posts se `getCompanyId(admin.uid) === getCompanyId(tl.uid)`. Essa checagem é a fronteira de segurança da feature e precisa valer nos três níveis: guard de server action, Firestore rules e middleware de rota.

## 5. Navegação / UI

Reorganizar o grupo **Modo Executivo** do sidebar do admin (`admin-sidebar-nav.tsx`), escopado à própria empresa (sem nível de "empresa", já que o admin tem só a dele):

```
Modo Executivo
├─ Backlog                           → /admin/modo-executivo/backlog
│     (consolidado: posts a aprovar + em andamento, todos os líderes)
├─ Calendário                        → /admin/modo-executivo/calendario
│     (geral, todos os líderes — igual ao do estrategista)
└─ [um item por executivo cadastrado na empresa]
   └─ Líder A
      ├─ Calendário                  → /admin/modo-executivo/calendario?tl={tlSlug}
      └─ Analytics                   → /admin/modo-executivo/analytics?tl={tlSlug}
```

- **Backlog (topo):** pipeline consolidado de todos os TLs da empresa, agrupando "a aprovar" (`aprovar_ideia`/`aprovar_post`) e "em andamento" (`em_producao` etc). Reusa o componente de pipeline do estrategista.
- **Calendário geral (topo):** calendário com todos os líderes da empresa, reusando o calendário do estrategista.
- **Por líder:** abre uma subpasta com **Calendário** (só dele) e **Analytics** (só dele). O Analytics reaproveita o `AnalyticsDashboard` que já existe — só que dirigido pela seleção do líder no sidebar, **não mais por dropdown**.
- A antiga rota `/admin/analytics/thought-leaders` (dropdown) é **substituída** por essa navegação por perfil.
- Reaproveitar `post-editor-shell.tsx` e `comments-sidebar.tsx` para abrir/editar-comentar o post a partir do backlog.

## 6. Ações e fluxo de status (inalterado, só amplia quem pode)

```
backlog → aprovar_ideia → em_producao → aprovar_post → pronto_pra_postar → agendado → postado
                                              ↓
                                           ajuste  ←  (pedir ajuste)
```

As transições continuam idênticas. Muda apenas que o **admin da mesma empresa** passa a ser um ator válido em:

- `approvePipelineIdea()` (`aprovar_ideia → em_producao`)
- `approvePipelinePost()` (`aprovar_post → pronto_pra_postar`)
- `requestPipelineAdjustment()` (`aprovar_post → ajuste`)
- `addPostComment()` / `resolvePostComment()`

## 7. Audit trail — registrar quem fez cada ação

### 7.1 Modelo de dados

Hoje a aprovação só grava `tlApprovedAt` (timestamp, sem autor). Generalizar para registrar **autor + papel** em toda ação relevante.

**No `PipelinePost`** — adicionar:

```ts
// quem destravou a última transição (aprovação/ajuste)
approvedById?: string;        // uid do ator
approvedByName?: string;      // nome de exibição no momento da ação
approvedByRole?: 'thoughtleader' | 'admin' | 'strategist' | 'master';
// tlApprovedAt continua existindo (timestamp da aprovação do post)
```

**No `PostComment`** — estender `authorRole` para incluir `'admin'` (e `'master'`, hoje ausente do type apesar de já comentar):

```ts
authorRole: 'strategist' | 'thoughtleader' | 'admin' | 'master';
```

### 7.2 Superfícies onde aparece

1. **Boldfy Bot (comentário de sistema):** ao aprovar/pedir ajuste, disparar `addBotComment()` na thread do post com mensagem do tipo:
   - `"✅ Post aprovado pela admin {nome} (no lugar do líder)."`
   - `"✏️ Ajuste solicitado pela admin {nome}."`
   - Quando o ator é o próprio TL, mantém a mensagem atual / sem "no lugar do líder".
2. **Tag/marcação inline:** badge ao lado do status de aprovação mostrando `approvedByRole` + `approvedByName` (ex.: *"Aprovado · admin Fulana"*), análogo ao badge laranja de `commentType: 'adjustment'` que já existe.
3. **Activity feed:** o `Activity` já carrega `authorName` + `authorRole`; ao criar `getRecentActivitiesForAdmin()`, o papel `admin` aparece naturalmente no feed.

## 8. Mudanças por arquivo

### Backend — guards
- `src/lib/auth-guard.ts`
  - Novo `requireAdminForTL(idToken, tlUserId)`: valida `admin` + mesma `companyId` do TL.
  - Estender `requirePostAccess()` para conceder acesso (com `canEdit`/aprovação) ao admin da mesma empresa.

### Backend — server actions
- `src/app/actions/content-pipeline.ts`
  - `approvePipelineIdea`, `approvePipelinePost`, `requestPipelineAdjustment`: aceitar ator `admin` via `requireAdminForTL`; gravar `approvedById/Name/Role`.
  - Disparar `addBotComment()` com a mensagem de auditoria correspondente.
  - Novo `getRecentActivitiesForAdmin(idToken)` (espelho do de estrategista, escopado à empresa do admin).
  - Funções de leitura do pipeline/calendário escopadas por empresa para o admin (ex.: `getAdminPipelineData`, lista de TLs da empresa).
- `src/app/actions/post-editor.ts`
  - `addPostComment` / `resolvePostComment`: aceitar `admin` da mesma empresa; gravar `authorRole: 'admin'`.

### Backend — types
- `src/lib/post-editor-types.ts`: estender `authorRole`.
- `src/app/actions/content-pipeline.ts`: novos campos de auditoria em `PipelinePost`.

### Firestore rules
- `firestore.rules` — em `users/{tlId}/contentPipeline/{postId}` e subcoleção de comentários:

```
allow read, write: if hasRole(request.auth.uid, 'admin')
                    && getCompanyId(request.auth.uid) == getCompanyId(tlId);
```

(manter as regras existentes de strategist/TL/master; bloqueio de campos críticos permanece).

### Frontend
- `src/components/dashboard/admin-sidebar-nav.tsx`: reorganizar o grupo "Modo Executivo" → **Backlog**, **Calendário** (geral) e **um item por executivo** (cada um expandindo em Calendário + Analytics). Remover o item solto "Analytics" com dropdown.
- Novas rotas:
  - `src/app/admin/modo-executivo/backlog/page.tsx` — pipeline consolidado (reusa componente do estrategista).
  - `src/app/admin/modo-executivo/calendario/page.tsx` — calendário geral (sem `?tl`) e por líder (`?tl={slug}`).
  - `src/app/admin/modo-executivo/analytics/page.tsx` — analytics por líder (`?tl={slug}`), reusando `AnalyticsDashboard`.
- **Substituir** a rota/dropdown atual `src/app/admin/analytics/thought-leaders/page.tsx` por essa navegação por perfil (migrar o `AnalyticsDashboard` para a rota nova).
- Reuso de `post-editor-shell.tsx` + `comments-sidebar.tsx` para abrir o post a partir do backlog.
- Badge de "aprovado por" na UI de status.

### Middleware
- `src/middleware.ts`: liberar `/admin/modo-executivo/*` para o role `admin`.

## 9. Segurança e casos de borda

- **Isolamento entre empresas:** admin da empresa A nunca acessa TL da empresa B — validado em guard + rules (defesa em profundidade). É o teste #1 de aceite.
- **TL sem empresa / empresa nula:** se `tl.companyId` ausente, negar acesso do admin.
- **Acesso concorrente:** admin e TL podem aprovar; a última transição vence e grava o ator correspondente (sem lock, comportamento igual ao atual).
- **Aprovação do admin = aprovação válida:** o post segue para `pronto_pra_postar` normalmente; o registro de autoria é o que diferencia.
- **TL continua podendo tudo:** o acesso do admin é **aditivo**, não remove nada do líder.

## 10. Critérios de aceite

1. Admin com TLs na empresa vê, no Modo Executivo, o backlog consolidado e, por líder, calendário + backlog.
2. Admin aprova ideia/post e pede ajuste de qualquer TL **da própria empresa**; o status muda corretamente.
3. Admin **não** consegue ver nem agir sobre TL de outra empresa (guard + rules).
4. Toda aprovação/ajuste/comentário do admin grava `approvedBy*`/`authorRole` e gera (a) comentário do Boldfy Bot e (b) tag inline indicando que foi o admin.
5. Conta de executivo continua vendo só a própria conta.
6. Analytics do Modo Executivo permanece inalterado.
7. Fluxo do TL aprovando por si mesmo continua funcionando igual.

## 11. Ordem de implementação sugerida

1. Types + campos de auditoria (`PipelinePost`, `PostComment`).
2. Guards (`requireAdminForTL`, `requirePostAccess`).
3. Firestore rules + teste de isolamento entre empresas.
4. Server actions (aprovação/ajuste/comentário + bot comment + activities do admin).
5. UI (sidebar, rotas, badges) reusando componentes do estrategista.
6. Middleware.
7. Verificação: teste de isolamento A↔B, fluxo admin-aprova, fluxo TL-aprova, e checagem do registro no Boldfy Bot.
