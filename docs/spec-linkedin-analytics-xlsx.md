# Spec: LinkedIn Analytics via XLSX Upload

**Versão:** 3.0
**Data:** Abril 2026
**Status:** Aprovado para implementação — dividido em 2 fases

## Contexto

A API do LinkedIn disponível hoje (Default Tier: "Share on LinkedIn" + Standard Tier: "Sign In with OpenID Connect") não fornece acesso a métricas de posts. O componente `LinkedInPerformance` existente retorna dados vazios em produção. Esta feature substitui esse fluxo por upload manual do relatório XLSX exportado do LinkedIn Analytics, e cria uma **página dedicada de Analytics** para todos os roles que publicam no LinkedIn.

---

## Escopo por Role

| Role | Página Analytics | Upload XLSX | Ver Dashboard | Valor de Mídia | Plano de Ação |
|------|-----------------|-------------|--------------|----------------|---------------|
| **Thought Leader** | `/thoughtleader/analytics` | ✅ | ✅ próprios dados | ❌ | Visualizar + marcar concluído |
| **Colaborador** | `/colaborador/analytics` | ✅ | ✅ próprios dados | ❌ | ❌ (sem estrategista) |
| **Estrategista** | Via rota do TL | ❌ | ✅ TLs sob gestão | ❌ | Criar e editar |
| **Admin** | `/admin/analytics` | ❌ | ✅ todos com filtro | ✅ | Visualizar |

---

## Constante Global: CPM

```typescript
// src/lib/constants.ts (ou arquivo equivalente de constantes globais)
export const LINKEDIN_CPM_BRL = 300; // R$300 por mil impressões
// Valor de mídia = (totalImpressions / 1000) * LINKEDIN_CPM_BRL
```

Esse valor é usado em todos os cálculos de valor de mídia — plataforma e site. **Nunca hardcoded nos componentes**, sempre importado da constante.

---

## Estrutura do XLSX (LinkedIn Analytics Export)

O arquivo tem **5 abas**. O parser usa índice (0–4), não nome da aba (varia por idioma).

### Aba 0 — Descoberta
```
Linha com label "Impressões" → valor numérico total do período
Linha com label "Usuários alcançados" → valor numérico
```
*Números em PT-BR usam `.` como separador de milhar (ex: `325.719`) — normalizar para inteiro*

### Aba 1 — Engajamento (série diária)
```
Colunas: Data (DD/MM/YYYY) | Impressões | Engajamento
~28 linhas de dados
```

### Aba 2 — Publicações Mais em Alta
Duas tabelas lado a lado separadas por coluna vazia (coluna 3):
```
Cols 0-2: URL | Data | Engajamento     ← Top por Engajamento
Col  3:   (vazia)
Cols 4-6: URL | Data | Impressões      ← Top por Impressões
```
URL formato: `linkedin.com/feed/update/urn:li:activity:XXXXX/`

### Aba 3 — Seguidores
```
Linha 1: "Seguidores" | total_atual
Linhas seguintes: Data | Novos seguidores (série diária)
```

### Aba 4 — Dados Demográficos
```
Colunas: Categoria | Label | Porcentagem
"menos de 1%" → converter para 0.5
```

### Métricas disponíveis no XLSX

**De perfil (período):**
- ✅ Impressões totais
- ✅ Usuários alcançados
- ✅ Engajamento total
- ✅ Total de seguidores atual
- ✅ Novos seguidores por dia

**De posts individuais (top posts):**
- ✅ URL do post
- ✅ Data de publicação
- ✅ Impressões do post
- ✅ Engajamento total do post
- ❌ Reações, comentários, saves, cliques — apenas via API futura

**Enriquecimento via post matching (contentPipeline):**
- ✅ `mediaUrl` — imagem/vídeo do post
- ✅ `format` — foto, texto, infográfico, carrossel, etc.
- ✅ Pilar do conteúdo
- ✅ `caption` — texto do post

---

## Modelo de Dados (Firestore)

### Snapshot Mensal
**Path:** `users/{userId}/linkedinSnapshots/{mesAno}`
`mesAno` formato: `YYYY-MM` (ex: `2026-04`)

