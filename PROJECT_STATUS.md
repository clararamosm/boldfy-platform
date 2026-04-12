# Boldfy Platform — Project Status

> Atualizado em: 12 Abril 2026
> Build: LIMPO (0 erros, 0 warnings)
> TypeScript: LIMPO (0 erros)
> Seguranca: Auditado 3 rodadas (ultima: Abril 2026)
> Diagnostico: Completo — ver secao "Audit Abril 2026"

---

## O que e a Boldfy

Plataforma de **employee advocacy, thought leadership e engajamento** para empresas B2B. Colaboradores ganham pontos completando trilhas de aprendizado e missoes no LinkedIn, e trocam por recompensas. Thought Leaders tem pipeline de conteudo gerenciado por estrategistas com IA. O conteudo e alinhado com a marca da empresa via IA.

---

## Stack Tecnica

- **Framework**: Next.js 15.5.7 (App Router, Server Actions)
- **Linguagem**: TypeScript (strict, sem ignoreBuildErrors)
- **Banco**: Firebase Firestore (regras de seguranca customizadas)
- **Auth**: Firebase Auth + HMAC-signed session cookies (HttpOnly, Secure)
- **IA**: Google Genkit (gemini) para geracao de conteudo
- **Estilo**: Tailwind CSS + shadcn/ui
- **Infra**: Vercel (deploy) + Firebase (backend)
- **Integracoes**: LinkedIn OAuth 2.0, Notion API, SMTP

---

## Arquitetura de Roles

### Master (Superadmin)
- Acessa `/master/` e `/admin/` (com ?companyId=)
- Cria empresas e convida admins
- Gerencia trilhas globais (templates)
- Visualiza analytics da plataforma
- Aprova posts e ideias do pipeline de TLs

### Admin (Administrador da Empresa)
- Acessa `/admin/`
- Convida e gerencia colaboradores
- Cria missoes, recompensas, trilhas
- Revisa submissoes de missoes (aprova/rejeita)
- Configura brand context da empresa
- Visualiza dashboard com metricas

### Strategist (Estrategista de Conteudo)
- Acessa `/strategist/`
- Gerencia pipeline de conteudo para Thought Leaders
- Cria e edita posts (briefing, caption, design)
- Calendario drag & drop com agendamento
- Configuracao de Slack notifications
- Brand manual e estrategia de conteudo por TL
- Publicacao direta no LinkedIn do TL

### Thought Leader
- Acessa `/thoughtleader/`
- Visualiza e aprova briefings e posts no backlog
- Calendario read-only com todos os posts do pipeline
- Feed de LinkedIn (posts publicados da empresa)
- Manual de marca pessoal (visual rico)
- Estrategia de conteudo (read-only)
- Conecta LinkedIn para publicacao

### Colaborador (Funcionario)
- Acessa `/colaborador/`
- Completa trilhas e missoes
- Troca pontos por recompensas
- Publica no LinkedIn (agendamento + publicacao direta)
- Usa assistente de IA para alinhar conteudo
- Gerencia perfil e marca pessoal
- Calendario de posts pessoais
- Feed de LinkedIn da empresa

---

## Paginas da Aplicacao

### Publicas
| Rota | Funcao |
|------|--------|
| `/` | Landing page |
| `/login` | Autenticacao (Firebase Auth) |
| `/beta-test` | Formulario de leads beta |
| `/privacidade` | Politica de privacidade |
| `/post/[company]/[tl]/[postId]` | Pagina publica de post (preview) |

### Master
| Rota | Funcao |
|------|--------|
| `/master/dashboard` | Analytics globais da plataforma |
| `/master/empresas` | CRUD de empresas + convite de admins |
| `/master/trilhas` | Gerenciar trilhas globais (templates) |

### Admin
| Rota | Funcao |
|------|--------|
| `/admin/dashboard` | Metricas da empresa (licencas, missoes, trilhas, pontos, top performers) |
| `/admin/colaboradores` | Convidar, gerenciar, deletar colaboradores |
| `/admin/missoes` | CRUD de missoes + revisao de submissoes |
| `/admin/recompensas` | CRUD de recompensas (catalogo de premios) |
| `/admin/trilhas` | Ativar trilhas globais + criar trilhas customizadas |
| `/admin/biblioteca` | Biblioteca de conteudo (arquivos, recursos) |
| `/admin/linkedin-feed` | Feed de posts publicados pelos colaboradores |
| `/admin/configuracoes` | Brand context, locale, preferencias da empresa |
| `/admin/suporte` | Enviar feedback/bugs para Notion |

