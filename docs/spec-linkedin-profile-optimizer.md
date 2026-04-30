# Spec: LinkedIn Profile Optimizer
**Data:** 2026-04
**Status:** Pronto para implementação
**Documento de treinamento da IA:** `docs/profile-optimizer-training.md`
**Documento de boas práticas (360Brew):** PDF global Boldfy salvo em Firebase Storage — `linkedinProfiles/global/best-practices.pdf`

---

## Visão geral

Feature que permite à estrategista otimizar o perfil LinkedIn de cada TL com base em:
- PDF do perfil exportado do LinkedIn
- Brand Context do TL (pilares, ICP, posicionamento)
- Posts recentes do content pipeline
- Regras do algoritmo 360Brew (documento de treinamento hardcoded no prompt)

A IA gera sugestões estruturadas. A estrategista edita e publica. O TL vê um mockup visual do perfil otimizado com botões de copy/download.

---

## Estrutura de dados

### Firestore: `users/{tlUserId}/linkedinProfile/current`

```typescript
type LinkedInProfileOptimization = {
  // Perfil atual extraído do PDF
  current: {
    headline: string;
    about: string;
    topSkills: string[];           // até 5 (o que existia no PDF)
    experiences: Experience[];
    featuredItems: FeaturedItem[];
    extractedAt: string;           // ISO timestamp
  };

  // Sugestões da IA
  suggestions: ProfileSuggestions | null;

  // Versão editada pela estrategista (pode divergir das sugestões)
  edited: ProfileSuggestions | null;
  editedAt: string | null;

  // Status do fluxo
  status: 'empty' | 'processing' | 'ready' | 'published';
  publishedAt: string | null;
};

type ProfileSuggestions = {
  headline: string;
  about: string;
  topSkills: string[];             // exatamente 5
  experiences: ExperienceSuggestion[];
  featuredItems: FeaturedItemSuggestion[];
  semanticAlignment: SemanticAlignment;
  gapAnalysis: string;             // texto livre com diagnóstico
  generatedAt: string;             // ISO timestamp
};

type Experience = {
  title: string;
  company: string;
  period: string;                  // ex: "jan 2022 – presente"
  description: string;
  isCurrent: boolean;
};

type ExperienceSuggestion = Experience & {
  action: 'keep' | 'rewrite' | 'add_impact';
  rewrittenDescription?: string;   // preenchido se action !== 'keep'
};

type FeaturedItem = {
  title: string;
  url?: string;
  imageUrl?: string;
};

type FeaturedItemSuggestion = FeaturedItem & {
  action: 'keep' | 'replace' | 'add';
  rationale: string;
};

type SemanticAlignment = {
  score: number;                   // 0–100
  passesAudit: boolean;            // score >= 40
  issues: AlignmentIssue[];
};

type AlignmentIssue = {
  element: 'headline' | 'about' | 'skills' | 'experience' | 'featured';
  severity: 'high' | 'medium' | 'low';
  description: string;             // ex: "Headline genérico — não declara nicho"
  fix: string;                     // ex: "Declare o problema resolvido + metodologia"
};
```

### Firebase Storage
- `linkedinProfiles/{tlUserId}/profile.pdf` — PDF do perfil do TL (upload pela estrategista)
- `linkedinProfiles/global/best-practices.pdf` — PDF de boas práticas Boldfy (upload único, lido pela IA em todas as gerações)

**Nota:** Firebase Storage ainda não está inicializado no `firebase-admin.ts`. Precisa adicionar `admin.storage()` na inicialização.

---

## Rotas

| Rota | Quem acessa | Descrição |
|------|------------|-----------|
| `/thoughtleader/perfil` | TL | Mockup visual read-only do perfil otimizado |
| `/strategist/perfil?tl={slug}` | Estrategista | Editor completo: upload PDF → gerar → editar → publicar |

### Sidebar nav

**TL:** adicionar item "Perfil" com ícone `UserCircle` entre Analytics e Estratégia. Badge `Novo` se `status === 'published'` e TL ainda não viu a página.

**Estrategista:** adicionar item "Perfil" na lista de ações por TL (similar à estrutura de `/strategist/analytics?tl={slug}`).

---

## Server actions necessárias

Arquivo sugerido: `src/app/actions/profile-optimizer.ts`

```typescript
// Upload do PDF + dispara extração e geração de sugestões
uploadProfilePdf(idToken, tlUserId, pdfBuffer): Promise<{ success?, error? }>

// Retorna o documento atual (current + suggestions/edited + status)
getLinkedInProfile(idToken, tlUserId): Promise<{ profile?, error? }>

// Salva edições da estrategista (sem publicar)
saveProfileEdits(idToken, tlUserId, edited: ProfileSuggestions): Promise<{ success?, error? }>

// Publica para o TL (muda status para 'published')
publishProfile(idToken, tlUserId): Promise<{ success?, error? }>

// Upload do PDF de boas práticas global (só master/admin)
uploadBestPracticesPdf(idToken, pdfBuffer): Promise<{ success?, error? }>
```