```typescript
type LinkedInSnapshot = {
  mesAno: string;
  uploadedAt: string;          // ISO timestamp
  uploadedBy: string;          // userId

  period: {
    start: string;             // "YYYY-MM-DD"
    end: string;               // "YYYY-MM-DD"
  };

  // Aba 0
  totalImpressions: number;
  totalReach: number;

  // Contagem de posts publicados no período
  // (inferida da aba 2 — quantidade de posts únicos encontrados)
  totalPostsPublished: number;

  // Aba 1
  dailyEngagement: Array<{
    date: string;              // "YYYY-MM-DD"
    impressions: number;
    engagement: number;
  }>;

  // Aba 2 — top 3 por cada critério
  topPostsByEngagement: Array<{
    url: string;
    date: string;
    engagement: number;
    impressions: number;
    // Enriquecidos via matching com contentPipeline:
    postId?: string;
    caption?: string;
    mediaUrl?: string;
    format?: string;           // "foto" | "texto" | "infográfico" | "carrossel" | etc.
    pillar?: string;           // pilar do conteúdo
  }>;
  topPostsByImpressions: Array<{
    url: string;
    date: string;
    engagement: number;
    impressions: number;
    postId?: string;
    caption?: string;
    mediaUrl?: string;
    format?: string;
    pillar?: string;
  }>;

  // Aba 3
  totalFollowers: number;
  totalNewFollowers: number;   // soma de todos os novos seguidores do período
  dailyNewFollowers: Array<{
    date: string;
    newFollowers: number;
  }>;

  // Aba 4
  demographics: Array<{
    category: string;
    label: string;
    percentage: number;
  }>;

  // Plano de ação (apenas TL — preenchido pela estrategista)
  actionPlan?: {
    updatedAt: string;
    updatedBy: string;
    items: Array<{
      id: string;
      text: string;
      completed: boolean;
      completedAt?: string;
    }>;
  };
};
```

### Flag no Documento do Usuário
Campo adicionado ao doc `users/{userId}`:
```typescript
linkedinSnapshotStatus?: {
  lastUploadMonth: string;   // "2026-04"
  lastUploadAt: string;      // ISO timestamp
};
```

---

## Lógica do Botão de Upload

```typescript
const currentMonth = format(new Date(), 'yyyy-MM');
const shouldShowUpload = !lastUploadMonth || lastUploadMonth < currentMonth;
```

- **Aparece:** quando estamos no mês atual e upload ainda não foi feito
- **Some:** apenas após upload bem-sucedido
- **Onde aparece:** banner no topo da página Analytics + badge no item sidebar
- **Quem pode fazer upload:** TL e Colaborador (não estrategista, não admin)
- **Primeiro upload:** solicitar os últimos 12 meses para ter histórico retroativo

---

## Comparação com Mês Anterior

Para cada KPI card, a comparação é feita buscando o snapshot do mês anterior (`mesAno` - 1 mês) no Firestore. Se não existir snapshot anterior, o delta não é exibido (sem erro, sem zero forçado).

```typescript
// Exemplo de cálculo de delta
function calcDelta(current: number, previous: number | undefined) {
  if (previous === undefined || previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  return { absolute: current - previous, percentage: pct };
}
```

Delta positivo → seta verde ↑ + valor
Delta negativo → seta vermelha ↓ + valor
Sem dados anteriores → sem indicador

---

---

# Layout do Dashboard

## Header

```
┌─────────────────────────────────────────────────────────────────┐
│ [Avatar] Nome do TL              [Seletor de mês: Abril 2026 ▼] │
│                                                                  │
│ 34.017 seguidores totais                                         │
│ +1.243 este mês  ↑ vs +987 em março (+25,9%)                    │
│                                                          [apenas admin:]
│                                    Valor de Mídia: R$ 97.715    │
└─────────────────────────────────────────────────────────────────┘
```

- **Seguidores totais** (`totalFollowers`) — número atual do perfil
- **Delta de seguidores** (`totalNewFollowers` atual vs `totalNewFollowers` do mês anterior)
- **Valor de Mídia** — `(totalImpressions / 1000) * 300` — visível **apenas para admin**

---

## 5 KPI Cards

