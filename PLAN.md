# Plano: LinkedIn Performance Metrics em Todos os Dashboards

## Visao Geral

Criar um componente reutilizavel `<LinkedInPerformance />` com graficos visuais (Recharts, ja instalado) e filtro de periodo, e integra-lo em 5 pontos da plataforma. Alem disso, exibir metricas inline (reacoes + comentarios) nos cards do calendario e no feed do LinkedIn.

---

## Componente Principal: `<LinkedInPerformance />`

**Arquivo:** `src/components/linkedin-performance/linkedin-performance.tsx`

### Props
```typescript
type LinkedInPerformanceProps = {
  userId: string;
  hideIfNotConnected?: boolean;
  showProfileFilter?: boolean;
  profiles?: Array<{ id: string; name: string; picture?: string }>;
};
```

### Conteudo Visual

**Filtro de Periodo** (topo, a direita do titulo):
- Select com opcoes: "Esta semana", "Este mes", "Ultimo mes", "Ultimos 3 meses"
- Filtro de perfil (apenas estrategista): dropdown com TLs

**KPI Cards** (grid 2x2 mobile, 4 colunas desktop):
1. Posts Publicados (icone Send, fundo azul LinkedIn)
2. Total de Reacoes (icone Heart, fundo rose)
3. Total de Comentarios (icone MessageCircle, fundo blue)
4. Media de Reacoes/Post (icone TrendingUp, fundo green)

**Grafico de Area** (Recharts `AreaChart`):
- Eixo X: datas dos posts (agrupados por semana conforme periodo)
- Duas areas: Reacoes (rose) e Comentarios (azul)
- Tooltip com data + valores
- Responsivo via `ResponsiveContainer`
- Usa o wrapper `ChartContainer` do shadcn/ui que ja existe em `src/components/ui/chart.tsx`

**Lista dos 5 Posts Recentes** (abaixo do grafico):
- Caption preview (120 chars)
- Data de publicacao
- Coracao + total reacoes | Comentario + total comentarios
- Link externo para o post no LinkedIn

---

## Mudancas no Backend (Server Action)

**Arquivo:** `src/app/actions/linkedin.ts`

### Modificar `getLinkedInDashboardMetrics()`

Adicionar parametro opcional de periodo:
```typescript
export async function getLinkedInDashboardMetrics(
  idToken: string,
  userId: string,
  dateRange?: { start: string; end: string }
): Promise<DashboardMetrics>
```

- Se `dateRange` fornecido: filtrar posts publicados cujo `publishedAt` cai dentro do range
- Se nao fornecido: comportamento atual (ultimos 50 posts, sem filtro de data)

---

## Onde o componente sera usado (5 pontos)

### 1. Dashboard do Colaborador
**Arquivo:** `src/app/colaborador/dashboard/page.tsx`
- **Acao:** Substituir o bloco atual de LinkedIn Performance (linhas 352-470) + `LinkedInPostCard` inline pelo novo `<LinkedInPerformance userId={uid} />`
- Remove ~120 linhas de codigo inline, substitui por 1 import + uso

### 2. Dashboard do Thought Leader
**Arquivo:** `src/app/thoughtleader/dashboard/page.tsx`
- **Acao:** Substituir o card "Backlog de conteudo" (linhas 131-174) pelo `<LinkedInPerformance userId={uid} />`
- Os 4 KPI cards do pipeline permanecem no topo (publicados, agendados, pendentes, total)
- O bloco de LinkedIn Performance fica abaixo, no lugar do backlog

### 3. Calendario do Thought Leader
**Arquivo:** `src/app/thoughtleader/calendario/page.tsx`
- **Acao:** Adicionar `<LinkedInPerformance userId={userId} />` APOS o `<PostListTable />`
- Secao extra no final da pagina, abaixo da tabela de posts

### 4. Calendario do Estrategista
**Arquivo:** `src/app/strategist/calendario/page.tsx`
- **Acao:** Adicionar o bloco APOS o `<PostListTable />`
- **Props especiais:** `showProfileFilter={true}` + `profiles={tlProfiles}`
- O filtro de perfil permite ao estrategista ver metricas de cada TL individualmente

### 5. Dashboard do Estrategista
**Arquivo:** `src/app/strategist/dashboard/page.tsx`
- **Acao:** Substituir o Card "Em breve: metricas de todos os perfis" (linhas 349-360) pelo `<LinkedInPerformance />` com filtro de perfil
- Usa o primeiro TL da lista como default

---

## Metricas Inline nos Cards do Calendario

**Arquivo:** `src/components/calendar/calendar-post-card.tsx`

### Mudanca
- Adicionar props opcionais: `reactions?: number` e `comments?: number`
- Quando `post.status === 'postado'` E metricas existirem: exibir na mesma linha do horario, no lado direito:
  - Heart icon (h-3 w-3, rose-500) + numero
  - MessageCircle icon (h-3 w-3, blue-500) + numero
- Se metricas nao disponiveis para aquele post: nao mostra nada

### Dados para os cards
- Nas paginas de calendario (TL e Estrategista): usar as metricas ja carregadas pelo `<LinkedInPerformance />`
- Criar um estado compartilhado ou prop callback que passa o Map de `postId -> { reactions, comments }` para o calendario
- Abordagem: o componente `<LinkedInPerformance />` expoe as metricas via callback `onMetricsLoaded` que o calendario usa para alimentar os cards

---

## Metricas no Feed do LinkedIn

**Arquivo:** `src/components/linkedin-feed/linkedin-feed-view.tsx`

### Mudanca
- Apos a midia do post e antes do footer, adicionar barra de engajamento:
  - Heart icon + "42 reacoes" · MessageCircle icon + "5 comentarios"
  - Texto muted, tamanho pequeno (text-xs text-muted-foreground)

### Dados
- Fetch separado e assincrono das metricas apos carregar os posts do feed
- Mostra skeleton enquanto carrega as metricas
- Nao bloqueia o carregamento do feed em si

---

## Estrutura de Arquivos Novos

```
src/components/linkedin-performance/
  linkedin-performance.tsx     -- Componente principal reutilizavel
  metrics-chart.tsx            -- Grafico de area com Recharts
  metrics-kpi-cards.tsx        -- Grid de 4 KPI cards
  period-filter.tsx            -- Select de periodo + filtro de perfil
```

---

## Ordem de Implementacao

1. Backend: Modificar `getLinkedInDashboardMetrics()` com suporte a `dateRange`
2. Componente `<LinkedInPerformance />` com subcomponentes (KPI, grafico, lista, filtro)
3. Dashboard Colaborador: Substituir bloco inline pelo componente
4. Dashboard TL: Substituir backlog pelo componente
5. Calendario TL: Adicionar componente apos tabela
6. Calendario Estrategista: Adicionar componente com filtro de perfil
7. Dashboard Estrategista: Substituir placeholder
8. Calendar post cards: Adicionar metricas inline nos cards de posts postados
9. Feed do LinkedIn: Adicionar barra de engajamento
10. TypeScript check + commit
