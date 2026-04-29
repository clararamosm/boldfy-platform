# Spec: LinkedIn Analytics v2 + ICP-Fit Score

**Data:** 2026-04
**Status:** Implementado (commits ec79a93, ec8aa86, f966a98)
**Contexto:** Extensão da feature de upload XLSX mensal (spec-linkedin-analytics-xlsx.md)

---

## Resumo das mudanças

Três grandes evoluções sobre o MVP de Analytics:

1. **Separação Histórico × Mensal** — uploads retroativos (onboarding) e uploads regulares tratados de forma diferente
2. **Dashboard v2** — gráficos side-by-side mensais, demográficos redesenhados, condicionais mais claros
3. **ICP-Fit Score** — score de qualidade da audiência calculado via IA com base no Brand Context

---

## 1. Separação Histórico × Mensal

### Problema

Ao fazer o upload dos últimos 12 meses no onboarding, o sistema tratava tudo como um único mês (o último do período), gerando dados incorretos nos KPIs e top posts.

### Solução

Novo campo `uploadType?: 'monthly' | 'historical'` no `LinkedInSnapshot`:

| `uploadType` | Alimanta | Não alimenta |
|---|---|---|
| `'monthly'` | Gráficos de tendência, KPIs, top posts, seletor de mês, plano de ação | — |
| `'historical'` | Gráficos de tendência | KPIs, top posts, seletor, plano de ação |

**Compatibilidade retroativa:** snapshots existentes sem o campo defaultam para `'monthly'` (`uploadType ?? 'monthly'`).

### Fluxo de dados no Dashboard

```
listLinkedInSnapshots() → todos os meses
  ↓
getLinkedInSnapshotBatch() → batch de todos os snapshots
  ↓
filter(uploadType === 'monthly') → monthlyMonths (seletor)
batch completo → trendMap (gráficos)
  ↓
hasOnlyHistorical = monthlyMonths.length === 0
```

### Estados do Dashboard

| Estado | Condição | O que aparece |
|---|---|---|
| Sem dados | `trendSnapshots` vazio | "Nenhum dado disponível ainda" + botão upload |
| Só histórico | `hasOnlyHistorical` = true | Gráficos + "Histórico importado ✓" |
| Com mensal | `snapshot` + `!hasOnlyHistorical` | Tudo (KPIs, top posts, demográficos, ICP-Fit, plano de ação) |

---

## 2. Dashboard v2

### 2.1 Gráficos Side-by-Side Mensais

Layout: `grid grid-cols-1 lg:grid-cols-2 gap-4`

- **ImpressionsMonthlyChart** (novo, substitui ImpressionsWeeklyChart)
  - Barras mensais com cor `#3b82f6`
  - Preenche lacunas entre primeiro e último mês disponível (barra zerada para meses sem dados)
  - Rótulo de ano acima quando o ano muda
  - Input: `Record<string, Pick<LinkedInSnapshot, 'mesAno' | 'totalImpressions'>>`

- **FollowersMonthlyChart** (existente, sem mudanças)

Ambos usam o `trendMap` completo (histórico + mensal), então o histórico de 12 meses aparece nos gráficos assim que é importado.

### 2.2 DemographicsPanel Redesenhado

**Antes:** accordion com tabs por categoria
**Depois:** grid sempre visível

```
grid-cols-1 → sm:grid-cols-2 → lg:grid-cols-3
```

Cada categoria tem seu próprio `CategoryChart`:
- Top 5 itens por percentual
- Barras horizontais proporcionais ao valor máximo da categoria (não ao 100%)
- Cor configurada por categoria via `CATEGORY_CONFIG`
- Título em uppercase com `tracking-wide`

Categorias com cores:

| Categoria | Cor |
|---|---|
| Cargo | `#6366f1` (indigo) |
| Setor | `#0ea5e9` (sky) |
| Tamanho da empresa | `#10b981` (emerald) |
| Localização | `#f59e0b` (amber) |
| Senioridade | `#ec4899` (pink) |
| País | `#8b5cf6` (violet) |

### 2.3 XlsxUploadModal com uploadType

Novo prop `uploadType?: 'monthly' | 'historical'` (default `'monthly'`).

O modal injeta o tipo no `ParsedLinkedInData` antes de chamar `uploadLinkedInSnapshot`, garantindo que o upload do onboarding seja gravado como `'historical'`.