```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Impressões   │ │ Alcance      │ │ Engajamento  │ │ Seg. Ganhos  │ │ Posts        │
│              │ │              │ │              │ │              │ │ Publicados   │
│  325.719     │ │  177.444     │ │   12.840     │ │   1.243      │ │      8       │
│              │ │              │ │              │ │              │ │              │
│ ↑ +12,3%     │ │ ↑ +8,1%      │ │ ↓ -3,2%      │ │ ↑ +25,9%     │ │ ↑ +2 posts   │
│ vs mar       │ │ vs mar       │ │ vs mar       │ │ vs mar       │ │ vs mar       │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

| Card | Fonte | Comparação |
|------|-------|-----------|
| Impressões totais | `totalImpressions` | vs `totalImpressions` mês anterior |
| Alcance total | `totalReach` | vs `totalReach` mês anterior |
| Engajamento total | soma de `dailyEngagement[].engagement` | vs mês anterior |
| Seguidores ganhos | `totalNewFollowers` | vs `totalNewFollowers` mês anterior |
| Posts publicados | `totalPostsPublished` | vs `totalPostsPublished` mês anterior (delta absoluto, não %) |

---

## Gráfico 1 — Impressões por Semana (com cluster por mês)

- **Tipo:** BarChart vertical (Recharts)
- **Eixo X:** semanas, agrupadas visualmente por mês
- **Agrupamento:** barras dentro de cada mês ficam mais próximas entre si; separador visual (linha fina ou espaço maior) entre meses
- **Label do mês:** acima do grupo de semanas, centralizado — ex: `Janeiro`, `Fevereiro`
- **Mínimo de histórico:** 6 meses (~26 barras)
- **Scroll:** horizontal quando o conteúdo exceder a largura disponível
- **Dados:** agregação da `dailyEngagement[]` — somar `impressions` por semana ISO

```
Jan             Fev             Mar             Abr
│  S1 S2 S3 S4 │ S1 S2 S3 S4  │ S1 S2 S3 S4  │ S1 S2 S3 S4
│ ▓▓ ▓▓ ▓▓ ▓▓ │ ▓▓ ▓▓ ▓▓ ▓▓  │ ▓▓ ▓▓ ▓▓ ▓▓  │ ▓▓ ▓▓ ▓▓ ▓▓
```

Para montar este gráfico com dados de múltiplos meses, o componente deve buscar todos os snapshots disponíveis (via `listLinkedInSnapshots` + `getLinkedInSnapshot` em batch) e concatenar os `dailyEngagement[]`.

---

## Gráfico 2 — Seguidores por Mês

- **Tipo:** BarChart vertical (Recharts)
- **Eixo X:** meses — `Jan`, `Fev`, `Mar`, etc.
- **Eixo Y:** novos seguidores ganhos no mês (`totalNewFollowers` de cada snapshot)
- **Mínimo de histórico:** 12 meses
- **Dados:** um ponto por snapshot mensal — `totalNewFollowers`

```
     Jan  Fev  Mar  Abr  Mai  Jun  Jul  Ago  Set  Out  Nov  Dez
      ▓    ▓    ▓    ▓    ▓    ▓    ▓    ▓    ▓    ▓    ▓    ▓