### Controle de acesso
- TL: só pode chamar `getLinkedInProfile` com seu próprio `userId`
- Estrategista: pode chamar todas exceto `uploadBestPracticesPdf`, mas apenas para TLs da sua empresa (usar `requireStrategistForTL`)
- Master/Admin: acesso total

---

## Fluxo da estrategista (`/strategist/perfil?tl={slug}`)

### Estado 1: Vazio (`status === 'empty'`)
- Upload zone para PDF do perfil do TL
- Instrução: "Exporte o perfil do TL como PDF no LinkedIn e envie aqui"
- Link de ajuda: como exportar o PDF (`https://www.linkedin.com/in/[slug]/overlay/about-this-profile/`)
- Ao fazer upload → chama `uploadProfilePdf` → muda status para `'processing'`

### Estado 2: Processando (`status === 'processing'`)
- Spinner com etapas visíveis:
  1. ✓ PDF recebido
  2. ⟳ Extraindo perfil atual...
  3. ⟳ Lendo Brand Context e pilares de conteúdo...
  4. ⟳ Gerando sugestões de otimização...
  5. ⟳ Calculando score 360Brew...
- Polling a cada 3s em `getLinkedInProfile` até `status !== 'processing'`

### Estado 3: Editor (`status === 'ready' | 'published'`)
Layout split: painel esquerdo (editor) + painel direito (preview mockup)

**Topo:**
- Score 360Brew badge (verde ≥70, amarelo 40–69, vermelho <40)
- "Passa na auditoria ✓" ou "Não passa ✗"
- Lista colapsável de issues com severidade

**Abas do editor:**
1. **Headline** — campo de texto, contador de chars, diff com original
2. **Sobre** — textarea com preview de formatação, diff com original
3. **Competências** — 5 chips editáveis, aviso se alguma está fora do nicho
4. **Experiências** — lista accordion, cada item com campo de descrição editável e badge (keep/rewrite/add_impact)
5. **Destaque** — 2 itens com título + URL + imagem

**Botão "Aplicar sugestão da IA"** em cada campo — sobrescreve o conteúdo editado com a sugestão original da IA.

**Botão "Publicar para TL"** — confirmação modal → chama `publishProfile`.

**Botão "Re-gerar com IA"** — faz novo upload e regenera tudo (mantém o PDF existente no Storage, só re-roda a IA).

---

## Fluxo do TL (`/thoughtleader/perfil`)

### Estado: Sem publicação (`status !== 'published'`)
Card simples: "Seu perfil está sendo preparado pelo time de estratégia. Em breve você terá sugestões de otimização aqui."

### Estado: Publicado (`status === 'published'`)
Mockup visual do perfil LinkedIn com todas as sugestões aplicadas.

**Seções e ações:**

| Seção | Ação disponível |
|-------|----------------|
| Header (banner + foto + nome) | Download do banner, download da foto |
| Headline | Botão "Copiar" |
| Sobre | Botão "Copiar" |
| Competências | Botão "Copiar" por skill |
| Destaque | "Copiar link" + "Baixar imagem" por item |
| Experiências | Botão "Copiar" por experiência |
| Botão Seguir | Tooltip: como ativar nas configurações do LinkedIn |

**Tooltip "Botão Seguir":**
> "Para ativar: LinkedIn → Configurações → Visibilidade → Seguidores e conexões → Todos no LinkedIn podem seguir você"

**Score 360Brew** (read-only, versão simplificada):
> "Seu perfil está X% alinhado ao algoritmo do LinkedIn"
> Badge verde/amarelo/vermelho + 1 linha de contexto (sem lista técnica de issues)

---

## Processamento do PDF (server-side)

### Dependências a instalar
```bash
npm install pdf-parse
npm install --save-dev @types/pdf-parse
```

### Fluxo de extração
1. Recebe o buffer do PDF
2. Extrai texto bruto via `pdf-parse`
3. Envia para a IA com um prompt de extração estruturada (primeiro passo separado)
4. IA retorna JSON com `{ headline, about, topSkills, experiences, featuredItems }`
5. Salva em `linkedinProfile/current`
6. Roda o segundo prompt (geração de sugestões)
7. Salva em `linkedinProfile/suggestions`
8. Muda `status` para `'ready'`