### Strategist
| Rota | Funcao |
|------|--------|
| `/strategist/dashboard` | Visao geral de todos TLs e pipeline |
| `/strategist/calendario` | Calendario drag & drop com agendamento |
| `/strategist/posts/[id]` | Editor de post (briefing, caption, design, publicacao) |
| `/strategist/conteudo` | Pipeline kanban/lista de conteudo |
| `/strategist/configuracoes` | Slack, integracao LinkedIn, configuracoes gerais |

### Thought Leader
| Rota | Funcao |
|------|--------|
| `/thoughtleader/backlog` | 3 boxes: Aprovar Post, Aprovar Briefing, Backlog + Adicionar Ideia |
| `/thoughtleader/calendario` | Calendario read-only com posts do pipeline |
| `/thoughtleader/linkedin-feed` | Feed de posts publicados da empresa |
| `/thoughtleader/manual` | Manual de marca pessoal (design visual rico) |
| `/thoughtleader/estrategia` | Estrategia de conteudo (read-only) |
| `/thoughtleader/configuracoes` | LinkedIn connection, perfil |

### Colaborador
| Rota | Funcao |
|------|--------|
| `/colaborador/dashboard` | Pontos, missoes ativas, trilhas em progresso, atividade |
| `/colaborador/missoes` | Navegar missoes, enviar provas, auto-completar |
| `/colaborador/trilhas` | Navegar trilhas disponiveis |
| `/colaborador/trilhas/[id]` | Player de trilha (modulos, quizzes, desafios) |
| `/colaborador/recompensas` | Resgatar pontos por premios |
| `/colaborador/rankings` | Leaderboard da empresa |
| `/colaborador/calendario` | Calendario de posts agendados |
| `/colaborador/calendario/novo` | Criar novo post agendado |
| `/colaborador/assistente` | Assistente IA (alinhar conteudo, gerar hooks) |
| `/colaborador/linkedin-feed` | Feed de posts da empresa |
| `/colaborador/biblioteca` | Biblioteca de conteudo |
| `/colaborador/configuracoes` | LinkedIn, perfil, marca pessoal |
| `/colaborador/suporte` | Feedback e suporte |

---

## API Routes

| Rota | Metodo | Funcao |
|------|--------|--------|
| `/api/auth/session` | POST/DELETE | Criar/limpar cookie de sessao assinado (HMAC) |
| `/api/auth/linkedin/callback` | GET | Callback OAuth do LinkedIn |
| `/api/ai/generate` | POST | Geracao de captions via IA (auth + role) |
| `/api/ai/missions` | POST | Sugestoes de missoes via IA (admin/master only) |
| `/api/cron/hot-topics` | GET | Cron semanal: regenera topicos quentes (CRON_SECRET) |
| `/api/cron/publish-posts` | GET | Cron 5min: publica posts agendados (CRON_SECRET) |

---

## Server Actions (src/app/actions/)

| Arquivo | Funcoes | Auth |
|---------|---------|------|
| `users.ts` | inviteAdmin, inviteCollaborator, deleteCollaborator | requireAuth/requireAdmin/requireMaster |
| `missions.ts` | submitMissionProof, completeMissionSelf, reviewMissionProof | requireAuth + company check |
| `rewards.ts` | redeemReward, markRescueAsPaid | requireAuth/requireSelf/requireAdmin |
| `points.ts` | getCompanyRanking, recalculatePoints | requireAuth |
| `posts.ts` | createScheduledPost, updateScheduledPost, deleteScheduledPost, getCompanyFeed, markFeedAsRead | requireSelf/requireAuth |
| `linkedin.ts` | getLinkedInAuthUrl, disconnectLinkedIn, publishToLinkedIn, etc | requireSelf |
| `content.ts` | handleAlignContent, generateHooks, generateWithHook, toggleStarContent | requireAuth + userId + companyId check |
| `content-pipeline.ts` | getPipelinePosts, createPipelineIdea, approvePipelineIdea, approvePipelinePost, rejectPipeline*, resolveSlugs, updatePostStatus, etc | requireAuth + manual role checks |
| `slack.ts` | getSlackChannels, getSlackConfig, saveSlackConfig, testSlackNotification | requireStrategist (master bloqueado exceto test) |
| `hot-topics.ts` | getHotTopics, regenerateHotTopics | requireAuth + admin check |
| `feedback.ts` | sendFeedbackToNotion, sendSupportToNotion | requireAuth + server-verified identity |
| `dashboard.ts` | getAdminDashboardData | requireAdmin |
| `beta-leads.ts` | sendBetaLeadToNotion | Publico (sem auth — risco de spam) |