```

---

## Top Posts (6 cards no total)

Duas seções lado a lado (ou empilhadas em mobile):

```
┌─────────────────────────────┐   ┌─────────────────────────────┐
│   Top 3 por Engajamento     │   │   Top 3 por Impressões      │
├─────────────────────────────┤   ├─────────────────────────────┤
│ [card 1]                    │   │ [card 1]                    │
│ [card 2]                    │   │ [card 2]                    │
│ [card 3]                    │   │ [card 3]                    │
└─────────────────────────────┘   └─────────────────────────────┘
```

### Anatomia de cada card de post

```
┌────────────────────────────────────────────┐
│ [thumbnail 80×80 ou tag "Texto"]  [Pilar]  │
│                                   [Formato]│
│ Caption truncada (2 linhas)                │
│                                            │
│ 📊 12.840 engajamento                      │
│ 👁 325.719 impressões                      │
│ 📅 02/04/2026          [Ver no LinkedIn ↗] │
└────────────────────────────────────────────┘
```

**Lógica da mídia:**
- Post com `mediaUrl` → thumbnail da imagem (80×80, object-cover, bordas arredondadas)
- Post sem `mediaUrl` (texto puro) → tag cinza `Texto`
- Post não encontrado no contentPipeline → sem thumbnail, sem tags

**Tags:**
- **Pilar:** tag colorida (cor definida pelo sistema de pilares existente na plataforma)
- **Formato:** tag neutra — `Foto`, `Texto`, `Infográfico`, `Carrossel`, `Vídeo`
- Ambas as tags ficam no canto superior direito do card

**Link "Ver no LinkedIn":**
- Abre `post.url` em nova aba
- Sempre disponível (vem direto do XLSX, independente de matching)

---

## Dados Demográficos

- Seção colapsada por default (accordion)
- Tabs por categoria: `Cargo`, `Setor`, `Tamanho da empresa`
- Barras horizontais, ordenadas por percentual decrescente
- Máximo de 10 itens por categoria (resto agrupado em "Outros")

---

## Plano de Ação *(apenas TL e Estrategista)*

- Aparece abaixo de tudo, somente quando `showActionPlan={true}`
- TL: vê checklist, pode marcar itens como concluídos
- Estrategista: vê editor + checklist, pode criar/editar/deletar itens

---

---

# FASE 1 — Analytics Core + Sidebar Admin Reestruturado

**Escopo:** Parser XLSX, Firestore, páginas Analytics (TL + Colaborador + Admin), sidebar do Admin reestruturado, sidebar do TL e Colaborador com novo item.

---

## F1.1 — Reestruturação do Sidebar do Admin

### Estrutura Nova (`admin-sidebar-nav.tsx`)

```
Dashboard                          ← item simples
Colaboradores                      ← item simples
─────────────────────────────
▼ Módulo Plataforma                ← grupo colapsável (aberto por default)
    Missões
    Trilhas
    Recompensas
    Biblioteca
─────────────────────────────
▼ Módulo Thought Leaders           ← grupo colapsável (aberto por default)
    Analytics                      ← NOVO — /admin/analytics
─────────────────────────────
LinkedIn Feed                      ← item simples (com badge de não lidos)
LinkedIn Leads                     ← item simples (disabled, "em breve")
```

### O que muda tecnicamente
- `AdminSidebarNav` deixa de usar `<SidebarNav items={...} />` (componente base plano)
- Passa a usar `Collapsible`, `SidebarGroup`, `SidebarMenu`, `SidebarMenuSub` diretamente (mesmo padrão do `StrategistSidebarNav`)
- Estado de aberto/fechado: `useState`, com grupos abertos por default
- **Não alterar** `sidebar-nav.tsx` base

### Ícones dos grupos
- Módulo Plataforma: `Layers` (lucide)
- Módulo Thought Leaders: `Users` (lucide)

---

## F1.2 — Item "Analytics" nos Sidebars de TL e Colaborador

### `thoughtleader-sidebar-nav.tsx`
Adicionar item após "LinkedIn Feed":
```typescript
{
  title: t.nav.analytics,
  href: "/thoughtleader/analytics",
  icon: BarChart2,
  badge: uploadPending ? t.nav.uploadPending : undefined,
  badgeVariant: uploadPending ? 'danger' : undefined,
}
```
Recebe `uploadPending: boolean` como prop — calculado no layout do TL.

### `colaborador-sidebar-nav.tsx`
Mesmo padrão com href `/colaborador/analytics`.

### Strings i18n
```typescript
nav: {
  analytics: "Analytics",
  uploadPending: "Upload",
}
```

---

## F1.3 — Parser XLSX

**Arquivo:** `src/lib/linkedin-xlsx-parser.ts`

```typescript
import * as XLSX from 'xlsx';

export type ParsedLinkedInData = {
  mesAno: string;
  period: { start: string; end: string };
  totalImpressions: number;
  totalReach: number;
  totalPostsPublished: number;
  totalEngagement: number;
  dailyEngagement: DailyEngagement[];
  topPostsByEngagement: TopPost[];    // máx 3
  topPostsByImpressions: TopPost[];   // máx 3
  totalFollowers: number;
  totalNewFollowers: number;
  dailyNewFollowers: DailyFollower[];
  demographics: Demographic[];
};