Títulos adaptativos:
- `'historical'`: "Importar Histórico LinkedIn (12 meses)"
- `'monthly'`: "Upload do Relatório LinkedIn"

---

## 3. ICP-Fit Score

### Problema

A empresa define um ICP (Ideal Customer Profile) no Brand Context, mas não havia forma de medir se a audiência real do LinkedIn bate com esse ICP.

### Solução: Score via LLM

**Por que LLM e não campos estruturados?**
O LinkedIn tem centenas de variações de cargo ("Head de Marketing", "VP Marketing", "Gerente de Marketing Sênior", "Marketing Manager") que mapeiam para o mesmo ICP. Um multiselect estruturado exigiria lista exaustiva e manutenção constante. O LLM agrupa semanticamente sem necessidade de enumeração.

### Tipos

```typescript
type IcpFitCategoryScore = {
  category: string;    // "Cargo" | "Setor" | "Tamanho da empresa"
  score: number;       // 0-100
  insight: string;     // uma frase curta
};

type IcpFitScore = {
  overall: number;           // 0-100
  categories: IcpFitCategoryScore[];
  summary: string;           // 2-3 frases
  computedAt: string;        // ISO timestamp
};
```

### Fluxo de cálculo

```
getIcpFitScore(token, userId, mesAno)
  ↓
requireSnapshotAccess()           // auth check
getLinkedInSnapshot()             // demograficos
users/{userId}.companyId          // empresa do TL
companies/{companyId}.brandContext.targetAudience   // ICP
  ↓
if (!targetAudience) → { noTargetAudience: true }
  ↓
Agrupar demos por categoria, top 8 por %, montar summary
  ↓
ai.generate(prompt)               // Gemini 2.5 Flash via Genkit
  ↓
JSON.parse() + validação + clamp(0,100)
  ↓
{ score: IcpFitScore }
```

### Prompt

O prompt instrui o modelo a:
1. Comparar os cargos mais presentes com os decisores do ICP
2. Verificar se os setores batem com o mercado-alvo
3. Confirmar se o tamanho de empresa corresponde ao segmento-alvo
4. Retornar JSON estritamente formatado (sem markdown fence)

### Componente IcpFitScoreCard

Renderizado no dashboard após `DemographicsPanel`, somente quando `showIcpScore={true}` e existe snapshot mensal.

**Estados:**
- **Idle** — botão "Calcular ICP-Fit Score" (cálculo on-demand, não automático)
- **Loading** — spinner + "Analisando audiência vs ICP..."
- **Sem ICP** — aviso para preencher targetAudience no Brand Context
- **Erro** — mensagem + botão "Tentar novamente"
- **Score** — ring circular + barras por categoria + summary + timestamp

**Score Ring:**
- Verde (`#10b981`) para score ≥ 70 → "Alto fit"
- Amarelo (`#f59e0b`) para score 45-69 → "Fit médio"
- Vermelho (`#ef4444`) para score < 45 → "Baixo fit"

### Onde `showIcpScore` é ativado

| Página | Prop |
|---|---|
| `/thoughtleader/analytics` | `showIcpScore={true}` |
| `/colaborador/analytics` | `showIcpScore={true}` |
| `/strategist/analytics` | `showIcpScore={true}` |

---

## 4. Onboarding — Upload Histórico Bloqueante

### Problema

Os usuários chegavam ao dashboard sem histórico, sem entender que precisavam importar os últimos 12 meses do LinkedIn Analytics para ativar os gráficos.

### Solução

Step `upload-linkedin-history` adicionado ao checklist de TL e Colaborador.

No `WelcomePopup` (fluxo da Fai):
- Mensagem explica a importância do histórico
- Tutorial em 3 passos: link para LinkedIn Analytics → selecionar 12 meses → exportar .xlsx
- Botão "Fazer upload do histórico" abre o `XlsxUploadModal` com `uploadType='historical'`
- Botão "Vamos lá! →" fica **desabilitado** até o upload ser concluído
- Hint "Faça o upload do histórico para continuar ↑" aparece quando todas as mensagens estão visíveis mas o upload ainda não foi feito