### Por que dois prompts separados
- Prompt 1 (extração): sem brand context, só lê o PDF e estrutura os dados
- Prompt 2 (geração): recebe o perfil estruturado + brand context + posts recentes + treinamento 360Brew

Isso evita confusão entre "o que o TL tem hoje" e "o que a IA está sugerindo", e permite re-gerar as sugestões sem re-extrair o PDF.

---

## Prompt de geração (estrutura)

```
Você é especialista em otimização de perfil LinkedIn para fundadores e executivos B2B.

## REGRAS DO ALGORITMO 360BREW
[conteúdo do docs/profile-optimizer-training.md — hardcoded no prompt]

## PERFIL ATUAL DO TL
[JSON do linkedinProfile/current]

## BRAND CONTEXT
- Nome: {name}
- Cargo: {role}
- Empresa: {company}
- Público-alvo (ICP): {targetAudience}
- Pilares de conteúdo: {contentPillars}
- Posicionamento: {positioning}
- Tom de voz: {brandVoice}

## POSTS RECENTES (últimos 12)
[lista de títulos/captions do contentPipeline]

## BOAS PRÁTICAS BOLDFY
[texto extraído do best-practices.pdf via pdf-parse]

## TAREFA
Gere sugestões de otimização para cada seção do perfil.
Retorne um JSON válido no formato ProfileSuggestions.
Não invente dados ou números que não existam no perfil atual.
Cada sugestão deve ser claramente diferente do original e justificada pelas regras do 360Brew.
```

---

## Score de alinhamento 360Brew (cálculo determinístico)

Calculado após a geração das sugestões, sobre o **perfil sugerido/editado** (não o atual).

| Critério | Peso | Lógica |
|----------|------|--------|
| Headline contém palavras-chave dos pilares | 25% | Match parcial bidirecional (igual ao ICP-Fit Score) |
| Sobre menciona explicitamente os pilares | 25% | Verificar se os tópicos dos pilares aparecem no texto |
| Competências espelham pilares (% de match) | 25% | `matched / 5 * 25` |
| Cargo atual preenchido com palavras do nicho | 15% | Experiência `isCurrent=true` tem descrição com keywords do nicho |
| Sem dissonâncias críticas (Identity Mismatch) | 10% | -10% por issue de severidade `high` |

**Threshold:** score ≥ 40 = passa auditoria.

O score é recalculado em tempo real no editor da estrategista conforme ela edita os campos.

---

## Inicialização do Firebase Storage

Em `src/lib/firebase-admin.ts`, adicionar:

```typescript
import { Storage } from 'firebase-admin/storage';

let storage: Storage;
// ...dentro do bloco de inicialização existente:
storage = admin.storage();

export { db, auth, storage };
```

Configurar o bucket no `apphosting.yaml` ou via variável `FIREBASE_STORAGE_BUCKET`.

---

## Ordem de implementação recomendada

1. **Tipos** — adicionar `LinkedInProfileOptimization`, `ProfileSuggestions`, etc. em `src/lib/linkedin-analytics-types.ts`
2. **Storage** — inicializar `admin.storage()` em `firebase-admin.ts`
3. **Instalar dependências** — `pdf-parse` + types
4. **Server actions** — `src/app/actions/profile-optimizer.ts` com as 5 funções
5. **Página estrategista** — `src/app/strategist/perfil/page.tsx` com os 3 estados
6. **Página TL** — `src/app/thoughtleader/perfil/page.tsx` com mockup + botões
7. **Sidebar navs** — adicionar item "Perfil" em ambos os navs
8. **Score determinístico** — função `computeAlignmentScore()` (reutiliza lógica do ICP-Fit)

---

## Arquivos que serão criados

```
src/app/actions/profile-optimizer.ts          ← server actions
src/app/strategist/perfil/page.tsx            ← editor estrategista
src/app/thoughtleader/perfil/page.tsx         ← mockup TL
src/components/profile-optimizer/
  profile-editor.tsx                          ← editor com abas
  profile-preview.tsx                         ← mockup visual
  alignment-score-badge.tsx                   ← badge 360Brew
  alignment-issues-panel.tsx                  ← lista de issues
  experience-editor.tsx                       ← accordion de experiências
  featured-editor.tsx                         ← editor do destaque
```

## Arquivos que serão modificados

```
src/lib/linkedin-analytics-types.ts           ← novos tipos
src/lib/firebase-admin.ts                     ← adicionar storage
src/components/dashboard/thoughtleader-sidebar-nav.tsx   ← item Perfil
src/components/dashboard/strategist-sidebar-nav.tsx      ← item Perfil
package.json                                  ← pdf-parse
```

---

*Spec criado pela Boldfy · Abril 2026*
*Documento de treinamento da IA: `docs/profile-optimizer-training.md`*