export function parseLinkedInXlsx(buffer: ArrayBuffer): ParsedLinkedInData;
```

**Funções auxiliares internas:**
- `parseNumberPtBR(val: unknown): number` — `"325.719"` → `325719`, `"1.234.567"` → `1234567`
- `parseDatePtBR(val: unknown): string` — `"02/04/2026"` → `"2026-04-02"`
- `parsePercentage(val: unknown): number` — `"menos de 1%"` → `0.5`, `"12,5%"` → `12.5`
- `normalizeLinkedInUrl(url: string): string` — extrai `urn:li:activity:XXXXX`
- `inferMesAno(dates: string[]): string` — mês mais frequente nas datas da aba 1

**`totalPostsPublished`:** contar posts únicos entre as duas tabelas da aba 2 (by URL, deduplicado).

**Dependência:**
```bash
npm install xlsx   # verificar se já existe no package.json antes
```

---

## F1.4 — Server Actions

**Arquivo:** `src/app/actions/linkedin-analytics.ts`

### `uploadLinkedInSnapshot`
```typescript
export async function uploadLinkedInSnapshot(
  idToken: string,
  userId: string,
  snapshotData: Omit<LinkedInSnapshot, 'actionPlan'>,
  overwrite?: boolean,
): Promise<{
  success?: boolean;
  alreadyExists?: boolean;
  mesAno?: string;
  error?: string;
}>
```

### `getLinkedInSnapshot`
```typescript
export async function getLinkedInSnapshot(
  idToken: string,
  userId: string,
  mesAno: string,
): Promise<{ snapshot?: LinkedInSnapshot; error?: string }>
```
Auth: próprio usuário | estrategista com acesso | admin da mesma empresa.

### `getLinkedInSnapshotBatch`
```typescript
// Para montar os gráficos multi-mês (impressões por semana, seguidores por mês)
export async function getLinkedInSnapshotBatch(
  idToken: string,
  userId: string,
  months: string[],  // ex: ["2026-04", "2026-03", ...]
): Promise<{ snapshots?: Record<string, LinkedInSnapshot>; error?: string }>
```

### `listLinkedInSnapshots`
```typescript
export async function listLinkedInSnapshots(
  idToken: string,
  userId: string,
): Promise<{ months?: string[]; error?: string }>
```

### `getCompanyAnalyticsUsers`
```typescript
// Para o filtro no /admin/analytics
export async function getCompanyAnalyticsUsers(
  idToken: string,
): Promise<{
  users?: Array<{
    id: string;
    name: string;
    avatarUrl?: string;
    role: 'thoughtleader' | 'colaborador';
    lastUploadMonth?: string;
  }>;
  error?: string;
}>
```

### Post Matching (helper interno, assíncrono)
```typescript
async function enrichSnapshotWithPostData(
  userId: string,
  snapshot: LinkedInSnapshot,
): Promise<void>
// Busca contentPipeline onde linkedinPostUrl contém urn:li:activity:XXXXX
// Enriquece: postId, caption, mediaUrl, format, pillar
// Falha silenciosamente — não bloqueia o upload
```

---

## F1.5 — Modal de Upload

**`src/components/linkedin-analytics/xlsx-upload-modal.tsx`**

**Estados:** `idle` → `parsing` → `preview` → `confirming_overwrite`? → `uploading` → `success` | `error`

**Preview exibido após parse:**
```
Encontramos dados de Abril 2026
• 325.719 impressões  • 177.444 alcance
• 34.017 seguidores   • 8 posts publicados
Período: 01/04/2026 – 29/04/2026
```

Arquivo: `.xlsx`, máx 10MB.

---

## F1.6 — Componentes do Dashboard

**Pasta:** `src/components/linkedin-analytics/`

| Componente | Arquivo | Descrição |
|-----------|---------|-----------|
| `AnalyticsDashboard` | `analytics-dashboard.tsx` | Orquestrador principal |
| `AnalyticsHeader` | `analytics-header.tsx` | Nome, seguidores totais, delta, valor de mídia (admin) |
| `MonthSelector` | `month-selector.tsx` | Dropdown de mês selecionado |
| `UploadPendingBanner` | `upload-pending-banner.tsx` | Banner laranja quando upload pendente |
| `AnalyticsKpiCards` | `kpi-cards.tsx` | 5 cards com delta vs mês anterior |
| `ImpressionsWeeklyChart` | `impressions-weekly-chart.tsx` | BarChart semanas com cluster por mês, 6+ meses |
| `FollowersMonthlyChart` | `followers-monthly-chart.tsx` | BarChart por mês, 12+ meses |
| `TopPostsSection` | `top-posts-section.tsx` | Contêiner das 2 colunas de top posts |
| `PostCard` | `post-card.tsx` | Card individual de post (thumbnail/tag, pilar, formato, métricas, link) |
| `DemographicsPanel` | `demographics-panel.tsx` | Accordion colapsado, tabs por categoria |
| `ActionPlanChecklist` | `action-plan-checklist.tsx` | Checklist read-only + toggle (TL) |
| `XlsxUploadModal` | `xlsx-upload-modal.tsx` | Modal de upload |
| `AnalyticsEmptyState` | `empty-state.tsx` | Estado sem dados |

### Props do `AnalyticsDashboard`
```typescript
type AnalyticsDashboardProps = {
  userId: string;
  role: 'thoughtleader' | 'colaborador' | 'strategist' | 'admin';
  showActionPlan?: boolean;       // true para TL e estrategista
  readOnlyActionPlan?: boolean;   // true para TL, false para estrategista
  showMediaValue?: boolean;       // true apenas para admin
};
```

---

## F1.7 — Rotas Novas

### `/thoughtleader/analytics`
`src/app/thoughtleader/analytics/page.tsx`
- `showActionPlan={true}`, `readOnlyActionPlan={true}`, `showMediaValue={false}`

### `/colaborador/analytics`
`src/app/colaborador/analytics/page.tsx`
- `showActionPlan={false}`, `showMediaValue={false}`

### `/admin/analytics`
`src/app/admin/analytics/page.tsx`
- Filtro de usuário (TL + Colaborador da empresa)
- `showActionPlan={false}`, `showMediaValue={true}`
- Aviso quando usuário selecionado não tem upload do mês atual

---

## F1.8 — Componentes a Preservar

| Componente | Ação |
|-----------|------|
| `LinkedInPerformance` | Manter — reativar quando API for aprovada |
| `getLinkedInDashboardMetrics` | Manter |
| `MetricsKpiCards` | Manter |
| `MetricsChart` | Manter |

Novos componentes em `src/components/linkedin-analytics/` (pasta separada de `linkedin-performance/`).

---

## F1.9 — Ordem de Implementação (Fase 1)

```
1.  Verificar/instalar dependência xlsx
2.  src/lib/constants.ts — adicionar LINKEDIN_CPM_BRL = 300
3.  src/lib/linkedin-analytics-types.ts — tipos LinkedInSnapshot, etc.
4.  src/lib/linkedin-xlsx-parser.ts — parser puro + funções auxiliares
5.  src/app/actions/linkedin-analytics.ts — todas as server actions
6.  src/components/linkedin-analytics/xlsx-upload-modal.tsx
7.  src/components/linkedin-analytics/kpi-cards.tsx
8.  src/components/linkedin-analytics/impressions-weekly-chart.tsx
9.  src/components/linkedin-analytics/followers-monthly-chart.tsx
10. src/components/linkedin-analytics/post-card.tsx
11. src/components/linkedin-analytics/top-posts-section.tsx
12. src/components/linkedin-analytics/demographics-panel.tsx
13. src/components/linkedin-analytics/analytics-header.tsx
14. src/components/linkedin-analytics/analytics-dashboard.tsx (orquestrador)
15. src/app/thoughtleader/analytics/page.tsx
16. src/app/colaborador/analytics/page.tsx
17. src/app/admin/analytics/page.tsx
18. src/components/dashboard/admin-sidebar-nav.tsx — grupos colapsáveis
19. src/components/dashboard/thoughtleader-sidebar-nav.tsx — item Analytics
20. src/components/dashboard/colaborador-sidebar-nav.tsx — item Analytics
21. src/app/thoughtleader/layout.tsx — calcular uploadPending
22. src/app/colaborador/layout.tsx — calcular uploadPending
23. i18n — strings "analytics", "uploadPending"
```

---

---

# FASE 2 — Plano de Ação + Notificações + Polish

---

## F2.1 — Plano de Ação

### Server Actions
```typescript
export async function updateActionPlan(
  idToken: string,
  tlUserId: string,
  mesAno: string,
  items: Array<{ id: string; text: string; completed: boolean }>,
): Promise<{ success?: boolean; error?: string }>
// Auth: apenas estrategista com acesso ao TL