---

## Modelo de Dados (Firestore)

### Colecoes Raiz
- **`companies`** — Empresas (brandContext, licencas, subscription, hotTopics)
- **`users`** — Todos usuarios (role, companyId, points, linkedinConnection, personal branding)
- **`globalSessions`** — Sessoes globais de trilhas (master)
- **`linkedin_oauth_states`** — Estados OAuth temporarios (10min expiry)

### Subcolecoes de Company
- `missions` — Definicoes de missoes
- `missionSubmissions` — Provas enviadas pelos colaboradores
- `rewards` — Catalogo de recompensas
- `rescues` — Resgates de recompensas
- `trails` — Trilhas customizadas/ativadas
- `sessions` — Agrupamento de trilhas
- `activatedGlobalTrails` — Referencias a trilhas globais ativadas
- `assets` — Arquivos da biblioteca
- `library` — Conteudo da biblioteca

### Subcolecoes de User
- `trailProgress` — Progresso em trilhas (modulos completos, pontos, %)
- `pointsHistory` — Log de transacoes de pontos (ganho/gasto)
- `rescues` — Resgates do usuario
- `generatedContent` — Conteudo gerado pela IA (arquivo pessoal)
- `scheduledPosts` — Posts agendados/publicados no LinkedIn (colaboradores)
- `contentPipeline` — Pipeline de conteudo do TL (gerenciado por strategist)

### Subcolecoes de Company > ThoughtLeaders
- `brandManual/main` — Manual de marca pessoal (personalidade, arquetipos, tom de voz, vocabulario, etc.)
- `contentStrategy/main` — Estrategia de conteudo (pilares, topicos, narrativa, messaging)

---

## Sistema de Pontos

1. **Ganho**: Completar trilhas (pontosGanhos calculados por modulo) + completar missoes (pontos fixos por missao)
2. **Gasto**: Resgatar recompensas (desconta pontos)
3. **Calculo**: `recalculatePoints` (server action) = soma trilhas + soma missoes - soma resgates
4. **Protecao**: Firestore rules limitam incremento (+500/update, cap 5000 total por trilha). Pontos de missao so via Admin SDK.

---

## Seguranca — Estado Atual

### Autenticacao
- Firebase Auth (email/password + Google OAuth)
- HMAC-SHA256 signed session cookie (Web Crypto API, Edge-compatible)
- Cookie HttpOnly + Secure + SameSite=Lax
- COOKIE_SECRET obrigatorio em producao (throw se nao setado)
- Middleware valida assinatura antes de permitir acesso a rotas protegidas

### Autorizacao
- Todas server actions validam `requireAuth` + role + companyId
- Firestore Security Rules enforcem isolamento de empresa
- Campos protegidos (role, companyId, points) nao podem ser alterados client-side
- Content actions validam `authUser.uid === userId` (previne acesso a dados de outro usuario)
- Feedback/suporte usam dados verificados server-side (nao confia no client)

### Protecao de Dados
- LinkedIn tokens (accessToken, refreshToken) removidos do state do React no client
- Server actions usam Admin SDK para acessar tokens (bypass de Firestore rules)
- Firebase API key configuravel via env vars (NEXT_PUBLIC_FIREBASE_*)
- .env.example documentado com todas variaveis necessarias
- TypeScript e ESLint habilitados no build (sem ignoreBuildErrors)
- Rich editor sanitiza HTML com DOMPurify (whitelist de tags)

### API Routes
- AI routes validam token + role + companyId
- Cron routes protegidas por CRON_SECRET
- Session route valida Firebase token server-side antes de assinar cookie