Após upload bem-sucedido:
- `completeOnboardingItem(uid, 'upload-linkedin-history')` é chamado
- `historyUploaded` fica `true` → botão "Vamos lá! →" desbloqueia

### Checklist atualizado

**THOUGHTLEADER_CHECKLIST:**
1. Conectar seu LinkedIn
2. **Importar histórico LinkedIn** ← novo

**COLABORADOR_CHECKLIST:**
1. Conectar LinkedIn
2. **Importar histórico LinkedIn** ← novo
3. Ver uma trilha
4. Criar um post
5. Completar uma missão

---

## 5. Arquivos Modificados/Criados

| Arquivo | Tipo | Mudança |
|---|---|---|
| `src/lib/linkedin-analytics-types.ts` | Modificado | `uploadType` em `LinkedInSnapshot`; tipos `IcpFitCategoryScore` e `IcpFitScore` |
| `src/app/actions/linkedin-analytics.ts` | Modificado | Import `ai`; server action `getIcpFitScore` |
| `src/components/linkedin-analytics/impressions-monthly-chart.tsx` | Novo | Gráfico de barras mensais de impressões |
| `src/components/linkedin-analytics/analytics-dashboard.tsx` | Modificado | Separação monthly/historical; gráficos side-by-side; `showIcpScore` prop |
| `src/components/linkedin-analytics/demographics-panel.tsx` | Reescrito | Grid responsivo 1→2→3 colunas, sem accordion |
| `src/components/linkedin-analytics/xlsx-upload-modal.tsx` | Modificado | Prop `uploadType`; título adaptativo |
| `src/components/linkedin-analytics/icp-fit-score-card.tsx` | Novo | Score ring, barras por categoria, summary |
| `src/hooks/use-onboarding.ts` | Modificado | `upload-linkedin-history` em TL e Colab checklists |
| `src/components/onboarding/welcome-popup.tsx` | Modificado | `LinkedInExportTutorial`, props `onRequestUpload`/`historyUploaded`, `canProceed` |
| `src/components/onboarding/onboarding-shell.tsx` | Modificado | Estado modal histórico; `XlsxUploadModal`; `completeOnboardingItem` |
| `src/app/thoughtleader/analytics/page.tsx` | Modificado | `showIcpScore={true}` |
| `src/app/colaborador/analytics/page.tsx` | Modificado | `showIcpScore={true}` |
| `src/app/strategist/analytics/page.tsx` | Modificado | `showIcpScore={true}` |

---

## 6. Decisões de Design

### Por que cálculo on-demand e não automático?

O ICP-Fit Score usa a IA (custo por chamada). Calcular automaticamente em cada load do dashboard seria caro e lento. O usuário clica quando quer ver o score, e pode recalcular com o botão de refresh.

**Evolução futura:** Salvar o score no snapshot após calculado para evitar recálculo desnecessário (campo `icpFitScore?: IcpFitScore` no `LinkedInSnapshot`).

### Por que não salvar no snapshot agora?

O Brand Context pode mudar sem novo upload de analytics. Se salvássemos no snapshot, o score ficaria desatualizado silenciosamente. O cálculo on-demand garante que sempre usa o ICP mais atual.

### Separação histórico/mensal — backward compatibility

Snapshots existentes sem `uploadType` tratados como `'monthly'` (`uploadType ?? 'monthly'`). Isso preserva o comportamento existente para usuários que já fizeram upload antes desta feature.

---

## 7. Limitações Conhecidas

1. **Demografias ausentes:** Se o snapshot não tiver dados demográficos (ex: perfil novo com pouca audiência), o LLM retorna score 0 com insight explicando. O card ainda aparece mas o score pode ser enganoso.

2. **ICP muito vago:** Um `targetAudience` genérico como "profissionais de marketing" pode gerar scores altos mesmo sem fit real. A qualidade do score depende da qualidade do ICP definido.

3. **Sem cache:** Cada clique em "Calcular" faz uma chamada ao Gemini. Em alta escala, considerar cache por `(userId, mesAno, targetAudience hash)` com TTL de 24h.

4. **Onboarding retroativo:** Usuários que já concluíram o onboarding (antes desta feature) não verão o novo step. O item `upload-linkedin-history` ficará como pendente no checklist da Fai widget, mas sem bloqueio. Considerar migration de dados ou skip automático para contas existentes com `welcomeSeen=true`.
