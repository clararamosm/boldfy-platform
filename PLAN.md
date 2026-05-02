# Sprint 2 — Conquistas + Pop-up de Celebração + Integração Onboarding

## Escopo (seção 12.4 do plano)
Sistema completo de conquistas renováveis (4 categorias), modal de celebração para conquistas, e integração das primeiras conquistas com o onboarding existente.

---

## Passo 1: Definições de conquistas + engine de verificação (`gamification.ts`)

**Arquivo:** `src/app/actions/gamification.ts` (editar)

Adicionar ao arquivo existente:

### 1a. Constantes

```ts
const CONQUEST_POINTS = 50;

const CONQUEST_LADDERS: Record<string, number[]> = {
  pub:     [1, 10, 30, 50, 100],
  trail:   [1, 5, 10, 20, 30, 40],
  mission: [1, 5, 10, 20],
  seq:     [7, 14, 28, 49, 70, 98, 140], // Sprint 3, mas já definida
};
```

### 1b. Função helper `getNextConquest(category, completed)`

Retorna o próximo threshold da escada que ainda não foi conquistado, ou `null` se todas foram.

### 1c. Função principal `checkAndAwardConquests(userId, category)`

Fluxo:
1. Buscar `user.conquests.completed` (array de strings, ex: `["pub_1", "trail_1"]`)
2. Achar próxima meta ativa via `getNextConquest(category, completed)`
3. Se não tem próxima → return (todas completas)
4. Contar total da categoria via pointsHistory / missionSubmissions:
   - `pub`: `count(pointsHistory where source='publicacao')`
   - `trail`: `count(pointsHistory where source='trilha')` — cada trilha concluída gera 1 entry
   - `mission`: `count(missionSubmissions where userId=X AND status='approved')` — precisa do companyId do user doc
5. Se total >= threshold → **award**:
   - Batch atômico:
     - `conquests.completed` → arrayUnion(`"pub_10"`)
     - `pointsHistory` → novo doc com `source: 'conquest'`, `points: 50`
     - `points` → increment(50)
     - `pendingNotifications` → arrayUnion com `type: 'conquest'`, conquestId, description

### 1d. Função pública `checkConquestsFromClient(idToken, userId, category)`

- Valida auth via `requireSelf(idToken, userId)`
- Chama `checkAndAwardConquests(userId, category)`
- Necessária porque trail completion roda no client

---

## Passo 2: Integrar nos fluxos existentes

### 2a. Publicação — `gamification.ts` → `awardPublicationPoints()`
Após `batch.commit()` (linha 69):
```ts
checkAndAwardConquests(userId, 'pub').catch(err => console.error(...));
```

### 2b. Trilha concluída — `use-trail-player.ts` → `completeModule()`
Após `saveProgress()` (linha 286), dentro do bloco `allModulesDone`:
```ts
getAuthToken().then(token => checkConquestsFromClient(token, user.uid, 'trail')).catch(...);
```
Import: adicionar `checkConquestsFromClient` de `@/app/actions/gamification`

### 2c. Missão auto-completada — `missions.ts` → `completeMissionSelf()`
Após `batch.commit()` (linha 171):
```ts
checkAndAwardConquests(userId, 'mission').catch(err => console.error(...));
```
Import: adicionar `checkAndAwardConquests` de `@/app/actions/gamification`

### 2d. Missão aprovada pelo admin — `missions.ts` → `reviewMissionProof()`
Após `batch.commit()` dentro do `if (action === 'approve')` (linha 246):
```ts
checkAndAwardConquests(subData.userId, 'mission').catch(err => console.error(...));
```

---

## Passo 3: Modal de celebração de conquista

**Arquivo novo:** `src/components/gamification/conquest-modal.tsx`

