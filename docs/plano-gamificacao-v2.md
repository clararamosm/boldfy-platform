# Plano de Evolução da Gamificação — Boldfy Platform

> **Versão:** 2.0
> **Data:** Maio 2026
> **Status:** Em planejamento — aprovação pendente
> **Objetivo:** Tornar a experiência do colaborador viciante, recompensar ações estratégicas na plataforma, e gerar valor percebido imediato tanto pro colaborador quanto pro admin da empresa.

---

## Índice

1. [Contexto e Diagnóstico Atual](#1-contexto-e-diagnóstico-atual)
2. [Novas Mecânicas de Ganho de Pontos](#2-novas-mecânicas-de-ganho-de-pontos)
3. [Economia de Pontos Completa](#3-economia-de-pontos-completa)
4. [Sistema de Conquistas e Reconhecimento](#4-sistema-de-conquistas-e-reconhecimento)
5. [Página de Ranking e Conquistas](#5-página-de-ranking-e-conquistas)
6. [Recompensas: Nativas Boldfy vs Sugestões para Admin](#6-recompensas-nativas-boldfy-vs-sugestões-para-admin)
7. [Cardápio de Sugestões de Recompensas](#7-cardápio-de-sugestões-de-recompensas)
8. [Marcas Brasileiras com Gift Cards Disponíveis](#8-marcas-brasileiras-com-gift-cards-disponíveis)
9. [Sistema de Banco de Códigos (Entrega de Cupons)](#9-sistema-de-banco-de-códigos-entrega-de-cupons)
10. [Integração com Onboarding](#10-integração-com-onboarding)
11. [Simulação de Cenários](#11-simulação-de-cenários)
12. [Resumo Técnico de Implementação](#12-resumo-técnico-de-implementação)
13. [Pop-ups e Notificacoes — Hierarquia Completa](#13-pop-ups-e-notificacoes--hierarquia-completa)
14. [Sistema de Niveis](#14-sistema-de-niveis)
15. [Dashboard Gamificado do Colaborador](#15-dashboard-gamificado-do-colaborador)
16. [Decisoes Anteriores](#16-decisoes-anteriores)
17. [Mapa de Integracoes entre Modulos](#17-mapa-de-integracoes-entre-modulos)
18. [Decisoes Pendentes e Proximos Passos](#18-decisoes-pendentes-e-proximos-passos)

---

## 1. Contexto e Diagnóstico Atual

### O que já existe e funciona:

| Mecânica | Status | Observação |
|----------|--------|------------|
| Pontos por conclusão de trilhas | ✅ Ativo | Vídeo: 80pts, Leitura: 40pts, Quiz: 80pts (bônus 80%+: 110pts), Conclusão trilha: 30pts fixo |
| Pontos por missões | ✅ Ativo | Auto-complete ou com aprovação do admin |
| Loja de recompensas | ✅ Ativo | Admin cria recompensas manualmente |
| Ranking top 10 | ✅ Ativo | Widget no dashboard do colaborador |
| Prêmio mensal | ✅ Ativo | Admin seleciona uma recompensa como prêmio mensal |
| Créditos de IA como recompensa | ✅ Parcial | Backend suporta, mas admin não consegue criar pela UI |
| Histórico de pontos | ✅ Ativo | Subcoleção `pointsHistory` com transações |

### O que falta (gaps identificados):

- ❌ Publicar no LinkedIn **não dá pontos** — a ação mais valiosa da plataforma não é gamificada
- ❌ Colaborador novo **não vê nenhuma recompensa** até o admin configurar
- ❌ Não existe nenhum mecanismo de **hábito/streak**
- ❌ Não existem **marcos de progresso (conquistas)** que celebrem conquistas
- ❌ Ranking é só um widget pequeno no dashboard — não tem uma **página dedicada**
- ❌ Nenhum mecanismo de **reconhecimento social** entre colaboradores
- ❌ Admin não tem **orientação** sobre que recompensas criar ou quanto custarem
- ❌ Créditos de IA não aparecem como opção de recompensa no formulário do admin

---

## 2. Novas Mecânicas de Ganho de Pontos

### 2.1 Pontos por publicação no LinkedIn (30 pts)

**Gatilho:** Quando `publishToLinkedIn()` retorna sucesso e o post muda para `status='published'`.

**Implementação:**
- Dentro da função de publicação, após confirmação de sucesso:
  - Registrar em `pointsHistory` com `source: 'publicacao'`
  - Incrementar `user.points` com `FieldValue.increment(30)`
  - Chamar `recalculatePoints()` para manter consistência

**Regras:**
- Apenas posts publicados com sucesso via Boldfy contam
- Posts agendados só contam quando efetivamente publicados
- Posts editados/republicados NÃO geram pontos novamente (controlar por `scheduledPostId`)

**Por que 30 pontos:** 30 pts é o valor base por publicação — suficiente pra sentir progresso a cada post, mas o real incentivo de pontuação vem do streak semanal. Quem publica consistentemente (3+/semana) ganha o bônus exponencial por cima. Com 30 pts, o colaborador precisa de ~4 posts pra conseguir o micro-resgate mais barato (créditos de IA). Isso mantém o loop, e o streak recompensa quem mantém consistência.

### 2.2 Streak de publicação semanal

**Mecânica:** Se o colaborador publica pelo menos **3 posts por semana** (seg-dom), em semanas consecutivas, acumula um streak com bônus exponencial (dobrando a cada semana). O ciclo dura **7 semanas** — ao completar, reseta e recomeça.

**Por que 3 posts/semana:** 1 post por semana é pouco — a pessoa mal está usando a plataforma. 3x/semana é a frequência padrão de estratégias LinkedIn B2B, é desafiador mas atingível, e cria um hábito real de uso (a pessoa entra dia sim, dia não, no mínimo).

**Tabela de bônus (exponencial com ciclo de 7 semanas):**

| Semana | Bônus ao completar | Acumulado no ciclo |
|--------|-------------------|-------------------|
| 1 | +10 pts | 10 |
| 2 | +20 pts | 30 |
| 3 | +40 pts | 70 |
| 4 | +80 pts | 150 |
| 5 | +160 pts | 310 |
| 6 | +320 pts | 630 |
| 7 | +640 pts (ciclo completo!) | **1.270** |
| **Reset** | Volta pra semana 1 | Novo ciclo |

**Total de um ciclo completo (7 semanas = ~1 mês e 3 semanas):** 1.270 pts de streak bônus.

**Por que ciclo de 7 com reset:**
- Exponencial puro sem cap criaria bônus absurdos (semana 10 = 5.120 pts)
- 7 semanas é ~1 mês e meio — um objetivo concreto e atingível
- O reset renova o jogo: a pessoa quer completar o ciclo de novo
- Completar o ciclo vira um mini-evento (celebração visual no dashboard)

**Implementação:**
- Campo no documento do usuário:
  ```typescript
  streak: {
    currentWeeks: number;        // Semanas consecutivas com 3+ posts (1-7, reseta após 7)
    lastCompletedWeek: string;   // Ex: "2026-W18"
    postsThisWeek: number;       // Contador de posts na semana atual
    currentWeekId: string;       // Semana ISO atual (para saber quando resetar contador)
    cyclesCompleted: number;     // Quantos ciclos de 7 semanas já completou (ACUMULADO, nao reseta — usado pra nivel)
    consecutiveCyclesCompleted: number; // Ciclos CONSECUTIVOS sem quebra (reseta a 0 ao quebrar — usado pra conquistas de constancia)
  }
  ```
- No momento da publicação:
  1. Calcular a semana ISO atual
  2. Se `currentWeekId` é diferente da semana atual → verificar se semana anterior foi completada:
     - Se `lastCompletedWeek` é a semana anterior → incrementar `currentWeeks`
     - Se não → resetar `currentWeeks = 0`
     - Resetar `postsThisWeek = 1`, atualizar `currentWeekId`
  3. Se `currentWeekId` é a mesma semana → incrementar `postsThisWeek`
  4. Se `postsThisWeek` atinge 3 nesta semana:
     - Marcar `lastCompletedWeek` como semana atual
     - Calcular bônus: `10 * (2 ^ (currentWeeks - 1))` → dá 10, 20, 40, 80, 160, 320, 640
     - Registrar em `pointsHistory` com `source: 'streak'`
     - Se `currentWeeks == 7`:
       - Incrementar `cyclesCompleted` (acumulado, pra nivel)
       - Incrementar `consecutiveCyclesCompleted` (pra conquistas de constancia)
       - Resetar `currentWeeks = 0`
       - Setar flag `pendingStreakCelebration = true` para exibir pop-up
       - Verificar conquistas de constancia: `consecutiveCyclesCompleted * 7` cruza threshold de conquista?
       - Verificar level up: `cyclesCompleted` cruza threshold de nivel?

**Regra de reset — IMPORTANTE:**

O streak e **rigorosamente consecutivo**. Se o colaborador falhar uma unica semana (publicar menos de 3 posts), o streak **reseta completamente para a semana 1**, independente de quantas semanas ele ja tinha acumulado.

Exemplo:
- Semana 1: 3 posts (check, ganha +10) → currentWeeks = 1
- Semana 2: 4 posts (check, ganha +20) → currentWeeks = 2
- Semana 3: 3 posts (check, ganha +40) → currentWeeks = 3
- Semana 4: 5 posts (check, ganha +80) → currentWeeks = 4
- **Semana 5: 2 posts (FALHOU)** → **currentWeeks = 0, consecutiveCyclesCompleted = 0** (perdeu tudo)
- Semana 6: 3 posts → currentWeeks = 1 (recomeca do zero, ganha +10)

Nao existe "continuar da semana 6" ou "pular uma semana". O streak e tudo ou nada — e essa e exatamente a tensao que torna ele viciante. A pessoa na semana 4 pensa: "Se eu mantiver mais 3 semanas, ganho 160+320+640 = 1.120 pts extras. Se eu parar, perco tudo e volto pro +10."

**Onde fica visível — Dashboard do colaborador:**

O streak aparece como card de destaque no dashboard pessoal com **dois níveis de acompanhamento visual**:

**Nível 1 — Progresso da semana atual (checkmarks dos dias):**

Mostra os dias da semana com checks verdes nos dias em que a pessoa publicou, e os +30 pts ganhos em cada post:

```
┌──────────────────────────────────────────────────────────┐
│  Semana 5 — Meta: 3 posts                                │
│                                                          │
│   Seg    Ter    Qua    Qui    Sex    Sab    Dom          │
│   [v]    [v]    [ ]    [ ]    [v]    [ ]    [ ]          │
│   +30    +30                  +30                        │
│                                                          │
│   3/3 posts — Semana completada! +160 pts de streak      │
└──────────────────────────────────────────────────────────┘
```

Quando a pessoa ainda nao completou a meta:
```
┌──────────────────────────────────────────────────────────┐
│  Semana 5 — Meta: 3 posts                                │
│                                                          │
│   Seg    Ter    Qua    Qui    Sex    Sab    Dom          │
│   [v]    [ ]    [v]    [ ]    [ ]    [ ]    [ ]          │
│   +30           +30                                      │
│                                                          │
│   2/3 posts — Falta 1 pra completar! Bonus: +160 pts     │
└──────────────────────────────────────────────────────────┘
```

**Nível 2 — Progresso do ciclo de 7 semanas:**

Abaixo dos dias, mostra as 7 semanas do ciclo com checks/vazios e bônus de cada semana:

```
┌──────────────────────────────────────────────────────────┐
│  Ciclo de streak                                         │
│                                                          │
│   S1    S2    S3    S4    S5    S6    S7                  │
│   [v]   [v]   [v]   [v]   [~]   [ ]   [ ]               │
│   +10   +20   +40   +80  +160  +320  +640                │
│                                                          │
│  5 semanas seguidas! Proximo bonus: +320 pts              │
└──────────────────────────────────────────────────────────┘
```

**Estados visuais dos dias da semana:**
- [v] Verde com check = dia em que publicou (mostra "+30" embaixo)
- [ ] Cinza vazio = dia sem publicacao (ainda pode publicar)
- Dias passados sem post ficam cinza claro (oportunidade perdida, mas sem peso negativo)

**Estados visuais das semanas do ciclo:**
- [v] Verde = semana completada (3+ posts publicados)
- [~] Amarelo/pulsante = semana atual em andamento
- [ ] Cinza = semana futura ainda nao atingida

**Visual apos reset (streak quebrou na semana 5, recomecou):**
```
┌──────────────────────────────────────────────────────────┐
│  Ciclo de streak                                         │
│                                                          │
│   S1    S2    S3    S4    S5    S6    S7                  │
│   [v]   [ ]   [ ]   [ ]   [ ]   [ ]   [ ]               │
│   +10   +20   +40   +80  +160  +320  +640                │
│                                                          │
│  1 semana seguida! Proximo bonus: +20 pts                │
└──────────────────────────────────────────────────────────┘
```

O card **nao mostra o historico do ciclo anterior** — ao resetar, as semanas voltam todas pro cinza. O ciclo anterior simplesmente sumiu. Isso reforça a aversao a perda: "Se eu quebrar, perco o progresso visual todo."

**Ao completar o ciclo de 7 semanas:**
- Modal de celebracao (ver secao 13.3)
- Mostra total de pontos bonus ganhos no ciclo (1.270 pts)
- Contador de ciclos completados incrementa
- Card reseta visualmente pro proximo ciclo

**Por que dois niveis visuais:**
- **Dias da semana** cria micro-motivacao diaria: "Postei segunda e quarta, se eu postar hoje (sexta) completo a meta da semana e ganho +160 pts de streak"
- **Semanas do ciclo** cria macro-motivacao de longo prazo: "Ja tenho 4 semanas, nao vou perder agora"
- Ver os "+30" ao lado de cada check diario reforça que cada post individual tem valor
- Cria dois gatilhos psicologicos simultaneos:
  - **Aversao a perda:** "Ja tenho 4 semanas com check, nao vou quebrar agora que faltam so 3"
  - **Progresso diario:** "Falta so 1 post pra completar essa semana e ganhar +160 pts"
- Na **pagina de ranking**, o streak aparece como mencao leve ao lado do nome (icone de chama + numero de semanas seguidas), mas sem ser uma secao inteira

**Por que faz sentido:** Streaks sao o mecanismo de retencao mais eficaz em gamificacao. A progressao exponencial faz as ultimas semanas valerem MUITO mais, criando uma tensao crescente. O reset a cada 7 semanas renova o jogo e evita inflacao. E os checkmarks diarios com "+30" criam um loop de feedback visual que torna cada publicacao satisfatoria.

### 2.3 Pontos por upload de Extract mensal (80 pts) — via missao automatica

**Mecanica:** O Extract mensal funciona como uma **missao automatica**. Todo mes, o sistema cria automaticamente uma missao "Enviar Extract de [mes]" que fica ativa quando o botao de upload esta liberado. Quando o colaborador faz o upload com sucesso, a missao e marcada como concluida automaticamente e os pontos sao creditados.

**Integracao Analytics → Missoes:**
- O modulo de Analytics (`/colaborador/analytics`) ja tem o botao de upload de Extract
- Quando o sistema detecta que um novo mes esta disponivel para upload, cria uma missao automatica:
  - Nome: "Enviar Extract de [mes/ano]"
  - Pontos: 80 pts
  - `completionMode: 'auto'`
  - `source: 'extract'`
  - `isSystemMission: true` (para diferenciar de missoes criadas pelo admin)
- A missao aparece em "Missoes Ativas" no dashboard, com link direto para `/colaborador/analytics`
- Ao clicar na missao, o colaborador e levado para a pagina de Analytics onde pode fazer o upload
- Quando `uploadLinkedInSnapshot()` retorna sucesso, o sistema marca a missao como concluida e credita os 80 pts

**Regras:**
- Apenas o **primeiro upload de cada mes** gera pontos (upload repetido nao gera nova missao)
- Uploads do tipo `'historical'` (backfill de meses antigos) **nao contam**
- A missao automatica expira ao final do mes seguinte (ex: missao de abril expira em 31 de maio)
- Controle: verificar se ja existe missao de extract para aquele `mesAno` antes de criar nova

**Implementacao:**
- Cron job mensal (ou check no login) cria a missao de extract no primeiro dia util do mes
- A missao e criada em `companies/{companyId}/missions` com flag `isSystemMission: true`
- No `uploadLinkedInSnapshot()`, apos salvar com sucesso:
  1. Verificar se `uploadType !== 'historical'`
  2. Buscar missao de extract ativa para o mes atual
  3. Se existe e nao esta concluida → marcar como concluida, creditar 80 pts em `pointsHistory` com `source: 'extract'`
  4. Se ja concluida → nao dar pontos novamente

**Por que 80 pontos (e nao 40):** O Extract e uma acao essencial pro admin — sem ele, nao ha visibilidade sobre as metricas do time. Exige esforco significativo (entrar no LinkedIn, baixar o arquivo, subir na plataforma) e acontece so 1x/mes. 80 pts coloca o Extract no mesmo peso de um modulo de trilha, reforcando que essa acao e valorizada. E sendo missao, aparece visualmente no dashboard como lembrete.

**Vantagens de ser missao:**
1. Aparece no dashboard como lembrete visual ("Enviar Extract de maio")
2. Link direto para a pagina de Analytics — sem fricao
3. O colaborador ve a missao e sabe exatamente o que fazer
4. Usa a infraestrutura de missoes que ja existe (completionMode auto, pointsHistory, toast)
5. Admin pode ver no painel quem ja enviou e quem nao

### 2.4 Conquistas com bônus automático

Ver seção 4 para detalhes completos.

---

## 3. Economia de Pontos Completa

### 3.1 Tabela de Pontuação por Ação

| Ação | Pontos | Categoria | Frequência esperada |
|------|--------|-----------|-------------------|
| Publicar no LinkedIn | 30 pts | Publicação | 3-5x/semana (ativo) |
| Streak semana 1 (3+ posts) | +10 pts | Streak | Semanal |
| Streak semana 2 | +20 pts | Streak | Semanal |
| Streak semana 3 | +40 pts | Streak | Semanal |
| Streak semana 4 | +80 pts | Streak | Semanal |
| Streak semana 5 | +160 pts | Streak | Semanal |
| Streak semana 6 | +320 pts | Streak | Semanal |
| Streak semana 7 (ciclo completo) | +640 pts | Streak | A cada ~7 semanas |
| *Total ciclo completo de streak* | *1.270 pts* | *Streak* | *~1 mês e meio* |
| Completar módulo Aula (vídeo) | 80 pts | Trilha | Esporádico |
| Completar módulo Leitura | 40 pts | Trilha | Esporádico |
| Completar Desafio (quiz 60-79%) | 80 pts | Trilha | Esporádico |
| Completar Desafio (quiz 80%+) | 110 pts | Trilha | Esporádico |
| Bônus conclusão de trilha | 30 pts (fixo) | Trilha | Ao concluir trilha |
| Completar missão | ~100 pts (varia) | Missão | Semanal |
| Upload de Extract mensal (missao automatica, 1o do mes) | 80 pts | Missao (auto) | Mensal (1x/mes max) |
| Conquista (qualquer categoria) | +50 pts cada | Conquista | Progressiva (ver secao 4) |

**Notas sobre pontuação de trilhas:**
- Quiz vale o mesmo que vídeo (80 pts) — ambos exigem atenção e dedicação
- Bônus de quiz com 80%+ acertou: apenas +30 pts extras (total 110 pts) — recompensa o acerto sem inflar
- Bônus de conclusão de trilha: valor fixo de 30 pts — simplifica e previne exploração
- Se alguém fizer 5 trilhas no mesmo dia, os pontos são legítimos mas limitados pela estrutura (sem bônus exponencial)

### 3.2 Contexto sobre trilhas e frequência por perfil

- Uma trilha comprida leva ~30 minutos
- Trilha típica tem 3-5 módulos
- **Colaborador muito ativo:** consome 2-3 trilhas por semana
- **Colaborador mediano:** consome ~1 trilha por semana
- **Colaborador casual:** consome ~1 trilha por mês (ou menos)

**Pontuação total de uma trilha típica (3-5 módulos):**
- Trilha com 2 vídeos + 1 quiz (60-79%): 80 + 80 + 80 + 30 (conclusão) = **270 pts**
- Trilha com 2 vídeos + 1 quiz (80%+): 80 + 80 + 110 + 30 (conclusão) = **300 pts**
- Trilha com 3 vídeos + 1 leitura + 1 quiz (80%+): 80 + 80 + 80 + 40 + 110 + 30 = **420 pts**

**Anti-exploração (5 trilhas/dia):** Mesmo um power user que faz 5 trilhas no mesmo dia ganha no máximo ~1.500 pts (5 × ~300). Isso é significativo mas não quebra a economia porque: (1) trilhas são finitas — a empresa tem um catálogo limitado, (2) cada trilha leva ~30 min de atenção real, (3) não há bônus multiplicador por volume diário. O sistema se auto-regula pelo conteúdo disponível.

### 3.3 Fórmula de recálculo

```
Pontos atuais = (Pontos de trilhas) + (Pontos de missões) + (Pontos de publicações) + (Pontos de extracts) + (Bônus de streaks) + (Bônus de conquistas) - (Pontos gastos em resgates)
```

A função `recalculatePoints()` precisa ser atualizada para incluir as novas fontes: `publicacao`, `extract`, `streak`, `conquista`.

---

## 4. Sistema de Conquistas Renovaveis

### 4.1 Conceito — Conquistas que se renovam

Em vez de conquistas fixos que se esgotam (1ª pub, 10ª pub, 30ª pub — e acabou), o sistema de conquistas e **renovavel por categoria**. Cada categoria tem uma escada de metas progressivas. Ao completar uma, a **proxima** aparece automaticamente como meta ativa. As conquistas completas viram **badges colecionaveis** no perfil do dashboard.

**Categorias de conquistas:**

| Categoria | Icone | Cor | Escada de metas |
|-----------|-------|-----|-----------------|
| Publicacoes | Documento (FileText) | Azul (#3B82F6) | 1ª, 10, 30, 50, 100 |
| Trilhas | Livro (BookOpen) | Verde (#10B981) | 1ª, 5, 10, 20, 30, 40 |
| Missoes | Raio (Zap) | Laranja (#F97316) | 1ª, 5, 10, 20 |
| Constancia | Gema de nivel (Diamond) | Cor do nivel | 7sem(Nv2), 14sem(Nv3), 28sem(Nv4), 49sem(Nv5), 70sem(Nv6), 98sem(Nv7), 140sem(Nv8) |

**Pontos por conquista:** 50 pts fixos para todas (simples, previsivel, sem inflacao).

**Regras:**
- Cada conquista e conquistada apenas uma vez
- Ao completar uma, a proxima da mesma categoria aparece automaticamente como meta ativa
- A pessoa sempre tem 1 conquista ativa por categoria (4 conquistas ativas simultaneas)
- Se a pessoa ja completou todas de uma categoria (ex: atingiu 100 publicacoes), aquela categoria nao aparece mais nas "proximas conquistas" — so nos badges
- Conquistas de constancia sao baseadas em semanas **consecutivas** (nao acumuladas) — se o streak quebra, o progresso da conquista de constancia reseta, mas as ja conquistadas permanecem como badges

**No dashboard, ha duas secoes:**
- **Conquistas em Andamento:** Mostra as 3 conquistas ativas (publicacoes, trilhas, missoes) com barra de progresso. Constancia NAO aparece aqui — seu progresso ja esta no card de Check-in Semanal. A pessoa esta sempre "perseguindo" algo
- **Conquistas:** Mostra todas as conquistas ja completas como badges visuais colecionaveis, organizados por categoria (incluindo constancia). Mesmo icone da categoria, com o numero/label da meta

### 4.2 Tabela completa de conquistas

**Publicacoes:**
| ID | Meta | Pontos | Condicao |
|----|------|--------|----------|
| `pub_1` | 1a publicacao | +50 pts | 1 post publicado |
| `pub_10` | 10 publicacoes | +50 pts | 10 posts publicados |
| `pub_30` | 30 publicacoes | +50 pts | 30 posts publicados |
| `pub_50` | 50 publicacoes | +50 pts | 50 posts publicados |
| `pub_100` | 100 publicacoes | +50 pts | 100 posts publicados |

**Trilhas:**
| ID | Meta | Pontos | Condicao |
|----|------|--------|----------|
| `trail_1` | 1a trilha | +50 pts | 1 trilha completa |
| `trail_5` | 5 trilhas | +50 pts | 5 trilhas completas |
| `trail_10` | 10 trilhas | +50 pts | 10 trilhas completas |
| `trail_20` | 20 trilhas | +50 pts | 20 trilhas completas |
| `trail_30` | 30 trilhas | +50 pts | 30 trilhas completas |
| `trail_40` | 40 trilhas | +50 pts | 40 trilhas completas |

**Missoes:**
| ID | Meta | Pontos | Condicao |
|----|------|--------|----------|
| `mission_1` | 1a missao | +50 pts | 1 missao aprovada |
| `mission_5` | 5 missoes | +50 pts | 5 missoes aprovadas |
| `mission_10` | 10 missoes | +50 pts | 10 missoes aprovadas |
| `mission_20` | 20 missoes | +50 pts | 20 missoes aprovadas |

**Constancia (alinhada aos niveis):**
| ID | Meta | Pontos | Condicao | Nivel desbloqueado |
|----|------|--------|----------|--------------------|
| `seq_7` | 7 semanas | +50 pts | 7 semanas consecutivas (1 ciclo) | Nivel 2 |
| `seq_14` | 14 semanas | +50 pts | 14 semanas consecutivas (2 ciclos) | Nivel 3 |
| `seq_28` | 28 semanas | +50 pts | 28 semanas consecutivas (4 ciclos) | Nivel 4 |
| `seq_49` | 49 semanas | +50 pts | 49 semanas consecutivas (7 ciclos) | Nivel 5 |
| `seq_70` | 70 semanas | +50 pts | 70 semanas consecutivas (10 ciclos) | Nivel 6 |
| `seq_98` | 98 semanas | +50 pts | 98 semanas consecutivas (14 ciclos) | Nivel 7 |
| `seq_140` | 140 semanas | +50 pts | 140 semanas consecutivas (20 ciclos) | Nivel 8 |

> **Conquistas de constancia = jornada de niveis:** Cada conquista de constancia corresponde exatamente a um level-up. Nao existem conquistas intermediarias (ex: 21sem ou 35sem foram removidas porque nao correspondem a mudanca de nivel). Isso cria uma jornada clara: 7 semanas > Nivel 2 > 14 semanas > Nivel 3 > 28 semanas > Nivel 4 > ... Os badges usam a gema SVG do nivel correspondente. O nivel e permanente (baseado em ciclos acumulados), mas a conquista de constancia premia sequencias consecutivas SEM quebrar.

### 4.3 Implementacao

**Armazenamento:**
```typescript
conquests: {
  completed: string[];  // IDs das conquistas completas: ["pub_1", "pub_10", "trail_1", "mission_1", "seq_7"]
  pending: {            // Flag por categoria para exibir pop-up
    [id: string]: boolean;
  }
}
```

**Funcao para determinar proxima conquista ativa por categoria:**
```typescript
const CONQUEST_LADDERS = {
  pub:     [1, 10, 30, 50, 100],
  trail:   [1, 5, 10, 20, 30, 40],
  mission: [1, 5, 10, 20],
  seq:     [7, 14, 28, 49, 70, 98, 140],  // alinhado aos thresholds de nivel (1, 2, 4, 7, 10, 14, 20 ciclos)
};

function getNextConquest(category: string, completed: string[]): number | null {
  const ladder = CONQUEST_LADDERS[category];
  for (const target of ladder) {
    if (!completed.includes(`${category}_${target}`)) return target;
  }
  return null; // todas completas nessa categoria
}
```

**Fluxo de verificacao:**
1. Apos cada acao (publicar, completar trilha/missao, incrementar streak):
2. Contar o total da categoria (ex: total de posts publicados)
3. Verificar se esse total cruza o threshold da proxima conquista ativa
4. Se sim: adicionar ao array `completed`, registrar em `pointsHistory` com `source: 'conquest'`, setar flag pending

**Pop-up de celebracao:**
- Modal com icone da categoria e animacao (ver secao 13)
- Titulo: "Conquista desbloqueada!"
- Nome: "30 publicacoes"
- Pontos: "+50 pts"
- Badge visual que vai pro perfil
- Botao: "Ver meus badges"

### 4.4 Integracao com onboarding

As primeiras conquistas de cada categoria (1a publicacao, 1a trilha, 1a missao) devem aparecer no checklist de onboarding como metas a atingir. A pessoa ja entra sabendo que tem badges pra colecionar. Ver secao 10.

---

## 5. Página de Ranking e Conquistas

### 5.1 Proposta: Página `/colaborador/rankings` reformulada

Em vez do widget simples no dashboard, criar uma página dedicada com seções:

#### Seção 1: Top 10 por Pontos
- Pódio visual (top 3 com destaque)
- Lista completa com posição, avatar, nome, pontos
- Prêmio mensal exibido como incentivo
- Posição do colaborador atual destacada

#### Seção 2: Quem Mais Publicou no Mês
- Ranking separado por quantidade de posts publicados no mês atual
- Top 5 com contagem de posts
- Incentiva consistência de publicação independente de pontos

#### Seção 3: Conquistas do Mês
- Lista de conquistas conquistados por colaboradores naquele mês
- Formato: "[Nome] conquistou [Conquista]" com data
- Botão "Parabenizar" que envia uma notificação interna ao colaborador
- Cria senso de comunidade e reconhecimento social

#### Seção 4: Meus Conquistas
- Grid ou lista dos conquistas do próprio colaborador
- Conquistas conquistados em destaque (coloridos)
- Conquistas ainda não conquistados em cinza com progresso (ex: "3/10 publicações")
- Funciona como motivador visual

### 5.2 Mecânica de "Parabenizar"

- Simples: um clique gera uma notificação interna (não precisa ser chat)
- Formato: "[Nome] parabenizou você por [Conquista]!"
- Aparece como toast/badge na próxima vez que o colaborador abre a plataforma
- Armazenamento leve: subcoleção `congratulations` ou campo simples no user doc
- Sem complexidade — não é rede social, é só reconhecimento pontual

---

## 6. Recompensas: Nativas Boldfy vs Sugestões para Admin

### 6.1 Recompensas Nativas (gerenciadas pela Boldfy)

São recompensas que **já vêm na loja** de todo novo cliente. A Boldfy é responsável por entregar. O admin pode desativar se quiser, mas a intenção é que sejam default.

| Recompensa | Custo | Tipo | Entrega |
|------------|-------|------|---------|
| +10 créditos de IA | 100 pts | `ai_credits` | Instantâneo — sistema incrementa `bonusCredits` |
| +25 créditos de IA | 200 pts | `ai_credits` | Instantâneo |
| +50 créditos de IA | 350 pts | `ai_credits` | Instantâneo |

**Implementação:**
- No setup/seed da empresa, criar essas 3 recompensas automaticamente
- Marcar como `isNative: true` no documento da recompensa
- Admin pode ativar/desativar, mas não deletar
- Estoque: `'Ilimitado'` (não consome estoque real)

**Loop de gamificação criado:**
```
Colaborador publica (30 pts)
→ Com 4 posts já tem 120 pts
→ Resgata +10 créditos de IA
→ Usa créditos pra criar mais conteúdo
→ Publica mais
→ Ganha mais pontos
→ Ciclo viciante (loop de retencao)
```

### 6.2 Sugestões de Recompensas (templates para admin)

São orientações que o admin vê quando vai configurar novas recompensas. Aparecem como popup/modal acessível por um botão "Ver sugestões de recompensas" na área de recompensas do admin.

**Formato do popup:**
- Título: "Sugestões de recompensas para sua equipe"
- Subtítulo: "Baseadas no que funciona melhor em programas de engajamento corporativo"
- Lista de sugestões com: nome, faixa de preço em pontos, valor estimado em R$, onde comprar, como entregar
- Botão "Criar esta recompensa" que pré-preenche o formulário

---

## 7. Cardápio de Sugestões de Recompensas

### 7.1 Micro-recompensas (fáceis de resgatar, alta frequência)

| Sugestão | Pontos recomendados | Valor real | Onde comprar | Entrega |
|----------|-------------------|------------|-------------|---------|
| Cupom iFood R$25 | 500 pts | R$25 | [Card Store](https://www.cardstore.com.br/) ou [Amazon BR](https://www.amazon.com.br) | Código digital via plataforma |
| Cupom iFood R$50 | 900 pts | R$50 | Idem | Código digital |
| Assinatura Spotify 1 mês | 350 pts | ~R$22 | [Card Store](https://www.cardstore.com.br/cartao-presente-gift-card-spotify-1-mes) | Código digital |
| Assinatura Spotify 3 meses | 900 pts | ~R$65 | [Card Store](https://www.cardstore.com.br/cartao-presente-gift-card-spotify-3-meses) | Código digital |
| Vale Netflix R$35 | 700 pts | R$35 | [Gift Card Online](https://www.giftcardonline.com.br/) / [Full Cards](https://www.fullcards.com.br/) | Código digital |
| Ingresso cinema R$35 | 700 pts | ~R$35 | [Ingresso.com](https://www.ingresso.com/) | Código digital |

### 7.2 Recompensas médias (engajamento consistente)

| Sugestão | Pontos recomendados | Valor real | Onde comprar | Entrega |
|----------|-------------------|------------|-------------|---------|
| Vale Amazon R$50 | 1.000 pts | R$50 | [Amazon BR](https://www.amazon.com.br) | Código digital |
| Vale Amazon R$100 | 1.800 pts | R$100 | Amazon BR | Código digital |
| Vale Renner R$100 | 1.800 pts | R$100 | [Card Store](https://www.cardstore.com.br/) / [Carpe Diem XP](https://www.carpediemxp.com/) | Código digital |
| Vale Hering R$100 | 1.800 pts | R$100 | [Hering Gift Card](https://cartaopresente.hering.com.br/) / [Carpe Diem XP](https://www.carpediemxp.com/cartao-presente/hering) | Código digital |
| Kit/brinde da empresa | 1.500 pts | Variável | Interno | Admin entrega |
| Crédito cartão de benefícios R$50 | 1.000 pts | R$50 | Via [Pluxee](https://www.pluxee.com.br/produtos/pluxee-gift-vale-presente-natal/) / Caju / Flash | Crédito no cartão |

### 7.3 Recompensas aspiracionais (longo prazo, alto valor)

| Sugestão | Pontos recomendados | Valor real | Onde comprar | Entrega |
|----------|-------------------|------------|-------------|---------|
| Crédito cartão de benefícios R$200 | 3.500 pts | R$200 | Via Pluxee / Caju / Flash | Crédito no cartão |
| Curso ou certificação online | 5.000 pts | ~R$300-500 | Udemy, Coursera, Alura | Admin compra e envia |
| Day off | 10.000 pts | ~R$300 (dia útil) | Interno (RH) | Admin aprova |
| Experiência (jantar, spa, etc.) | 7.000 pts | ~R$200-400 | [Carpe Diem XP](https://www.carpediemxp.com/) | Voucher digital |
| Viagem (passagem Buser) | 4.000 pts | ~R$80-200 | [Buser Gift Card](https://blog.buser.com.br/) via PicPay/Flash Pay | Código digital |

### 7.4 Lógica de precificação

**Regra geral:** ~R$1 de valor real ≈ 18-20 pontos

Isso significa:
- 1 post = 30 pts ≈ R$1,50-1,70 em valor de recompensa (mas streak multiplica)
- Colaborador muito ativo (20 posts/mês + 10 trilhas + missões + streak ≈ 4.470 pts/mês) → ~R$220-250/mês em valor potencial de resgate
- Colaborador mediano (~1.680 pts/mês) → ~R$84-93/mês em valor potencial
- Day off (R$300 ref.) = 10.000 pts → ~2.2 meses de power user, ~6 meses de mediano

**Nota importante sobre legislação:**
- Evitar bônus em dinheiro/salário — pode compor remuneração e gerar encargos trabalhistas
- Preferir sempre cartão de benefícios (Pluxee, Caju, Flash) ou gift cards — não compõem salário
- Day off depende de política interna do RH — sugerir que o admin valide com jurídico
- Gift cards e experiências são incentivos sem risco trabalhista

---

## 8. Marcas Brasileiras com Gift Cards Disponíveis

### 8.1 Catálogo de marcas confirmadas

As marcas abaixo possuem gift cards digitais disponíveis para compra no Brasil em 2026:

#### Alimentação e Delivery
| Marca | Valores disponíveis | Validade | Onde comprar |
|-------|-------------------|----------|-------------|
| iFood | R$20 a R$200 | 3 meses p/ ativar + 3 meses p/ usar | Card Store, Amazon BR, GIFQ |
| Uber Eats | R$25 a R$100 | 12 meses | Card Store, GCM Games |

#### Streaming e Entretenimento
| Marca | Valores disponíveis | Validade | Onde comprar |
|-------|-------------------|----------|-------------|
| Spotify | 1, 3 ou 6 meses | 12 meses após compra | Card Store, GCM Games, Colombo |
| Netflix | R$35 a R$500 | Sem vencimento | Full Cards, Gift Card Online, Amazon BR |
| YouTube Premium | R$25 a R$100 | 12 meses | Card Store |
| Xbox Game Pass | Vários | 12 meses | Kabum, Card Store |

#### Varejo e Moda
| Marca | Valores disponíveis | Validade | Onde comprar |
|-------|-------------------|----------|-------------|
| Amazon BR | R$20 a R$2.000 | Sem vencimento | Amazon.com.br |
| Renner | R$50 a R$300 | 12 meses | Card Store, Carpe Diem XP |
| Hering | R$50, R$75, R$100 | 12 meses | Hering.com.br, Carpe Diem XP, Bitrefill |
| Americanas | Vários | 12 meses | Carpe Diem XP |
| Shopee | Vários | 12 meses | Card Store |

#### Benefícios Corporativos (cartão multiuso)
| Plataforma | Como funciona | Vantagem |
|-----------|--------------|----------|
| Pluxee Gift (ex-Sodexo) | Cartão pré-pago aceito em 850mil+ lojas | Flexibilidade total pro colaborador |
| Caju | Cartão multibenefício | Já usado por muitas empresas como VA/VR |
| Flash | Cartão flexível | Integra alimentação, cultura, mobilidade |
| Smash Gifts | Vale presente multi-marca | Colaborador escolhe a marca na hora |

#### Viagem e Mobilidade
| Marca | Valores disponíveis | Validade | Onde comprar |
|-------|-------------------|----------|-------------|
| Uber | R$25 a R$200 | 12 meses | Card Store, BB App |
| 99 | Variável | 12 meses | PicPay, parceiros |
| Buser | Variável | Depende do emissor | PicPay, Flash Pay, Santander Esfera |
| Azul Voucher | Variável | 12 meses | VoeAzul.com.br |

### 8.2 Plataformas agregadoras recomendadas para o admin

Para compras em lote e gestão simplificada:

1. **[Carpe Diem XP](https://www.carpediemxp.com/)** — Plataforma brasileira com 180+ marcas, foco corporativo, API disponível, vouchers 100% digitais e personalizáveis
2. **[Card Store](https://www.cardstore.com.br/)** — Especializada em gift cards digitais, entrega em minutos via PIX, amplo catálogo
3. **[Todo Vendas Corporativas](https://vendacorporativa.todoincomm.com.br/)** — Foco em vendas corporativas de cartões presente
4. **[Smash Gifts](https://www.smash.gifts/)** — Vale presente corporativo onde o colaborador escolhe a marca
5. **[GIFQ](https://www.gifq.com/)** — API internacional com suporte a marcas brasileiras (iFood confirmado), sem taxa de plataforma

### 8.3 Dado relevante para o admin

> **83% dos colaboradores preferem vale-presente a outros tipos de incentivos não monetários** (pesquisa Fiserv/Gift Card Gauge). O gift card dá liberdade de escolha, o que é o fator #1 de satisfação com programas de recompensa.

---

## 9. Sistema de Banco de Códigos (Entrega de Cupons)

### 9.1 Visão Geral

Para recompensas baseadas em gift cards/cupons, o admin cadastra os códigos na plataforma. Quando o colaborador resgata, recebe o próximo código disponível automaticamente.

### 9.2 Fluxo Completo

```
┌─────────────────────────────────────────────────────────────┐
│                    FLUXO DE CUPONS                          │
│                                                             │
│  ADMIN                                                      │
│  1. Compra gift cards em lote (Card Store, Amazon, etc.)    │
│  2. Cria recompensa na Boldfy (nome, pontos, imagem)        │
│  3. Cadastra códigos no campo "Gerenciar Códigos"           │
│     → IFOOD-ABC123                                          │
│     → IFOOD-DEF456                                          │
│     → IFOOD-GHI789                                          │
│  4. Recompensa fica disponível na loja                      │
│                                                             │
│  COLABORADOR                                                │
│  5. Acessa loja → vê recompensa disponível                  │
│  6. Clica "Resgatar" → confirma                             │
│  7. Sistema:                                                │
│     → Deduz pontos do colaborador                           │
│     → Pega próximo código não-usado                         │
│     → Marca código como usado (userId, data)                │
│     → Mostra código na tela ao colaborador                  │
│     → Envia email ao colaborador com o código               │
│     → Notifica admin do resgate                             │
│                                                             │
│  ALERTAS AUTOMÁTICOS                                        │
│  8. Quando restam ≤2 códigos:                               │
│     → Email pro admin: "Recompensa X tem poucos             │
│        códigos. Hora de comprar mais e cadastrar."          │
│  9. Quando 0 códigos restantes:                             │
│     → Recompensa fica automaticamente indisponível          │
│     → Admin adiciona mais códigos → volta a ficar ativa     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 9.3 Modelo de Dados

#### Recompensa com códigos (`companies/{companyId}/rewards/{rewardId}`)

```typescript
interface Reward {
  name: string;
  points: number;
  imageUrl?: string;
  stock?: number | 'Ilimitado';
  status: 'Disponível' | 'Desativada';

  // Campos existentes (créditos IA)
  type?: 'ai_credits' | 'physical' | 'voucher_code';
  creditsAmount?: number;

  // NOVOS campos para banco de códigos
  isNative?: boolean;              // true = recompensa nativa Boldfy (não deletável)
  deliveryMethod?: 'manual' | 'code' | 'instant';  // como o resgate é entregue
}
```

#### Códigos de voucher (`companies/{companyId}/rewards/{rewardId}/codes/{codeId}`)

```typescript
interface VoucherCode {
  code: string;                    // O código em si (ex: "IFOOD-ABC123")
  status: 'available' | 'used';
  addedAt: Timestamp;             // Quando o admin adicionou
  usedAt?: Timestamp;             // Quando foi resgatado
  usedBy?: string;                // userId de quem resgatou
  usedByName?: string;            // Nome do colaborador
}
```

### 9.4 Segurança

**CRÍTICO:** Os códigos são valores monetários e devem ser tratados com segurança máxima.

- ❌ Códigos NUNCA são expostos em queries do frontend (não fazer query de todos os códigos)
- ❌ Códigos NUNCA trafegam em lote para o cliente
- ✅ O resgate é uma **server action** que:
  1. Valida autenticação e autorização
  2. Busca o próximo código com `status: 'available'` (server-side)
  3. Usa **batch/transaction** para atomicamente marcar como usado e deduzir pontos
  4. Retorna apenas o código resgatado ao colaborador
- ✅ Firestore Security Rules devem impedir leitura direta da subcoleção `codes` por colaboradores
- ✅ Admin só vê códigos pela UI de gerenciamento (com paginação, sem expor todos de vez)

### 9.5 UI do Admin — Gerenciar Códigos

No formulário de edição da recompensa, adicionar seção:

```
┌─────────────────────────────────────────────────┐
│  Gerenciar Códigos                              │
│                                                 │
│  Códigos disponíveis: 7  |  Códigos usados: 13  │
│                                                 │
│  Adicionar novos códigos:                       │
│  ┌─────────────────────────────────────────┐    │
│  │ Cole os códigos aqui, um por linha:     │    │
│  │ IFOOD-XYZ001                            │    │
│  │ IFOOD-XYZ002                            │    │
│  │ IFOOD-XYZ003                            │    │
│  └─────────────────────────────────────────┘    │
│  [Adicionar códigos]                            │
│                                                 │
│  ⚠️ 7 códigos restantes                         │
│                                                 │
│  Histórico de uso:                              │
│  • IFOOD-***123 → João Silva — 02/05/2026       │
│  • IFOOD-***456 → Maria Santos — 01/05/2026     │
│  (códigos parcialmente mascarados por segurança) │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 9.6 Email de alerta de estoque baixo

**Trigger:** Quando `códigos disponíveis <= 2` após um resgate.

**Conteúdo do email:**
- Assunto: "⚠️ Recompensa [nome] com poucos códigos"
- Corpo: "A recompensa [nome] tem apenas [X] código(s) disponível(is). Quando acabarem, ela ficará indisponível automaticamente. Acesse a plataforma para adicionar mais códigos."
- CTA: Link direto para a página de gerenciar a recompensa

---

## 10. Integração com Onboarding

### 10.1 Checklist de Onboarding Atualizado

O checklist de onboarding do colaborador deve incluir os conquistas iniciais como metas visíveis:

```
Seu progresso inicial:
☐ Conectar seu LinkedIn                    (requisito)
☐ Fazer sua primeira publicação             → +30 pts + Conquista "Primeira Publicação" (+50 pts)
☐ Completar sua primeira trilha             → pontos da trilha + Conquista "Primeira Trilha" (+50 pts)
☐ Completar 5 missões                       → pontos das missões + Conquista "5 Missões" (+50 pts)
```

Isso mostra pro colaborador desde o dia 1 que:
1. Existe um sistema de pontos
2. Existem marcos de conquista
3. Há recompensas esperando (créditos de IA já na loja)

### 10.2 Primeira experiência do colaborador novo

```
Dia 1: Entra na plataforma → vê checklist de onboarding com conquistas
       → vê loja com créditos de IA disponíveis (nativo Boldfy)
       → entende que com 2 posts já pode resgatar algo

Dia 2-3: Faz primeira publicação → 30 pts + pop-up de conquista (+30 pts)
         → "Você já tem 60 pts! Faltam só 40 pts pra resgatar +10 créditos de IA"

Semana 1: Publica mais 2x → 120+ pts → resgata créditos de IA
          → Usa créditos pra criar conteúdo → publica → ganha mais pontos
          → Loop estabelecido ✅
```

---

## 11. Simulação de Cenários

### 11.1 Colaborador muito ativo (power user)

**Perfil:** Publica ~5x/semana (20x/mês), faz 2-3 trilhas/semana (~10/mês), 3 missões/mês, mantém streak completo

| Fonte | Cálculo | Pts/mês |
|-------|---------|---------|
| Publicações | 20 × 30 | 600 |
| Streak (4 sem no mês, exponencial) | Sem 1-4 do ciclo: 10+20+40+80 = 150 OU sem 4-7: 80+160+320+640 = 1.200 → **média ~540/mês** | ~540 |
| Trilhas (10/mês × ~300 pts média) | 10 × 300 | 3.000 |
| Missões | 3 × 100 | 300 |
| Extract mensal (missao auto) | 1 × 80 | 80 |
| Conquistas (média diluída) | ~30/mês nos primeiros meses | ~30 |
| **Total** | | **~4.550 pts/mês** |

**Detalhamento das publicações (30 pts/post + streak):**
- 20 posts × 30 pts = 600 pts base de publicações
- Streak completo no ciclo = 1.270 pts extras (~540/mês em média)
- Total publicação + streak = ~1.140 pts/mês — o streak praticamente dobra o valor das publicações

**Detalhamento das trilhas (novos valores):**
- Trilha típica: 2 vídeos (80+80) + 1 quiz 80%+ (110) + conclusão (30) = 300 pts
- 10 trilhas/mês × 300 pts = 3.000 pts/mês de trilhas
- Nota: limitado pelo catálogo da empresa — não há trilhas infinitas

**Detalhamento do streak ao longo de um ciclo completo (7 semanas):**
- Semanas 1-4 (mês 1): 10+20+40+80 = 150 pts de streak
- Semanas 5-7 (início mês 2): 160+320+640 = 1.120 pts de streak
- Total ciclo: 1.270 pts em ~7 semanas → média ~725 pts/mês

**O que consegue resgatar por mês:**
- Muitos créditos de IA + 1-2 resgates de gift cards grandes
- OU 1 Amazon R$100 (1.800 pts) + 1 iFood R$50 (900 pts) + créditos IA + sobra
- Day off em ~2.2 meses
- O pico acontece no mês em que completa as semanas 5-7 do ciclo: bônus massivos

**Nota sobre anti-exploração:** O power user ganha bastante com trilhas, mas isso é intencional — ele está realmente aprendendo 2-3 trilhas por semana (~1-1.5h de conteúdo). O catálogo finito da empresa é o limitador natural.

### 11.2 Colaborador mediano

**Perfil:** Publica ~3x/semana (12x/mês), faz 1 trilha/semana (~4/mês), 1 missão/mês, mantém streak instável (chega na sem 3-4 e quebra)

| Fonte | Cálculo | Pts/mês |
|-------|---------|---------|
| Publicações | 12 × 30 | 360 |
| Streak (chega ~sem 3-4, quebra, reinicia) | ~2 mini-ciclos: (10+20+40) × 2 = 140 | ~140 |
| Trilhas (4/mês × ~300 pts) | 4 × 300 | 1.200 |
| Missões | 1 × 100 | 100 |
| Extract mensal (missao auto) | 1 × 80 | 80 |
| **Total** | | **~1.880 pts/mês** |

**O que consegue resgatar por mês:**
- 2x créditos IA (200 pts) + 1 iFood R$25 (500 pts) + sobra pra próximo mês
- OU 1 Amazon R$50 (1.000 pts) + créditos IA
- Day off em ~5.5 meses

**Nota sobre streak:** O mediano tipicamente chega na semana 3 ou 4 e perde uma semana. Mas o exponencial cria um incentivo forte: "Se eu mantiver mais 1 semana, o bônus DOBRA." Isso empurra ele a ser mais consistente com o tempo. E mesmo quebrando, os mini-ciclos ainda dão pontos significativos.

**Nota sobre os checkmarks diários:** O mediano que posta 3x/semana vê seus 3 checks verdes com "+30" ao lado de cada um. Isso reforça que cada post tem valor, e quando ele vê "3/3 — Semana completada! +40 pts de streak", sente a recompensa da consistência.

### 11.3 Colaborador casual

**Perfil:** Publica ~1-2x/semana (5x/mês), faz ~1 trilha/mês, não faz missões, raramente atinge 3/semana

| Fonte | Cálculo | Pts/mês |
|-------|---------|---------|
| Publicações | 5 × 30 | 150 |
| Streak | Atinge 3/sem esporadicamente (~1x/mês) | ~10 |
| Trilhas (1/mês × ~300 pts) | 1 × 300 | 300 |
| Extract mensal (missao auto) | 1 × 80 | 80 |
| **Total** | | **~540 pts/mês** |

**O que consegue resgatar:**
- 1x crédito IA (+10) a cada ~10 dias → melhora acesso à IA
- OU 1x crédito IA (+25) a cada ~2.5 semanas
- 1 Spotify 1 mês (350 pts) por mês se juntar um pouquinho
- Day off em ~1.8 anos (não é pra ele — e tá ok)

**Nota:** O casual consegue resgatar créditos de IA com frequência razoável. A trilha mensal é o que mais contribui (300 pts = 65% da pontuação dele). Quando ele vê o card de streak com "Esta semana: 2/3 — Falta 1 pra completar! Bônus: +10 pts", pode ser o empurrão pra ele publicar "só mais um" — e os checks dos dias com "+30" reforçam que vale a pena. Esse é o caminho pra ele virar mediano.

### 11.4 Validação da economia

| Verificação | Resultado | Status |
|-------------|-----------|--------|
| Colaborador casual consegue resgatar algo? | Sim, créditos IA a cada ~10 dias, Spotify mensal se acumular | ✅ |
| Colaborador mediano sente progressão? | Sim, ~2 resgates reais/mês | ✅ |
| Power user é bem recompensado? | Sim, ~R$220-250/mês em valor potencial | ✅ |
| Day off é aspiracional, não trivial? | Sim, 2.2-5.5 meses dependendo do perfil | ✅ |
| Streak exponencial incentiva consistência? | Sim, dobrar o bônus cria tensão crescente | ✅ |
| Ciclo de 7 semanas evita inflação? | Sim, máx 1.270 pts/ciclo (~7 semanas) | ✅ |
| Mediano é incentivado a manter streak? | Sim, "só mais 1 semana" = dobrar o bônus | ✅ |
| Ratio pts/R$ continua sustentável? | ~R$1 = 18-20 pts → OK | ✅ |
| Micro-resgate rápido existe? | Sim, ~4 posts = 1 resgate de créditos IA (120 pts → 100 pts resgate) | ✅ |
| 5 trilhas/dia quebra o sistema? | Não — catálogo finito + sem multiplicador + tempo real investido | ✅ |
| Trilhas dominam a economia? | Sim pro ativo, mas trilhas = aprendizado real = valor pro admin | ✅ |
| 30 pts/post é suficiente pra motivar? | Sim — checkmarks diários com "+30" dão feedback visual + streak recompensa consistência | ✅ |

---

## 12. Resumo Técnico de Implementação

### 12.1 Mudanças no Backend

| Mudança | Arquivo(s) principal(is) | Complexidade |
|---------|------------------------|-------------|
| Pontos por publicação LinkedIn | `publishToLinkedIn()` ou action de publicação + `points.ts` | Baixa |
| Novo source no pointsHistory: `'publicacao'`, `'extract'` | `points.ts` | Muito baixa |
| Pontos por upload de Extract mensal | `linkedin-analytics.ts` + `points.ts` | Baixa |
| Streak de publicação semanal (3 posts/sem) | Campo `streak` no user doc + lógica na publicação (4 campos: currentWeeks, lastCompletedWeek, postsThisWeek, currentWeekId) | Baixa-Média |
| Sistema de conquistas | Campo `conquests: { completed, pending }` no user doc + checks em ações (ver secao 4.3) | Baixa |
| Novo source no pointsHistory: `'conquest'`, `'streak'` | `points.ts` | Muito baixa |
| Atualizar `recalculatePoints()` com novas fontes | `points.ts` | Baixa |
| Recompensas nativas no seed da empresa | `companies.ts` ou setup action | Baixa |
| Campo `isNative` em rewards | Schema/tipo de Reward | Muito baixa |
| Banco de códigos (subcoleção codes) | `rewards.ts` + nova subcoleção | Média |
| Server action para resgate com código | `rewards.ts` | Média |
| Email de alerta de estoque baixo | Notification service | Baixa |
| Mecânica de parabenizar | Nova action simples | Baixa |
| Sistema de 8 niveis com gemas (derivado de cyclesCompleted) | `points.ts` ou action dedicada | Muito baixa |
| ~~Bonus de streak por nivel~~ REMOVIDO — nivel e puramente visual | — | — |
| Level up check ao completar ciclo | Logica de streak | Baixa |

### 12.2 Mudanças no Frontend

| Mudança | Arquivo(s)/Página(s) | Complexidade |
|---------|---------------------|-------------|
| Pop-up de celebração de conquista | Componente global (layout) | Baixa |
| Pop-up de level up | Componente global (layout) | Baixa |
| Página de ranking reformulada | `/colaborador/rankings` | Média |
| Seção "Meus Conquistas" na página de ranking | Componente novo | Média |
| Botão "Parabenizar" nos conquistas | Componente na página de ranking | Baixa |
| Exibir créditos IA no formulário de reward (admin) | `/admin/recompensas` | Muito baixa |
| Popup de sugestões de recompensas (admin) | `/admin/recompensas` | Baixa |
| UI de gerenciar códigos (admin) | Componente no admin/recompensas | Média |
| Atualizar onboarding checklist | Componente de onboarding | Baixa |
| Card de streak no dashboard (progresso semanal 0/3 + semanas consecutivas + bônus + indicador de nivel) | Dashboard do colaborador | Baixa-Média |
| Card "Meu Perfil Gamificado" (substitui ranking no dashboard) | Dashboard do colaborador | Média |
| Gema de nivel no avatar (SVG diamante + borda colorida) | Componente de avatar global | Baixa |
| Indicador de streak no ranking (icone + semanas ao lado do nome) | Página de ranking | Muito baixa |
| Toast de código resgatado (colaborador) | Componente na loja | Baixa |

### 12.3 Mudanças em Security Rules

| Regra | Descrição |
|-------|-----------|
| `codes` subcoleção | Colaborador NÃO pode ler diretamente. Apenas server actions acessam. |
| `rewards.isNative` | Colaborador pode ler. Não pode escrever. Admin não pode deletar se `isNative: true`. |

### 12.4 Ordem sugerida de implementação

1. **Sprint 1:** Pontos por publicação + Recompensas nativas (créditos IA no seed + UI admin)
2. **Sprint 2:** Conquistas + Pop-up de celebração + Integração com onboarding
3. **Sprint 3:** Streak semanal + Sistema de niveis + Dashboard gamificado (substituir ranking por perfil pessoal)
4. **Sprint 4:** Banco de códigos + Sugestões de recompensas + Alertas de estoque
5. **Sprint 5:** Pop-up de level up + Pagina de ranking separada (opcional) + Mecânica de parabenizar + Polimento geral

---

## 13. Pop-ups e Notificacoes — Hierarquia Completa

> **Diretriz visual:** Todas as ilustracoes seguem a identidade Boldfy — sem emojis, sempre icones SVG na paleta da marca (primary #CD50F1, gold #F59E0B, green #10B981). Cards brancos com border-radius 14-24px, sombras roxas sutis, tipografia Nunito Sans 900 para titulos. Animacoes em loop CSS puro, mesmo estilo das ilustracoes de onboarding existentes.

### 13.0 Hierarquia de notificacoes — Principio geral

Toda pontuacao gera feedback visual. A diferenca esta no **peso** da notificacao:

| Nivel | Formato | Quando usar | Duracao | Bloqueia tela? |
|-------|---------|-------------|---------|----------------|
| **Toast minimo** | Snackbar pequeno, canto inferior/superior | TODA acao que gera pontos (publicacao, modulo de trilha, quiz, conclusao trilha, missao, streak semanal, parabenizacao, resgate de creditos IA) | 3-5 segundos | Nao — aparece e some sozinho |
| **Modal de celebracao** | Modal centralizado com overlay + ilustracao animada | Apenas conquistas (5) e ciclo de streak completo (1) — momentos realmente especiais | Ate o usuario fechar | Sim — exige interacao |
| **Modal funcional** | Modal com informacao + acao | Resgate de recompensa (precisa mostrar codigo/confirmacao) | Ate o usuario fechar | Sim — exige interacao |

**Regra de ouro:** Se a pessoa ta ganhando pontos, ela SEMPRE ve algo — nem que seja um toast de 3 segundos. Isso cria o loop de feedback constante. Modais sao reservados pra momentos que merecem pausa e celebracao.

### 13.1 Toast Universal de Pontuacao

**Toda acao que gera pontos exibe um toast minimo.** Este e o componente mais frequente do sistema.

**Design do toast:**
```
┌──────────────────────────────────────┐
│  [icone SVG] +30 pts — Publicacao    │
│              no LinkedIn             │
└──────────────────────────────────────┘
```

**Especificacoes tecnicas:**
- Posicao: canto inferior direito (ou superior, dependendo do layout)
- Largura: max 320px
- Background: branco com borda sutil `border: 1px solid #E5E7EB`
- Sombra: `0 4px 12px rgba(205, 80, 241, 0.08)` (sombra roxa sutil Boldfy)
- Border-radius: 12px
- Icone SVG a esquerda (24x24px), colorido pela categoria:
  - Publicacao: primary #CD50F1
  - Trilha (video/quiz/leitura/conclusao): green #10B981
  - Missao: primary #CD50F1
  - Streak semanal: gold #F59E0B
- Texto: Inter 14px semibold para pontos, Inter 13px regular para descricao
- Animacao entrada: slide-in da direita + fade (200ms ease-out)
- Animacao saida: fade-out (300ms) apos 3-5 segundos
- Empilhamento: se multiplos toasts, empilham com gap 8px (max 3 visiveis)

**Todos os triggers do toast:**

| Acao | Texto do toast | Icone |
|------|---------------|-------|
| Publicar no LinkedIn | "+30 pts — Publicacao no LinkedIn" | Icone de post/documento (primary) |
| Completar modulo video | "+80 pts — Modulo de video concluido" | Icone de play (green) |
| Completar modulo leitura | "+40 pts — Leitura concluida" | Icone de livro (green) |
| Completar quiz 60-79% | "+80 pts — Quiz concluido" | Icone de check (green) |
| Completar quiz 80%+ | "+110 pts — Quiz concluido com destaque" | Icone de check com estrela (green) |
| Concluir trilha | "+30 pts — Trilha concluida" | Icone de chapeu/graduacao (green) |
| Completar missao | "+[N] pts — Missao concluida" | Icone de alvo (primary) |
| Upload de Extract mensal | "+40 pts — Extract enviado" | Icone de grafico/chart (green) |
| Streak semana completada | "+[N] pts — Semana [X] do streak" | Icone de chama (gold) |
| Resgate creditos IA | "+[N] creditos de IA adicionados" | Icone de sparkle (primary) |
| Parabenizacao recebida | "[Nome] parabenizou voce por [Conquista]" | Icone de palmas (primary) |

### 13.2 Modais de Conquista (5 modais — momentos especiais)

Cada conquista tem seu proprio modal. Todos seguem a mesma estrutura base:
- Modal centralizado com overlay escuro sutil (background rgba(0,0,0,0.4))
- Ilustracao animada no topo (area ~240x200px)
- Titulo: "Voce conquistou [nome do conquista]!"
- Subtitulo com pontos ganhos: "+30 pts adicionados ao seu saldo"
- Botao primario: "Ver meus conquistas"
- Botao secundario (ghost): "Fechar"

**Importante:** O toast de pontuacao tambem aparece junto (ex: "+30 pts — Conquista"), mas o modal e o que chama atencao. O toast some sozinho, o modal fica.

| # | Pop-up | Ilustracao animada sugerida | Referencia de estilo |
|---|--------|---------------------------|---------------------|
| 1 | **Primeira Publicacao** | Foguete decolando — igual ao `rocket-wrap` existente, mas com um badge "+30 pts" aparecendo embaixo (estilo `gift-badge`). Estrelas subindo, chama pulsando, fumaca caindo. O foguete representa o inicio da jornada. | Combinar `rocket-wrap` + `gift-badge` |
| 2 | **10 Publicacoes** | Stack de 10 post-cards empilhados se revelando um a um com efeito cascata, depois um check grande aparece no centro com sparkles ao redor. Representa volume e consistencia. | Adaptar `post-card` em stack + `trophy-spark` |
| 3 | **30 Publicacoes** | Chama/fire gradient (primary para gold) crescendo do centro, pulsando com intensidade, sparkles orbitando ao redor. Uma faixa "30 publicacoes" desce do topo (estilo `trophy-ribbon`). Representa dominio e fogo interior. | Criar flame novo + `trophy-ribbon` adaptado |
| 4 | **Primeira Trilha** | Barra de progresso preenchendo ate 100% (estilo `trilha-fill`), depois os 4 dots viram checks sequencialmente, e um chapeu de graduacao aparece flutuando acima com sparkles. | Adaptar `trilha-card` animacao + chapeu novo |
| 5 | **5 Missoes Completas** | Presente abrindo com confete — reutilizar o `gift-stage-wrap` existente. A tampa abre, confete explode, badge embaixo mostra "+50 pts - 5 Missoes". A animacao do presente ja existe e comunica perfeitamente conquista/recompensa. | Reutilizar `gift-stage-wrap` com texto adaptado |

### 13.3 Modal de Ciclo de Streak Completo (1 modal)

| # | Pop-up | Ilustracao animada sugerida | Referencia de estilo |
|---|--------|---------------------------|---------------------|
| 6 | **Ciclo de 7 semanas completo** | As 7 caixas de semana (S1-S7) dispostas em fileira, cada uma virando check sequencialmente com delay (estilo `dotFill`). Ao completar a ultima, explosao de confete (reutilizar `confettiFly`), numero "+1.270 pts" sobe com efeito scale, e um trofeu dourado aparece no centro (reutilizar `trophy-base` com a estrela mostrando o numero do ciclo completado). Faixa "Ciclo Completo" desce do topo. | Combinar `dotFill` sequencial + `confettiFly` + `trophy-base` + `trophy-ribbon` |

**Texto do modal:**
- Titulo: "Ciclo completo!"
- Subtitulo: "Voce publicou consistentemente por 7 semanas seguidas"
- Destaque: "+1.270 pontos de bonus de streak"
- Info: "Ciclo #[N] completado — Seu proximo ciclo comeca agora"
- Botao primario: "Comecar novo ciclo"

### 13.4 Modal de Resgate de Recompensa (funcional)

| # | Pop-up | Ilustracao animada sugerida | Referencia de estilo |
|---|--------|---------------------------|---------------------|
| 7 | **Resgate realizado com sucesso** | Presente abrindo (reutilizar `gift-stage-wrap`), mas em vez de badge generico, mostra o nome da recompensa resgatada e, se for cupom com codigo, exibe o codigo num card destacado com borda tracejada e botao "Copiar". Confete explode ao redor. | Adaptar `gift-stage-wrap` + card de codigo |

**Variacao para creditos de IA:**
- Mesma animacao, mas o badge mostra "+[N] creditos de IA adicionados"
- Icone de sparkle (estilo `ia-write-spark`) girando ao lado do texto
- Neste caso, um toast simples pode ser suficiente em vez do modal completo (decisao de UX)

### 13.5 Resumo completo de notificacoes

| # | Tipo | Trigger | Formato | Ilustracao |
|---|------|---------|---------|------------|
| — | Pontuacao (qualquer) | Toda acao que gera pontos | **Toast** (3-5s, auto-dismiss) | Icone SVG 24x24 por categoria |
| 1 | Conquista: 1a publicacao | 1 post publicado | **Modal** com ilustracao | Adaptar foguete existente |
| 2 | Conquista: 10 publicacoes | 10 posts publicados | **Modal** com ilustracao | Criar: stack de posts |
| 3 | Conquista: 30 publicacoes | 30 posts publicados | **Modal** com ilustracao | Criar: chama/fire |
| 4 | Conquista: 1a trilha | 1 trilha completa | **Modal** com ilustracao | Adaptar trilha existente |
| 5 | Conquista: 5 missoes | 5 missoes aprovadas | **Modal** com ilustracao | Reutilizar presente existente |
| 6 | Streak: ciclo completo | 7 semanas seguidas | **Modal** com ilustracao | Combinar existentes (trofeu + confete + checks) |
| 7 | Resgate de recompensa | Colaborador resgata | **Modal** funcional | Adaptar presente existente |
| 8 | Level up (nivel 2-8) | Ciclos de streak atingem threshold | **Modal** com ilustracao | Gema do nivel com reveal + glow |

**Total: 1 componente de toast universal + 8 modais (7 celebracao + 1 funcional)**
**Ilustracoes novas necessarias: 3 (stack de posts + explosao confetes + gema de nivel)**
**Ilustracoes adaptadas de existentes: 4**
**Toast universal: 1 componente reutilizavel com variacao de icone/cor/texto**

---

## 14. Sistema de Niveis

### 14.1 Conceito

Cada vez que o colaborador completa um ciclo de 7 semanas de streak, ele sobe de nivel. O nivel e permanente — nao reseta mesmo que o streak quebre depois. Representa a consistencia acumulada ao longo do tempo.

**Badge visual:** Todos os niveis usam o mesmo formato de badge — uma **gema/diamante facetada** em SVG com numero do nivel centralizado. A progressao e feita pela **cor**: do lilas mais claro (nivel 1) ao roxo profundo (nivel 8), dentro da paleta Boldfy. Nao usamos bronze/prata/ouro — tudo e unificado no sistema de gemas com gradiente de intensidade.

**4 tamanhos de badge:** XL (100px), LG (76px), MD (52px), SM (36px). Referencia visual em `docs/badges-nivel-referencia.html`.

**Progressao (8 niveis):**

| Nivel | Requisito | Ciclos acumulados | Cor da gema |
|-------|-----------|-------------------|-------------|
| 1 | Default | 0 | Lilas claro (#F5E6FF → #D1A0EB) |
| 2 | 1 ciclo completo | 1 | Lilas medio (#EACFFA → #BD79E2) |
| 3 | 2 ciclos completos | 2 | Roxo claro (#DDB5F4 → #AA44D6) |
| 4 | 4 ciclos completos | 4 | Roxo primary (#D494F0 → #9840AD) |
| 5 | 7 ciclos completos | 7 | Roxo intenso (#C068E8 → #7E3FA6) |
| 6 | 10 ciclos completos | 10 | Roxo escuro (#A848C5 → #5E2A67) |
| 7 | 14 ciclos completos | 14 | Roxo profundo (#8A3CA0 → #3D1A45) |
| 8 | 20 ciclos completos | 20 | Roxo noturno (#6E3088 → #1A0B22) |

**Sem nomes de nivel:** Os niveis sao identificados apenas pelo numero (Nivel 1, Nivel 2, etc). Nao ha nomes como "Iniciante", "Mestre", etc. Simplicidade e clareza.

**Tempo estimado para cada nivel:**
- Nivel 2: ~7 semanas de streak perfeito (~1.7 meses)
- Nivel 3: ~14 semanas totais (~3.5 meses)
- Nivel 4: ~28 semanas totais (~7 meses)
- Nivel 5: ~49 semanas totais (~12 meses) — um ano de consistencia
- Nivel 6: ~70 semanas totais (~17.5 meses) — um ano e meio
- Nivel 7: ~98 semanas totais (~24.5 meses) — dois anos
- Nivel 8: ~140 semanas totais (~35 meses) — quase tres anos de uso

**Nota:** Os ciclos nao precisam ser consecutivos. Se a pessoa fez 1 ciclo, quebrou por 3 meses, e depois fez outro ciclo, ela sobe pro nivel 3. O nivel recompensa consistencia acumulada, nao sequencial.

**Por que 8 niveis:** Com apenas 5, um power user atingia o topo em ~12 meses e perdia incentivo de progressao. 8 niveis estendem a jornada pra quase 3 anos, mantendo o senso de progresso por muito mais tempo. Os niveis 6-8 sao aspiracionais — poucos vao atingir, mas a existencia deles mantem o jogo vivo.

### 14.2 O nivel e puramente visual e de status

O nivel **NAO da bonus de pontos**. Nenhum multiplicador, nenhum bonus de streak. O incentivo do nivel e 100% visual e de reconhecimento social:

| Nivel | Beneficio visual |
|-------|-----------------|
| 1 | Gema lilas claro no perfil |
| 2 | Gema lilas medio + borda sutil no avatar |
| 3 | Gema roxo claro + borda mais visivel |
| 4 | Gema roxo primary + borda com glow sutil |
| 5 | Gema roxo intenso + borda com glow |
| 6 | Gema roxo escuro + borda animada |
| 7 | Gema roxo profundo + borda animada + particulas sutis |
| 8 | Gema roxo noturno + borda animada + particulas |

**Por que sem bonus de pontos:** Manter o sistema de pontos simples e previsivel. O nivel ja e recompensa visual suficiente — a gema aparece no perfil, no ranking e em todo lugar. Bonus de pontos adicionaria complexidade desnecessaria e inflacao na economia.

### 14.3 Implementacao tecnica

**Armazenamento no documento do usuario:**
```typescript
level: {
  current: number;           // 1-8 (derivado de streak.cyclesCompleted)
  levelUpPending: boolean;   // Flag para exibir pop-up de level up
}
```

**Fonte unica de verdade:** O campo `streak.cyclesCompleted` (secao 2.2) e a fonte canonica do total de ciclos. O nivel e derivado dele. NAO existe campo `level.totalCyclesCompleted` separado, para evitar duplicacao e inconsistencia.

**Constancia consecutiva vs ciclos acumulados:**
- `streak.cyclesCompleted` = ciclos **acumulados** ao longo da vida (nao precisam ser consecutivos). Usado para calcular **nivel**.
- `streak.currentWeeks` = semanas **consecutivas** dentro do ciclo atual (1-7, reseta ao completar ou quebrar). Usado para calcular **conquistas de constancia** e **bonus de streak**.
- Para rastrear constancia longa (ex: 14 semanas consecutivas = 2 ciclos seguidos sem quebrar), o `currentWeeks` reseta a cada 7 mas incrementa `streak.consecutiveCyclesCompleted` ao completar um ciclo. Se o streak quebra, `consecutiveCyclesCompleted` reseta a 0.

**Campo adicional no streak (secao 2.2):**
```typescript
streak: {
  // ... campos existentes ...
  consecutiveCyclesCompleted: number;  // Ciclos consecutivos SEM quebra. Reseta a 0 ao quebrar streak.
                                       // Usado para conquistas de constancia (seq_7, seq_14, etc)
}
```

**Derivando nivel de ciclos:**
```typescript
const LEVEL_THRESHOLDS = [
  { cycles: 20, level: 8 },
  { cycles: 14, level: 7 },
  { cycles: 10, level: 6 },
  { cycles: 7,  level: 5 },
  { cycles: 4,  level: 4 },
  { cycles: 2,  level: 3 },
  { cycles: 1,  level: 2 },
] as const;

function getLevelFromCycles(cycles: number): number {
  for (const t of LEVEL_THRESHOLDS) {
    if (cycles >= t.cycles) return t.level;
  }
  return 1;
}
```

**Sem funcao de bonus:** Como o nivel nao da bonus de pontos, nao ha funcao `getStreakBonus`. Os pontos de streak sao sempre os valores base da tabela (10, 20, 40, 80, 160, 320, 640).

**CSS class do badge:** A classe `lvl-1` a `lvl-8` define as cores da gema. Combinada com `sz-xl/lg/md/sm` para tamanho. O SVG e o mesmo para todos os niveis — so muda a cor via CSS variables (`--gem-top`, `--gem-left`, `--gem-right`, `--gem-bl`, `--gem-br`, `--gem-center`, `--gem-highlight`, `--gem-shadow`).

**Verificacao de level up:**
- Acontece no mesmo momento em que `cyclesCompleted` incrementa (ao completar semana 7 do streak)
- Verificar se o novo `cyclesCompleted` cruza um threshold de nivel (1, 2, 4, 7, 10, 14, 20)
- Se sim: atualizar `level.current`, setar `level.levelUpPending = true`

### 14.4 Pop-up de level up

Quando o colaborador sobe de nivel, exibe um **modal de celebracao** (mesmo peso dos modais de conquista):

**Estrutura:**
- Overlay escuro
- Badge do novo nivel centralizado com animacao de "reveal" (scale + glow)
- Titulo: "Voce subiu para o Nivel [N]!"
- Subtitulo: "Consistencia recompensada. Voce completou [X] ciclos."
- Badge visual do nivel com brilho/particulas
- Botao primario: "Ver meu perfil"
- Botao secundario: "Fechar"

**Texto por nivel:**

| Nivel | Titulo | Mensagem |
|-------|--------|----------|
| 2 | "Nivel 2" | "Voce completou seu primeiro ciclo de 7 semanas!" |
| 3 | "Nivel 3" | "2 ciclos completos. Sua dedicacao ta aparecendo!" |
| 4 | "Nivel 4" | "4 ciclos completos. Voce se destaca no time!" |
| 5 | "Nivel 5" | "7 ciclos completos. Voce e referencia no time!" |
| 6 | "Nivel 6" | "10 ciclos completos. Mais de um ano de consistencia!" |
| 7 | "Nivel 7" | "14 ciclos completos. Dois anos de dedicacao!" |
| 8 | "Nivel 8" | "20 ciclos completos. Quase tres anos de consistencia!" |

### 14.5 Onde o nivel aparece

- **Dashboard pessoal** (secao 15): gema do nivel ao lado do nome no hero (tamanho SM)
- **Borda do avatar**: cor correspondente a gema do nivel em todo lugar que o avatar aparece
- **Ranking**: gema do nivel (tamanho SM) ao lado do nome na lista
- **Pop-up de level up**: modal dedicado ao mudar de nivel, com gema tamanho XL centralizada

---

## 15. Dashboard Gamificado do Colaborador

### 15.1 Conceito — Dashboard = Perfil do colaborador

O dashboard E o perfil do colaborador. Nao existe pagina de perfil separada — tudo que a pessoa precisa ver sobre sua jornada na plataforma esta aqui. Outros colaboradores nao acessam o perfil uns dos outros; eles so se veem no ranking. O dashboard e 100% pessoal.

**Mudancas em relacao ao dashboard atual:**
- Ranking sai do dashboard (vai pra pagina separada)
- Layout muda de 3 colunas pra **bento grid** com CSS Grid de 4 colunas e grid-template-areas

**Nomenclaturas definidas:**
- "Streak" interno permanece no codigo, mas na interface aparece como **"Check-in Semanal"**
- "Proximas Conquistas" se chama **"Conquistas em Andamento"** na interface
- "Meus Badges" se chama **"Conquistas"** na interface
- Niveis sao identificados apenas pelo numero (Nivel 1, Nivel 2...), sem nomes

### 15.2 Layout Bento Grid — Desktop

O dashboard usa **CSS Grid com grid-template-areas** para criar um layout bento onde cada bloco ocupa areas nomeadas. Nao e um stack vertical simples — e um grid coeso onde os cards se encaixam como pecas.

```
grid-template-columns: repeat(4, 1fr);
grid-template-areas:
  "hero       hero       hero       hero"
  "checkin    checkin    checkin    checkin"
  "missoes    missoes    trilhas    trilhas"
  "andamento  andamento  conquistas conquistas"
  "pontos     pontos     recomp     recomp";
```

**Wireframe:**
```
┌──────────────────────────────────────────────────────────┐
│ HERO (4 col)                                              │
│ [Avatar+Gema]  Ola, Joana!          1.840  7  12          │
│                [Gema] Nivel 4       Pts   Rec. Conq.      │
├──────────────────────────────────────────────────────────┤
│ CHECK-IN SEMANAL (4 col)                                  │
│ [Seg✓ Ter✓ Qua Qui Sex✓ Sab Dom]  3/3 posts  +160 pts   │
│ Ciclo: [S1✓ S2✓ S3✓ S4✓ S5~ S6 S7]  Proximo: +320      │
├────────────────────────┬─────────────────────────────────┤
│ MISSOES ATIVAS (2 col) │ TRILHAS DE APRENDIZADO (2 col)  │
│ Lista de missoes       │ Lista com barras de progresso    │
├────────────────────────┬─────────────────────────────────┤
│ CONQUISTAS EM          │ CONQUISTAS (2 col)               │
│ ANDAMENTO (2 col)      │ Badges colecionaveis por         │
│ 3 metas ativas com     │ categoria: pub, trilha, missao,  │
│ barra de progresso     │ constancia                       │
├────────────────────────┬─────────────────────────────────┤
│ MEUS PONTOS (2 col)   │ RECOMPENSAS (2 col)              │
│ Disponiveis: 1.840    │ 7 resgatadas                     │
│ Total ganhos: 5.320   │ 12 disponiveis                   │
└────────────────────────┴─────────────────────────────────┘
```

**Responsivo (mobile):** Em telas menores que 900px, muda para `grid-template-columns: 1fr` e cada area ocupa uma linha.

### 15.3 Hero — Avatar + Nivel + Stats

O hero substitui o header simples e os 4 stats cards. Integra tudo num bloco so:

**Lado esquerdo:**
- Avatar com borda na cor da gema do nivel (lilas claro a roxo noturno)
- Gema do nivel em tamanho SM sobreposta ao canto inferior direito do avatar
- Saudacao: "Ola, [Nome]!"
- Pill de nivel: gema inline + "Nivel N" (sem nome, so numero)

**Lado direito:**
- 3 stats numericos separados por divisores verticais:
  - Pontos (disponiveis, cor primary)
  - Recompensas (resgatadas)
  - Conquistas (badges total)

### 15.4 Card de Check-in Semanal

Nome na interface: **Check-in Semanal**. Ocupa largura total (4 colunas), logo abaixo do hero. E a mecanica principal de retencao — merece destaque maximo.

**Conteudo:**
- Header esquerdo: icone de calendario (roxo) + "Check-in Semanal" + tag "Semana [N]" (pill dourada)
- Header direito: quando completo, icone de check + "3/3". Quando incompleto, apenas "X/3"
- Dias da semana: Seg-Dom com checks verdes nos dias que publicou, "+30" ao lado
- Dia atual: borda roxa mais grossa (3px) + sombra sutil, mesmo que ja tenha check
- Resumo semanal: "3 posts esta semana: +90 pts posts + +160 pts streak" (separa pontos de publicacao dos pontos de streak)
- Ciclo atual: S1 a S7 com estados done/current/future
- Resumo do ciclo: semanas seguidas + proximo bonus

**Icone:** Calendario simples (sem check dentro) na cor roxa (primary). Nao dourado.

**Nota sobre ciclos e nivel:** O card NAO mostra "4 ciclos completados" porque isso e a mesma informacao que o nivel. Se a pessoa tem 4 ciclos, ela e nivel 4. O nivel ja esta visivel no hero. O card foca no ciclo ATUAL e no progresso da semana ATUAL.

**Nota sobre bonus de nivel:** O nivel NAO da bonus de pontos na streak. Os pontos de streak sao sempre os valores base (10, 20, 40, 80, 160, 320, 640).

### 15.5 Grid central — Missoes + Trilhas (2 colunas)

O grid muda de 3 colunas pra 2, ja que o ranking saiu. As 2 colunas sao:
- **Missoes Ativas** (mantido igual ao atual)
- **Trilhas de Aprendizado** (mantido igual ao atual)

### 15.6 Conquistas — 2 colunas

Abaixo de missoes/trilhas, outro par de cards:

**Col 1 — Conquistas em Andamento:**
- Icone do titulo: trofeu com reloginho pequeno (indica metas em progresso)
- Mostra as **3 conquistas ativas** (publicacoes, trilhas, missoes) com barra de progresso
- **SEM constancia** nesta secao — o progresso de constancia ja esta no card de Check-in Semanal. Nao faz sentido duplicar
- Cada item: icone da categoria (dashed border) + nome da meta + barra + contagem + "+50 pts"
- Cores: publicacoes (azul), trilhas (verde), missoes (laranja)
- A pessoa esta SEMPRE perseguindo algo aqui — ao completar uma, a proxima aparece

**Col 2 — Conquistas:**
- Icone do titulo: trofeu (mesmo icon, sem relogio)
- Grid de badges colecionaveis (conquistas ja completas)
- Organizados por categoria com label separando cada grupo
- Categorias pub, trilha, missao: cada badge usa o icone da categoria + label (ex: "1a", "10", "30")
- **Categoria constancia = jornada de niveis:** Cada conquista de constancia corresponde a exatamente um level-up. Sem badges intermediarios. Alinhamento: 7sem=Nv2, 14sem=Nv3, 28sem=Nv4, 49sem=Nv5, 70sem=Nv6, 98sem=Nv7, 140sem=Nv8. O badge mostra a gema SVG na cor do nivel com label "Nv2", "Nv3", etc. Apresentado como uma jornada visual: badges conectados por setas mostrando a progressao 7sem > Nv2 > 14sem > Nv3 > ...
- Cor de fundo e borda sutil na cor da categoria/nivel
- Mostra total de badges no header ("12 conquistados")

### 15.7 Pontos e Recompensas — 2 colunas (rodape)

Ultimo par de cards no grid:

**Col 1 — Meus Pontos:**
- Link "Historico" no header (redireciona pra pagina de recompensas com historico de pontos)
- Disponiveis (destaque, cor primary)
- Total ganhos (lifetime)
- Total gastos

**Col 2 — Recompensas:**
- Quantidade resgatadas (com icone check verde)
- Quantidade disponiveis na loja
- Link "Ver loja"

### 15.8 Dados necessarios

| Dado | Fonte | Ja existe? |
|------|-------|-----------|
| Pontos disponiveis | `user.points` | Sim |
| Total ganhos | Soma `pointsHistory` type 'gain' | Precisa computar |
| Total gastos | Soma `pointsHistory` type 'spend' | Precisa computar |
| Recompensas resgatadas | Count `users/{id}/rescues` | Sim |
| Conquistas completas | `user.conquests.completed[]` | Novo (secao 4) |
| Progresso conquistas | Count posts, trilhas, missoes | Precisa computar |
| Nivel atual | Derivado de `streak.cyclesCompleted` | Novo (secao 14) |
| Streak atual | `user.streak.currentWeeks` | Novo (secao 2.2) |

### 15.9 Mudancas em relacao ao dashboard atual

| O que muda | Antes | Depois |
|-----------|-------|--------|
| Layout | 3 colunas fixas | Bento grid com CSS Grid + grid-template-areas |
| Header | "Ola, [Nome]!" simples | Hero com avatar + gema + nivel + 3 stats |
| Stats cards (4) | 4 cards separados | Integrados no hero |
| Coluna 3 | Widget de ranking top 10 | Removido (ranking vai pra pagina separada) |
| Acima do grid | Nada | Card de Check-in Semanal (largura total) |
| Abaixo do grid | Nada | Conquistas em Andamento + Conquistas + Pontos + Recompensas |

**O ranking permanece como pagina separada** (`/colaborador/rankings`). Sai do dashboard principal porque:
1. Rankings competitivos podem desmotivar quem esta em ultimo
2. O dashboard pessoal e mais motivador (progresso individual vs comparacao)
3. O espaco e melhor aproveitado com conquistas e check-in

**Preview visual:** Ver `docs/dashboard-gamificado-preview.html` (v3 Bento Grid) para preview completo em HTML/CSS.

---

## 17. Mapa de Integracoes entre Modulos

Esta secao documenta como os dados do sistema de gamificacao se conectam com os modulos existentes da plataforma. Cada card/secao do dashboard aponta para dados reais e rotas existentes. Nenhum link aponta para pagina inexistente.

### 17.1 Dashboard → Modulos existentes

| Elemento no Dashboard | Dados vem de | Link/Acao leva para | Rota existente? | Integracao |
|----------------------|-------------|---------------------|-----------------|------------|
| **Hero — Pontos** | `user.points` | Clique no valor leva a Meus Pontos (scroll) | Sim (mesmo dashboard) | Leitura direta do user doc |
| **Hero — Recompensas** | Count de `users/{uid}/rescues` | Clique leva a `/colaborador/recompensas` | Sim | Query count client-side |
| **Hero — Conquistas** | `user.conquests.completed.length` | Clique leva a Conquistas (scroll) | Sim (mesmo dashboard) | Novo campo no user doc |
| **Hero — Nivel + Gema** | Derivado de `streak.cyclesCompleted` via `getLevelFromCycles()` | Visual apenas (sem link) | N/A | Novo campo + logica |
| **Check-in Semanal — Dias** | `streak.postsThisWeek` + datas de publicacao da semana | Nenhum link (visual) | N/A | Query posts da semana do user |
| **Check-in Semanal — Ciclo** | `streak.currentWeeks` + `streak.cyclesCompleted` | Nenhum link (visual) | N/A | Campos do streak no user doc |
| **Missoes Ativas** | `companies/{companyId}/missions` (status ativo) | "Ver todas" → `/colaborador/missoes` | Sim | Query client-side (ja existe) |
| **Missao Extract** | Missao automatica em `companies/{companyId}/missions` com `isSystemMission: true` | Clique na missao → `/colaborador/analytics` | Sim | Nova missao auto + link deep |
| **Trilhas de Aprendizado** | `companies/{companyId}/trails` + `users/{uid}/trailProgress` | "Ver todas" → `/colaborador/trilhas` | Sim | Query client-side (ja existe) |
| **Conquistas em Andamento** | `user.conquests.completed` + counts de posts/trilhas/missoes | Nenhum link (visual com progresso) | N/A | Novo + queries existentes |
| **Conquistas (badges)** | `user.conquests.completed[]` | Nenhum link (colecao visual) | N/A | Novo campo no user doc |
| **Meus Pontos** | `user.points` + `users/{uid}/pointsHistory` | "Historico" → `/colaborador/recompensas` (aba historico) | Sim | Leitura direta (ja existe) |
| **Recompensas** | Count de `companies/{companyId}/rewards` + `users/{uid}/rescues` | "Ver loja" → `/colaborador/recompensas` | Sim | Query client-side (ja existe) |

### 17.2 Modulos que ALIMENTAM a gamificacao

| Modulo existente | Acao do usuario | O que acontece na gamificacao | Arquivo principal |
|-----------------|----------------|-------------------------------|-------------------|
| **Publicacao LinkedIn** | Publica um post | +30 pts (toast) + check dia da semana + incrementa `postsThisWeek` + verifica streak + verifica conquista pub | `actions/posts.ts` ou `publishToLinkedIn()` |
| **Trilhas** | Completa modulo/trilha | Pontos por modulo (toast) + verifica conquista trail | `trailProgress` (client) + `actions/points.ts` |
| **Missoes** | Completa missao | Pontos da missao (toast) + verifica conquista mission | `actions/missions.ts` |
| **Analytics (Extract)** | Upload Extract mensal | Missao auto concluida + 80 pts (toast) | `actions/linkedin-analytics.ts` |
| **Calendario** | Agenda post para publicacao | Nenhum efeito direto — pontos so ao publicar | `actions/posts.ts` |
| **Ranking** | Apenas leitura | Mostra posicao + streak ao lado do nome | `actions/points.ts` (getCompanyRanking) |
| **Recompensas/Loja** | Resgata recompensa | Debita pontos + modal de resgate + entrega codigo/creditos | `actions/rewards.ts` |

### 17.3 Fluxo de dados — Check-in Semanal ↔ Publicacao ↔ Calendario

```
Colaborador agenda post no Calendario (/colaborador/calendario)
  → Post fica agendado (nenhum ponto ainda)
  → No horario agendado, sistema publica via API LinkedIn
  → Se sucesso: +30 pts + check no dia + incrementa postsThisWeek
  → Se postsThisWeek >= 3: semana completada + bonus streak
  → Card de Check-in Semanal atualiza automaticamente (dados vem do streak no user doc)
```

**Importante:** O card de Check-in no dashboard NAO tem link direto pro calendario. O calendario e uma ferramenta de agendamento, o check-in e visualizacao de progresso. O vinculo entre eles e **os dados** (posts publicados = checks no dia), nao a navegacao.

### 17.4 Fluxo de dados — Extract ↔ Analytics ↔ Missoes

```
Sistema cria missao automatica "Enviar Extract de [mes]" (cron mensal)
  → Missao aparece em "Missoes Ativas" no dashboard
  → Colaborador clica na missao → vai para /colaborador/analytics
  → Faz upload do Extract na pagina de Analytics
  → uploadLinkedInSnapshot() retorna sucesso
  → Sistema marca missao como concluida + credita 80 pts
  → Toast: "+80 pts — Extract enviado"
  → Missao some de "Missoes Ativas" no proximo refresh
```

### 17.5 Verificacao de rotas referenciadas

| Rota | Existe? | Sidebar do colaborador? | Usada no dashboard |
|------|---------|------------------------|--------------------|
| `/colaborador/dashboard` | Sim | Sim (LayoutDashboard) | E o proprio dashboard |
| `/colaborador/missoes` | Sim | Sim (Zap) | "Ver todas" em Missoes Ativas |
| `/colaborador/trilhas` | Sim | Sim (BookOpen) | "Ver todas" em Trilhas |
| `/colaborador/recompensas` | Sim | Sim (Gift) | "Ver loja" em Recompensas + "Historico" em Meus Pontos |
| `/colaborador/analytics` | Sim | Sim (BarChart2) | Link da missao de Extract |
| `/colaborador/calendario` | Sim | Sim (CalendarDays) | Nao referenciado diretamente no dashboard |
| `/colaborador/rankings` | Sim (redireciona) | Nao | Nao referenciado no dashboard |
| `/colaborador/biblioteca` | Sim | Sim (Library) | Nao referenciado no dashboard |
| `/colaborador/assistente` | Sim | Sim (Sparkles) | Nao referenciado no dashboard |
| `/colaborador/linkedin-feed` | Sim | Sim (Newspaper) | Nao referenciado no dashboard |

**Resultado: 100% das rotas referenciadas no dashboard existem.** Nenhum link aponta para pagina inexistente.

### 17.6 Arquivos de referencia visual (HTMLs de preview)

| Arquivo | O que mostra | Onde e referenciado no plano |
|---------|-------------|---------------------------|
| `docs/dashboard-gamificado-preview.html` | Preview completo do dashboard gamificado v3 (Bento Grid) | Secao 15.9 |
| `docs/badges-nivel-referencia.html` | Design das 8 gemas de nivel em 4 tamanhos | Secao 14.1 |

Estes sao **mockups visuais**, nao codigo de producao. Na implementacao:
- SVGs inline viram componentes React ou sao extraidos para arquivos SVG
- CSS vanilla vira classes Tailwind
- Layout se adapta ao sistema de design shadcn/ui ja existente
- Icones devem usar Lucide React (consistente com o resto do app)

---

## 18. Decisoes Pendentes e Proximos Passos

### Decisões tomadas nesta conversa:
- [x] Pontos por publicação = 30 pts (base) — streak recompensa consistência por cima ✅
- [x] Recompensas nativas = créditos de IA (pré-populadas) ✅
- [x] Sugestões de recompensas = popup/modal orientativo pro admin ✅
- [x] Entrega de cupons = banco de códigos no admin (Opção B) ✅
- [x] Conquistas espaçados: 1ª, 10ª, 30ª publicação ✅
- [x] Página dedicada de ranking com conquistas ✅
- [x] Preferir cartão benefícios a bônus em salário (compliance trabalhista) ✅
- [x] Recálculo completo da economia de pontos ✅
- [x] Streak = mínimo 3 posts/semana (não 1) ✅
- [x] Streak fica no dashboard do colaborador (card pessoal com progresso semanal) ✅
- [x] Streak aparece como menção leve no ranking ao lado do nome ✅
- [x] Bônus de streak = exponencial dobrando a cada semana (10→20→40→80→160→320→640) ✅
- [x] Ciclo de 7 semanas com reset ao completar (evita inflação, renova o jogo) ✅
- [x] Visual do streak com check/x/vazio das semanas do ciclo + valores de cada semana ✅
- [x] Conquistas de streak removidos (streak ja tem seu proprio ciclo com celebracao) ✅
- [x] Sem emojis — tudo com icones SVG seguindo identidade visual Boldfy ✅
- [x] Quiz vale o mesmo que video (80 pts), bonus 80%+ = +30 extras (total 110 pts) ✅
- [x] Bonus conclusao de trilha = 30 pts fixo ✅
- [x] Frequencias de trilha: ativo 2-3/sem, mediano 1/sem, casual 1/mes ✅
- [x] Toast universal para TODA pontuacao (feedback constante) ✅
- [x] Modais apenas para conquistas (5) + ciclo streak (1) + resgate recompensa (1) + level up (7) ✅
- [x] Hierarquia clara: toast minimo → modal celebracao → modal funcional ✅
- [x] Visual de streak com checkmarks dos dias da semana + "+30" por post publicado ✅
- [x] Dois niveis visuais: dias da semana (micro) + ciclo de 7 semanas (macro) ✅
- [x] ~~Upload de Extract mensal = 40 pts~~ Atualizado para 80 pts como missao automatica (ver secao 2.3) ✅
- [x] Streak reseta completamente ao falhar (sem semanas salvas, volta pro zero) ✅
- [x] Sistema de 8 niveis com gemas diamante: Nivel 1 (0 ciclos) ate Nivel 8 (20 ciclos) ✅
- [x] Niveis sem nomes: apenas "Nivel 1", "Nivel 2", etc. Sem "Iniciante", "Mestre", etc ✅
- [x] Niveis sao permanentes — nao resetam quando streak quebra ✅
- [x] Ciclos nao precisam ser consecutivos para subir de nivel ✅
- [x] Niveis sao puramente visuais — NAO dao bonus de pontos ✅
- [x] Beneficio visual: gema SVG diamante facetada (lilas claro a roxo noturno) + borda do avatar colorida por nivel ✅
- [x] Badge de gema em 4 tamanhos (XL 100px, LG 76px, MD 52px, SM 36px), design aprovado em `docs/badges-nivel-referencia.html` ✅
- [x] Dashboard: bento grid com CSS Grid + grid-template-areas (nao stack vertical) ✅
- [x] Dashboard: card de check-in semanal ocupa largura total abaixo do hero ✅
- [x] Dashboard E o perfil do colaborador (nao existe pagina de perfil separada) ✅
- [x] Ranking permanece como pagina separada, sai do dashboard principal ✅
- [x] "Streak" na interface se chama "Check-in Semanal" ✅
- [x] "Proximas Conquistas" renomeado para "Conquistas em Andamento" ✅
- [x] "Meus Badges" renomeado para "Conquistas" ✅
- [x] Constancia removida das "Conquistas em Andamento" (ja tem card proprio de check-in) ✅
- [x] Sistema de conquistas renovaveis com 4 categorias progressivas (secao 4) ✅
- [x] Icone do Check-in Semanal = calendario simples na cor roxa (sem check dentro, sem dourado) ✅
- [x] Header do Check-in: titulo + tag "Semana N" separada. Lado direito: icone check + "3/3" quando completo, "X/3" quando nao ✅
- [x] Dia atual marcado com borda roxa mais grossa (3px) + sombra, mesmo nos dias com check ✅
- [x] Resumo semanal separa pontos de posts (+90 pts posts) de pontos de streak (+160 pts streak) ✅
- [x] Meus Pontos: link "Historico" no header redireciona pra historico de pontos ✅
- [x] Conquistas em Andamento: icone de trofeu com reloginho (indica metas em progresso) ✅
- [x] Badges de constancia usam gemas de nivel (nao calendario): 7sem=Nv2, 14sem=Nv3, 28sem=Nv4, 49sem=Nv5 ✅
- [x] Conquistas de constancia alinhadas EXCLUSIVAMENTE aos thresholds de nivel: removidos 21sem e 35sem (nao correspondem a level-up). Ladder agora: 7, 14, 28, 49, 70, 98, 140 semanas ✅
- [x] Jornada completa Nv2 a Nv8: adicionados Nv6 (70sem), Nv7 (98sem), Nv8 (140sem) ✅
- [x] Visual de jornada: badges de constancia conectados por setas mostrando progressao. Earned = colorido com sombra, locked = opaco com grayscale ✅
- [x] Extract mensal = missao automatica de 80 pts. Sistema cria missao todo mes, link leva pra `/colaborador/analytics`, auto-completa ao fazer upload ✅
- [x] Exemplos de missoes no dashboard: teor de conteudo criativo (ex: "Criar post sobre evento da empresa"), nao generico como "publicar 3 posts" ✅
- [x] Saudacao do dashboard: "Ei, [Nome]!" em vez de "Ola, [Nome]!" ✅
- [x] Logica de dias: dias futuros nunca mostram check (se hoje e quinta, sexta nao pode ter post) ✅
- [x] Terminologia unificada: "milestone" substituido por "conquista" em todo o plano ✅
- [x] Source no pointsHistory: `'conquest'` (nao `'milestone'`) ✅
- [x] Modelo de dados: `streak.cyclesCompleted` e fonte unica (removido `level.totalCyclesCompleted` duplicado) ✅
- [x] Campo `streak.consecutiveCyclesCompleted` adicionado para rastrear constancia sem quebra (conquistas de constancia) ✅
- [x] Secao 17 (Mapa de Integracoes) adicionada: todos os links do dashboard apontam para rotas existentes ✅

### Decisoes pendentes:
- [ ] Validar valores exatos de pontos das recompensas sugeridas com stakeholders
- [ ] Definir se o popup de sugestoes aparece no primeiro acesso do admin ou e sempre acessivel
- [ ] Detalhar design/UX da pagina de ranking separada (mockup ou spec)
- [ ] Decisao sobre evolucao futura: integracao com API de gift cards (GIFQ/Carpe Diem XP) vs manter fluxo manual
- [ ] Validar se "Parabenizar" vai ser notificacao interna, email, ou ambos
- [ ] Criar as 3 ilustracoes novas (stack de posts + explosao confetes + gema de nivel) e 4 adaptacoes
- [x] ~~Definir design dos badges de nivel~~ Definido: 8 gemas diamante facetadas em gradiente lilas a roxo (ver `docs/badges-nivel-referencia.html`) ✅

### Para futuro (nao nesta versao):
- Integracao com APIs de gift cards para compra e entrega automatizada
- ~~Badges visuais colecionaveis~~ Implementado como "Conquistas" no dashboard (secao 4)
- ~~Niveis/tiers de colaborador~~ Implementado com 8 niveis de gema (secao 14)
- Desafios semanais automaticos
- Analytics de gamificacao pro admin (taxa de resgate, pontos distribuidos, ROI)

---

> **Este documento deve ser atualizado conforme decisões forem tomadas. Serve como fonte de verdade para todo o sistema de gamificação da Boldfy.**