export async function toggleActionPlanItem(
  idToken: string,
  tlUserId: string,
  mesAno: string,
  itemId: string,
  completed: boolean,
): Promise<{ success?: boolean; error?: string }>
// Auth: apenas o próprio TL
```

### Componentes
- **`action-plan-editor.tsx`** — editor da estrategista: adicionar/editar/reordenar/deletar itens + botão salvar
- **`action-plan-checklist.tsx`** — checklist do TL: read-only + toggle de conclusão

---

## F2.2 — Visão da Estrategista

Adicionar sub-item "Analytics" para cada TL no `StrategistSidebarNav`:

```
▼ [Empresa]
  ▼ [Nome do TL]
      Calendário
      Manual de Marca
      Estratégia
      Analytics          ← NOVO
```

Rota: `/strategist/[companyId]/[tlId]/analytics`
- `role="strategist"`, `showActionPlan={true}`, `readOnlyActionPlan={false}`

---

## F2.3 — Notificação de Lembrete (Dia 1)

- **Trigger:** Cron, dia 1 de cada mês, 9h BRT
- **Destinatários:** TLs e Colaboradores com LinkedIn conectado que não fizeram upload do mês atual
- **Idempotência:** campo `lastAnalyticsReminderSent` no doc do usuário
- **Canal:** Email (obrigatório) + Slack (se configurado)

Novo tipo em `notifications.ts`: `'analytics_upload_reminder'`

---

## F2.4 — Ordem de Implementação (Fase 2)

```
1. Server actions: updateActionPlan + toggleActionPlanItem
2. action-plan-editor.tsx
3. action-plan-checklist.tsx
4. Integrar plano de ação na página /thoughtleader/analytics
5. Rota /strategist/.../analytics
6. Atualizar StrategistSidebarNav — sub-item Analytics
7. notifications.ts — analytics_upload_reminder
8. Cron — lógica de envio dia 1
9. Edge cases: parse errors, zero data, mobile, sem histórico
```

---

## Pontos de Atenção (ambas as fases)

1. **Parse client-side** — XLSX parseado no browser, server action recebe JSON. Sem timeout, sem memória excessiva no servidor.

2. **Números PT-BR** — `"325.719"` → `325719`. Cobrir também `"1.234.567"`.

3. **Datas sem timezone** — armazenar como `YYYY-MM-DD`, sem conversão. Tratar como local date (Brasília).

4. **Gráfico de impressões — múltiplos snapshots** — o componente `ImpressionsWeeklyChart` precisa receber dados de N meses concatenados. Buscar via `getLinkedInSnapshotBatch`.

5. **Gráfico de seguidores — meses sem snapshot** — exibir barra zerada ou ausente. Deixar claro visualmente que o dado não existe.

6. **Post matching assíncrono** — enriquecimento opcional, falha silenciosa. Card funciona sem thumbnail/tags.

7. **CPM** — sempre importar de `LINKEDIN_CPM_BRL`, nunca hardcodar `300` nos componentes.

8. **Valor de mídia** — `showMediaValue={true}` apenas na rota do admin. Estrategista e TL não veem esse número.

9. **Admin — isolamento por tenant** — `getCompanyAnalyticsUsers` filtra por `companyId` do admin autenticado.

10. **Estrategista — isolamento por TL** — verificar relação estrategista→TL antes de retornar qualquer snapshot.

11. **Primeiro upload** — orientar usuário a exportar os últimos 12 meses para ter histórico retroativo desde o início.

12. **`LinkedInPerformance` legado** — não remover. Coexiste até API ser aprovada.