Componente `ConquestModal`:
- Props: `open`, `onClose`, `conquestId`, `category`, `description`, `points`
- Dialog centralizado (shadcn Dialog) com overlay escuro
- Ícone da categoria com animação scale-in (CSS `@keyframes`):
  - `pub` → FileText (azul #3B82F6)
  - `trail` → BookOpen (verde #10B981)
  - `mission` → Zap (laranja #F97316)
  - `seq` → Diamond (roxo, cor do nível)
- Título: i18n `gamification.conquests.unlocked` → "Conquista desbloqueada!"
- Subtítulo: nome da conquista (ex: "30 publicações")
- Badge: "+50 pts adicionados ao seu saldo"
- Botão primário: "Ver conquistas" → link para recompensas (futuro: aba conquistas)
- Botão ghost: "Fechar"

---

## Passo 4: Atualizar GamificationToastProvider

**Arquivo:** `src/components/gamification/points-toast.tsx` (editar)

- Importar `ConquestModal`
- Ao processar `pendingNotifications`, separar:
  - `type === 'points'` → toast normal (comportamento atual)
  - `type === 'conquest'` → abrir ConquestModal + toast de +50pts simultâneo
- Adicionar state `conquestModal` para controlar qual conquista está sendo exibida
- Processar conquistas uma de cada vez (queue), após fechar modal → próxima

---

## Passo 5: Integração com onboarding

**Arquivo:** `src/hooks/use-onboarding.ts` (editar)

Adicionar ao `COLABORADOR_CHECKLIST`:
```ts
{
  id: 'first-publication',
  label: t.gamification.onboarding.firstPublication,    // fallback hardcoded
  description: t.gamification.onboarding.firstPublicationDesc,
  href: '/colaborador/calendario',
},
```
> Posição: entre 'schedule-content' e 'buy-reward' (publicar vem antes de comprar)

**Auto-complete:** Na `checkAndAwardConquests`, quando `pub_1` for atingida:
- Chamar `completeOnboardingItem` do server (precisa importar)
- Ou: adicionar `onboardingItemId: 'first-publication'` na pendingNotification, e o toast provider chama `completeOnboardingItem` no client ao processar

Escolha: **via pendingNotification** (mais desacoplado, client-side, segue padrão existente do onboarding que já usa client SDK).

---

## Passo 6: i18n

**Arquivos:** `pt-BR.ts` e `en.ts` (editar)

Expandir bloco `gamification`:
```ts
gamification: {
  // Sprint 1 keys (mantidas)...
  conquests: {
    unlocked: 'Conquista desbloqueada!',
    points: '+{points} pts adicionados ao seu saldo',
    viewAll: 'Ver conquistas',
    close: 'Fechar',
    pub_1: '1ª publicação',
    pub_10: '10 publicações',
    pub_30: '30 publicações',
    pub_50: '50 publicações',
    pub_100: '100 publicações',
    trail_1: '1ª trilha concluída',
    trail_5: '5 trilhas concluídas',
    trail_10: '10 trilhas concluídas',
    trail_20: '20 trilhas concluídas',
    trail_30: '30 trilhas concluídas',
    trail_40: '40 trilhas concluídas',
    mission_1: '1ª missão completa',
    mission_5: '5 missões completas',
    mission_10: '10 missões completas',
    mission_20: '20 missões completas',
  },
  onboarding: {
    firstPublication: 'Fazer sua primeira publicação',
    firstPublicationDesc: 'Publique no LinkedIn e ganhe +30 pts + Conquista',
  },
},
```

---

## Passo 7: Firestore rules

**Arquivo:** `firestore.rules` (editar)

- Adicionar `'conquests'` à lista em `isNotChangingProtectedFields()`:
  ```
  ['role', 'companyId', 'companyName', 'points', 'aiCredits', 'conquests']
  ```
- Somente Admin SDK pode escrever em `conquests`

---

## Passo 8: Barrel export

**Arquivo:** `src/app/actions.ts` (editar)

Adicionar `checkConquestsFromClient` ao export de gamification.

---

## Passo 9: TypeScript check

`tsc --noEmit` → zero erros.

---

## Resumo de arquivos

| Arquivo | Ação | O que muda |
|---------|------|------------|
| `src/app/actions/gamification.ts` | EDITAR | +CONQUEST_LADDERS, +checkAndAwardConquests, +checkConquestsFromClient, integrar em awardPublicationPoints |
| `src/app/actions/missions.ts` | EDITAR | +import, fire-and-forget conquest check em completeMissionSelf + reviewMissionProof |
| `src/components/trilhas/player/use-trail-player.ts` | EDITAR | +import, fire-and-forget conquest check em completeModule (quando allModulesDone) |
| `src/components/gamification/conquest-modal.tsx` | CRIAR | Modal de celebração com ícone animado |
| `src/components/gamification/points-toast.tsx` | EDITAR | Suportar type='conquest' → abrir ConquestModal |
| `src/hooks/use-onboarding.ts` | EDITAR | +item 'first-publication' no checklist colaborador |
| `src/lib/i18n/dictionaries/pt-BR.ts` | EDITAR | +chaves conquests + onboarding |
| `src/lib/i18n/dictionaries/en.ts` | EDITAR | +chaves conquests + onboarding (inglês) |
| `firestore.rules` | EDITAR | +conquests na lista protegida |
| `src/app/actions.ts` | EDITAR | +export checkConquestsFromClient |

**Arquivos novos: 1** · **Arquivos editados: 9**