### Firestore Rules
- Users so podem ler/atualizar seus proprios docs
- Admins so acessam usuarios da propria empresa
- trailProgress: incremento monotono, cap por update (+500) e total (5000)
- pointsHistory: client so cria entries tipo 'gain' + source 'trilha', cap 500pts
- Campos protegidos: role, companyId, companyName, points (nao alteraveis client-side)
- Company subcollections: write restrito a admin/master

---

## Audit Abril 2026 — Diagnostico Completo

### Seguranca & Roles

| Sev | Issue | Local | Acao |
|-----|-------|-------|------|
| MEDIUM | Beta leads sem auth | `actions/beta-leads.ts` | Adicionar rate limit ou CAPTCHA |
| MEDIUM | resolveSlugs sem role check | `actions/content-pipeline.ts:558` | Qualquer user autenticado enumera empresas/TLs — restringir por role |
| MEDIUM | Slack bloqueado pra master | `actions/slack.ts` | `requireStrategist` em 3/4 funcoes bloqueia master — ajustar guard |
| MEDIUM | Approvals sem guard tipado | `actions/content-pipeline.ts:288,328` | `requireAuth` + check manual — funciona mas risco de regressao |
| LOW | Admin excluido do post editor | `actions/posts.ts` | `requireSelf` impede admin de editar posts de colaboradores |
| LOW | Session cookie role stale | `middleware.ts` | Cookie nao reflete mudancas de role ate relogin |
| LOW | console.error abundante | Projeto inteiro | ~115 ocorrencias — migrar para logger estruturado |

### Complexidade & Reuso

| Pri | Issue | Impacto | Acao |
|-----|-------|---------|------|
| HIGH | LinkedIn Feed triplicado | 3 paginas ~270 linhas cada, quase identicas | Extrair `<LinkedInFeedView>` compartilhado |
| HIGH | N+1 queries no strategist | Loop sequencial sobre TLs (1 query/TL) | Collection group query ou batch parallel |
| HIGH | Master dashboard client-side | Firebase SDK no client com N+1 subcollections | Migrar para server action com Admin SDK |
| MEDIUM | 6 layouts duplicados | Mesmo padrao (auth + sidebar + footer + Suspense) | Criar `<RoleLayout>` generico parametrizado |
| MEDIUM | 14 arquivos +500 linhas | content-pipeline.ts (780+), admin config, etc | Split em modulos menores |
| MEDIUM | i18n inconsistente | Strategist/master hardcoded em portugues | Internacionalizar com sistema i18n existente |
| MEDIUM | Import patterns mistos | Dynamic import() vs static sem padrao claro | Padronizar: static para server actions, dynamic para lazy load |
| MEDIUM | Zero React.memo | Nenhum componente usa memo; listas re-renderizam tudo | Adicionar em FeedPostCard, CalendarPostCard, BacklogCard |
| LOW | Dead code | Variaveis/imports nao-usados espalhados | Lint cleanup |

### Recomendacoes (ordem de prioridade)

1. Extrair `<LinkedInFeedView>` — elimina 500+ linhas duplicadas (30min)
2. Collection group query para pipeline — elimina N+1 no strategist
3. Migrar master dashboard para server action — seguranca + perf
4. `<RoleLayout>` generico — 5 layouts → 1 componente + configs
5. Rate limiting no beta-leads — previne spam
6. Permitir master no Slack config — ajustar guards
7. i18n no strategist/master — consistencia
8. React.memo em componentes de lista — quick win de perf

---

## Itens Conhecidos (nao-blockers para producao)

### Baixa Prioridade
1. **Trail trigger missions**: O trail player tenta criar missoes via client Firestore write, mas Firestore rules bloqueiam para colaboradores. Precisa migrar para server action. (Funcional: missoes auto-complete funcionam; trigger missions de trilha nao.)
2. **Genkit flow `align-content.ts`**: Tem `'use server'` mas nao e usado diretamente por nenhum client. Remover directive ou adicionar auth como prevencao.
3. **Delecao de empresa**: Shallow — nao deleta subcollections aninhadas de users. Usar `recursiveDelete()` no futuro.
4. **Beta leads**: Sem rate limiting (publico). Adicionar CAPTCHA ou rate limit por IP.
5. **console.error/warn**: 115 ocorrencias — funcional mas ideal migrar para logger estruturado (Pino/Winston).

---

## O que foi feito (historico de sessoes)

