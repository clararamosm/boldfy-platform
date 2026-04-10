# PLANO: Produção-Ready + Créditos de IA + Ranking Fix

## RESUMO
Este plano cobre 2 blocos: (A) Infra de produção (5 itens técnicos) e (B) Feature de créditos de IA + ranking fixes.

---

## BLOCO A — INFRAESTRUTURA DE PRODUÇÃO

### A1. Rate Limiting nas rotas de IA
**Arquivos:** `src/app/api/ai/generate/route.ts`, `src/app/api/ai/missions/route.ts`
- Implementar rate limiter in-memory usando Map com janela deslizante por userId
- Limites: 10 requests/minuto por user nas rotas de IA
- Sem dependências externas (Map + TTL limpo por intervalo)
- Retorna 429 Too Many Requests quando excede

### A2. Firestore Indexes
**Arquivo:** `firestore.indexes.json`
- Adicionar índices compostos para:
  - `users`: companyId + role (já existe)
  - `scheduledPosts` (collectionGroup): status + scheduledFor (cron)
  - `pointsHistory`: type + source (recalculatePoints query)
  - `missionSubmissions`: missionId + status (review queries)

### A3. Paginação no Rankings
**Arquivos:** `src/app/actions/points.ts`, `src/app/colaborador/dashboard/page.tsx`, `src/app/admin/dashboard/page.tsx`
- `getCompanyRanking`: Adicionar `.orderBy('points', 'desc').limit(10)` no Firestore query em vez de carregar todos e ordenar em memória
- Dashboard colaborador: Mudar grid de `[1fr_1fr_280px]` para `[1fr_1fr_1fr]` (3 colunas iguais)
- Limitar ranking visual a 10 pessoas
- Admin dashboard: manter top 5 como está

### A4. Security Headers
**Arquivo:** `next.config.ts`
- Adicionar `headers()` com:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-DNS-Prefetch-Control: on`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### A5. Input Validation (Zod em rotas faltantes)
**Arquivos:** `src/app/api/ai/generate/route.ts`, `src/app/api/ai/missions/route.ts`, `src/app/actions/missions.ts`, `src/app/actions/posts.ts`
- Adicionar schemas Zod para validar payloads das rotas de IA
- Adicionar validação de tamanho em captions (max 3000 chars)
- Adicionar validação de URLs em proofUrl de missões

---

## BLOCO B — CRÉDITOS DE IA

### B1. Modelo de dados
**Campo novo no user doc (Firestore):**
```
users/{uid}:
  aiCredits: {
    remaining: 40,        // créditos restantes
    monthlyLimit: 40,     // limite mensal
    renewsAt: Timestamp,  // data de renovação (1º do próximo mês)
    totalUsed: 0          // total histórico de usos
  }
```

**Recompensa default nas companies:**
```
companies/{companyId}/rewards/:
  {
    name: "10 Créditos de IA",
    points: 150,           // sugestão: 150 pontos = 10 créditos
    type: "ai_credits",    // tipo especial
    creditsAmount: 10,     // quantos créditos entrega
    stock: "Ilimitado",
    status: "Disponível",
    imageUrl: null,        // usa ícone de Sparkles
    isDefault: true        // flag pra não poder deletar
  }