### Fase 1 — Fundacao
- Construcao completa da plataforma (todas as paginas, server actions, Firestore rules)
- Sistema de roles (master/admin/colaborador)
- Trilhas com player completo (video, leitura, quiz, desafio)
- Missoes com sistema de prova e revisao
- Recompensas com resgate de pontos
- Integracao LinkedIn (OAuth, publicacao, metricas)
- Assistente IA para conteudo alinhado com marca
- Dashboard com KPIs e analytics
- Internacionalizacao (pt-BR/en)
- Calendario de posts com auto-publicacao via cron

### Fase 1.5 — Design & Polish
- Redesign do icone de moeda/pontos (gold coin com estrela, shimmer + bounce)
- CoinIcon component com sistema de tamanhos (xs/sm/md/lg/xl) e variantes
- Correcao de pontos de missao (total earned, nao weekly)
- Error boundaries e tratamento de erros

### Fase 1.7 — Auditoria de Seguranca (2 rodadas)

**Rodada 1 — Correcoes aplicadas:**
- [CRITICAL] Middleware: cookie assinado server-side com HMAC-SHA256 (HttpOnly, Secure)
- [HIGH] Auth no feedback/suporte (requireAuth + idToken)
- [HIGH] generateHotTopicsForCompany movido para modulo interno (nao server action)
- [HIGH] AI routes: validacao de role + company
- [HIGH] Firestore rules: limites mais apertados em pontos (+500/update, 500/entry)
- [HIGH] LinkedIn tokens removidos do state do React
- [MEDIUM] Content actions: validacao userId === authUser.uid
- [MEDIUM] Rich editor: DOMPurify sanitization
- [MEDIUM] TypeScript/ESLint habilitados no build
- [MEDIUM] Firebase config para env vars

**Rodada 2 — Correcoes adicionais:**
- [CRITICAL] Removido fallback hardcoded do COOKIE_SECRET (throw em producao)
- [MEDIUM] Feedback actions usam authUser server-verified (nao confia no client)
- [MEDIUM] AI routes validam que user pertence a uma empresa
- [FIX] .gitignore corrigido (linha concatenada)
- [FIX] .env.example atualizado com todas variaveis
- [FIX] AuthUser type expandido com campo name

### Fase 2 — Roles Expandidos (Strategist + Thought Leader)
- Novos roles: `strategist` e `thoughtleader`
- Pipeline de conteudo completo (backlog → producao → aprovacao → publicacao)
- Calendario drag & drop para strategist com agendamento
- Editor de post rico (briefing, caption, design copy, mediaUrl)
- Brand manual editor por TL (personalidade, arquetipos, tom, vocabulario)
- Content strategy editor por TL (pilares, topicos, narrativa)
- Slack notifications configuraveis por empresa
- Publicacao no LinkedIn do TL via strategist
- Pipeline status machine com 10 estados
- Shared calendar components (CalendarPostCard, CalendarDayCell)

### Fase 2.5 — Alinhamento TL + Redesign Visual
- TL backlog rewrite (3 boxes: Aprovar Post, Aprovar Briefing, Backlog + Adicionar Ideia)
- TL calendario read-only (compartilha CalendarPostCard/CalendarDayCell)
- TL LinkedIn feed (expandiu getCompanyFeed para suportar role thoughtleader)
- TL manual de marca: redesign visual completo (do layout de cards simples para visual rico com grids, gradientes, atributos estilizados, arquetipos destacados, vocabulary pills, summary cards com accent bar)
- Company logo no sidebar do TL
- createPipelineIdea server action (TL pode sugerir ideias direto pro backlog)

### Fase 2.7 — Diagnostico & Audit (Abril 2026)
- Varredura completa de seguranca e roles (5 roles, 50+ server actions)
- Audit de complexidade e oportunidades de reuso
- Identificados 4 MEDIUM security issues, 3 HIGH complexity issues
- PROJECT_STATUS.md atualizado com diagnostico completo
- Nenhum item critico/blocker identificado

---

## Proximo Passo

**Fase 3**: Resolver os HIGH priority items do diagnostico:
1. Extrair `<LinkedInFeedView>` compartilhado (DRY)
2. Collection group query para eliminar N+1 no strategist
3. Migrar master dashboard para server action
4. Criar `<RoleLayout>` generico