```

### Sugestão de valores de conversão:
- **1 geração de conteúdo = 1 crédito de IA**
- **10 créditos extras = 150 pontos do app** (equivale a ~completar 1 trilha média)
- **20 créditos extras = 250 pontos** (desconto por volume)
- Cada colaborador começa com **40 créditos/mês** (renova no 1º de cada mês)
- Créditos comprados NÃO expiram (acumulam com os mensais)

### B2. Hook useAiCredits
**Arquivo novo:** `src/hooks/use-ai-credits.ts`
- Busca `aiCredits` do user doc via Firestore listener
- Retorna: `{ remaining, monthlyLimit, renewsAt, daysUntilRenewal, loading }`
- Mesmo padrão do `useUnreadFeed`

### B3. Badge no sidebar
**Arquivo:** `src/components/dashboard/colaborador-sidebar-nav.tsx`
- No item "Assistente", adicionar badge com créditos restantes: `"23/40"`
- Usa o hook `useAiCredits`
- Quando remaining === 0: badge fica vermelho em vez de purple

### B4. Banner na página do Assistente
**Arquivo:** `src/app/colaborador/assistente/page.tsx`
- Adicionar card de status acima do HotTopicsBox:
  - Mostra: "X créditos restantes de Y"
  - Progress bar visual
  - Quando 0: mensagem "Seus créditos renovam em X dias" + botão "Comprar mais créditos" → link para recompensas
- Quando remaining === 0: bloqueia o form de geração com overlay

### B5. Consumo de crédito na geração
**Arquivo:** `src/app/api/ai/generate/route.ts`
- Antes de gerar: verificar `aiCredits.remaining > 0`
- Se 0: retornar 403 com `{ error: "credits_exhausted", renewsAt, daysUntilRenewal }`
- Após gerar com sucesso: decrementar `aiCredits.remaining` e incrementar `aiCredits.totalUsed` via Admin SDK

### B6. Resgate de créditos via recompensas
**Arquivo:** `src/app/actions/rewards.ts`
- Na função `redeemReward`: se reward.type === 'ai_credits', além do fluxo normal, adicionar `creditsAmount` ao `aiCredits.remaining` do user
- Créditos comprados não resetam no ciclo mensal (acumulam)

### B7. Seed da recompensa default
**Arquivo:** `src/app/actions/users.ts` (no inviteAdmin quando cria empresa)
- Ao criar uma nova empresa, auto-criar a recompensa "Créditos de IA" com `isDefault: true`
- Para empresas existentes: criar um script ou server action que adiciona se não existir

### B8. Renovação mensal (cron ou check lazy)
**Abordagem: lazy check** (sem cron extra)
- No `ai/generate/route.ts`: antes de verificar remaining, checar se `renewsAt` já passou
- Se `Date.now() > renewsAt`: resetar remaining para monthlyLimit, atualizar renewsAt para 1º do próximo mês
- Créditos extras comprados via loja: NÃO são resetados (precisa campo `bonusCredits` separado)

**Ajuste no modelo:**
```
aiCredits: {
  remaining: 40,          // mensais restantes (reseta)
  bonusCredits: 0,        // comprados na loja (não reseta)
  monthlyLimit: 40,
  renewsAt: Timestamp,
  totalUsed: 0
}
```
- Consumo: primeiro gasta `remaining`, depois `bonusCredits`
- Renovação: só reseta `remaining` para `monthlyLimit`

### B9. Firestore Rules para aiCredits
**Arquivo:** `firestore.rules`
- Client NÃO pode escrever em `aiCredits` diretamente
- Só Admin SDK (server actions e API routes) modifica créditos
- Adicionar `aiCredits` à lista de campos protegidos no update do user

---

## ORDEM DE IMPLEMENTAÇÃO

1. **A2** — Firestore indexes (deploy first, takes time to build)
2. **A4** — Security headers (quick win)
3. **A1** — Rate limiting
4. **A5** — Zod validation
5. **A3** — Ranking: paginação + 3 colunas iguais + limit 10
6. **B1** — Modelo de dados aiCredits
7. **B9** — Firestore rules (proteger aiCredits)
8. **B2** — Hook useAiCredits
9. **B5** — Consumo de crédito + renovação lazy (B8)
10. **B3** — Badge no sidebar
11. **B4** — Banner + bloqueio na página do assistente
12. **B6** — Resgate de créditos na loja
13. **B7** — Seed da recompensa default
14. Build + test + commit

---

## ARQUIVOS MODIFICADOS (estimativa)

| Arquivo | Tipo |
|---------|------|
| `firestore.indexes.json` | Modificar |
| `next.config.ts` | Modificar |
| `src/app/api/ai/generate/route.ts` | Modificar (rate limit + credits + zod) |
| `src/app/api/ai/missions/route.ts` | Modificar (rate limit + zod) |
| `src/app/actions/points.ts` | Modificar (ranking limit 10) |
| `src/app/actions/rewards.ts` | Modificar (ai_credits type) |
| `src/app/actions/missions.ts` | Modificar (zod) |
| `src/app/actions/posts.ts` | Modificar (zod) |
| `src/app/actions/users.ts` | Modificar (seed reward) |
| `src/app/colaborador/dashboard/page.tsx` | Modificar (3 cols iguais + limit 10) |
| `src/app/colaborador/assistente/page.tsx` | Modificar (credits banner + bloqueio) |
| `src/components/dashboard/colaborador-sidebar-nav.tsx` | Modificar (badge) |
| `src/hooks/use-ai-credits.ts` | Criar |
| `src/lib/rate-limit.ts` | Criar |
| `firestore.rules` | Modificar |
| `PROJECT_STATUS.md` | Atualizar |
