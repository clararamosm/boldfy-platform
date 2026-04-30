# Documento de Treinamento — LinkedIn Profile Optimizer
## Boldfy · Abril 2026

Este documento define os critérios de qualidade, padrões de escrita e regras de otimização que a IA deve seguir ao gerar sugestões de perfil LinkedIn para os Thought Leaders da Boldfy. É o padrão de referência — tudo que a IA gera deve estar alinhado com o que está aqui.

---

## Contexto: Por que o perfil importa em 2026

O algoritmo 360Brew do LinkedIn executa uma **auditoria de pré-distribuição** antes de qualquer post chegar a qualquer pessoa. O perfil não é mais um currículo passivo — é um **documento de treinamento de IA** que determina se o conteúdo é distribuído ou suprimido.

O perfil deve funcionar como um conjunto coerente de sinais semânticos: o que está no headline, no Sobre, nas competências e nas experiências deve contar **a mesma história** que os posts publicam. Qualquer dissonância entre essas partes é detectada e penalizada.

---

## 1. HEADLINE

### Função
O headline é o "prompt de contexto primário" do perfil. É o primeiro sinal que o algoritmo lê para categorizar a autoridade e o nicho do TL. Deve comunicar claramente **qual problema o TL resolve, para quem e como**.

### Fórmula
```
[Resultado claro / Problema que resolve] | [Cargo/Papel] | [Palavras-chave do nicho/metodologia]
```

Variações válidas (não precisa ser rígido, mas deve conter os elementos):
- Resultado + nicho + metodologia
- Verbo de ação + nicho + diferencial
- Problema resolvido + perfil de cliente + cargo

### Exemplos aprovados
- `Ajudando empresas SaaS a aumentar a receita | Estratégia de Conteúdo e Crescimento`
- `Construindo Infraestrutura FinTech | Fundador @Empresa | Insights de Mercado`
- `Geração de demanda B2B SaaS para startups Series A-C`
- `Coach de Liderança | Ajudando Executivos a Escalar sem Burnout`
- `I help overlooked leaders become impossible to ignore`
- `Building revenue engines that don't stall after Q2`

### Regras de escrita
- **Pessoa:** neutro focado em ação — verbos no gerúndio ou infinitivo ("Ajudando", "Construindo", "Explorando"). Não usa "eu" nem terceira pessoa
- **Tom:** direto, específico, focado na solução real. Pode ser ousado, mas nunca vago
- **Tamanho:** conciso — o headline deve ser lido em menos de 5 segundos

### Proibido (reprovar imediatamente)
- Buzzwords vazios: "Visionário", "Inovador", "Apaixonado por inovação", "Mindset de crescimento"
- Cargo isolado sem contexto: "CEO", "Gerente de Marketing", "Empreendedor", "Líder"
- Promessas amplas demais: "Ajudando empresas a crescer", "Transformando negócios"
- Linguagem corporativa engessada ou excessivamente polida
- Qualquer coisa que confunda o algoritmo sobre qual nicho o TL ocupa

---

## 2. SEÇÃO SOBRE (About)

### Função
A seção Sobre é o "arquivo de evidências" que a IA usa para construir a impressão digital de autoridade temática do TL. Deve declarar explicitamente os 2–3 pilares de conteúdo sobre os quais o TL escreve — isso é obrigatório para que o algoritmo consiga fazer o match semântico com os posts publicados.

### Estrutura obrigatória
1. **Gancho / Problema:** abre fisgando a atenção. Declara claramente os problemas reais de negócios que o TL resolve na prática
2. **Metodologia / Palavras-chave:** termos específicos, ferramentas técnicas, metodologias que definem o nicho. Aqui entram as "Tags de Expertise" que o algoritmo vai usar para categorizar
3. **Prova / Resultados:** casos reais, impacto concreto, números quando disponíveis. Sem adjetivos vazios — apenas evidências
4. **Pilares de conteúdo declarados:** menciona explicitamente os 2–3 tópicos sobre os quais o TL escreve no LinkedIn. Ex: "Aqui no LinkedIn, escrevo sobre X, Y e Z."
5. **CTA:** convida o público-alvo ideal a seguir o perfil

### Regras de escrita
- **Tamanho:** completo o suficiente para alimentar a IA com palavras-chave, mas sem "fluff". Não há número fixo de palavras — o critério é: cada frase deve ganhar o direito de existir
- **Formatação:** parágrafos curtos (máx. 3–4 frases), espaços em branco, negrito para destacar palavras-chave e insights. Sem blocos de texto corridos
- **Tom:** voz humana, autêntica e direta. Estilo "relato jornalístico" — a proposta de valor é imediata e explícita. Profissional mas não corporativo. Confiante mas não agressivo/vendedor
- **Pessoa:** primeira pessoa ("Liderei", "Construí", "Trabalho com") — soa humano e autêntico

### Proibido
- Texto corrido sem quebras ("wall of text")
- Narrativa longa e vaga de currículo tradicional
- Buzzwords e adjetivos sem evidência ("especialista apaixonado", "resultados extraordinários")
- Omitir os pilares de conteúdo — isso cria dissonância semântica com os posts

---

## 3. COMPETÊNCIAS (Top Skills)

### Função
As competências são a principal fonte de dados estruturados que o algoritmo usa para validar a identidade profissional e distribuir o conteúdo. Funcionam como a "tradução estruturada" do calendário editorial do TL.

### Critério de seleção
Prioridade única: **espelhar os pilares de conteúdo do TL**. O algoritmo cruza as competências declaradas com os temas dos posts para atribuir as "Tags de Expertise". Uma competência que o TL nunca aborda no conteúdo gera dissonância semântica e penaliza o alcance — mesmo que o TL realmente tenha essa competência.

### Idioma
Depende do idioma em que o TL escreve e do público-alvo (ICP). Se os posts são em português para audiência brasileira, as competências devem estar em português. O algoritmo precisa fazer o match semântico entre posts e perfil — idiomas diferentes quebram esse match.

### Regras de escrita
- Sempre 5 competências (máximo permitido pelo LinkedIn)
- Específicas e técnicas: preferir metodologias, ferramentas e resultados de nicho a termos amplos
  - ❌ "Marketing" → ✅ "Geração de Demanda B2B SaaS"
  - ❌ "Liderança" → ✅ "Gestão de Times de Produto em Stage A-C"
- Nenhuma competência fora do nicho atual — mesmo que seja real e relevante para a carreira

### Remover sempre
- Competências de carreiras passadas não relacionadas ao nicho atual
- Termos excessivamente genéricos ("Marketing", "Comunicação", "Liderança")
- Qualquer competência que o TL não aborde no seu conteúdo
- Ferramentas operacionais sem relevância para a audiência (ex: "Notion" se não é um pilar de conteúdo)

---

## 4. EXPERIÊNCIAS

### Função
A seção de Experiência funciona como verificação de credibilidade. O algoritmo cruza o que o TL declara nos posts com as provas que apresenta no histórico de trabalho. Títulos não são provas — entregáveis, resultados e especificidade são provas.

### Estrutura por experiência
```
[Contexto breve] → [Ação concreta] → [Resultado em número / impacto mensurável]
```

Elementos obrigatórios quando disponíveis: números exatos, datas, nomes de sistemas/ferramentas/metodologias aplicadas.

### Cargo atual — regra crítica
**Sempre preencher, sem exceção.** Um cargo atual em branco cria um "gap semântico" que o algoritmo interpreta como erro e suprime a visibilidade do perfil. Se ainda não há métricas de sucesso, descreve:
- As metodologias aplicadas
- As ferramentas técnicas utilizadas no dia a dia
- O problema central de negócios que o TL foi contratado para resolver

### Experiências antigas (10+ anos)
Devem ser enxutas e altamente filtradas. Descrever em detalhes funções antigas não relacionadas ao nicho atual gera "Topic Scattering" (dispersão de tópicos), que confunde o algoritmo e dilui a autoridade. Nas experiências antigas, destacar **apenas o que suporta o nicho atual**.

### Regras de escrita
- **Pessoa:** primeira pessoa focada em ação — "Liderei...", "Escalei...", "Construí...", "Implantei..."
- **Proibido:** "Responsável por...", "Atuei como...", "Fui encarregado de..." — linguagem de currículo antigo, penalizada pelo algoritmo
- Tom direto, humano e específico — sem linguagem corporativa engessada

---

## 5. DESTAQUE (Featured)

### Lógica estratégica
O Destaque é uma escolha da estrategista, não da IA. A IA pode sugerir estrutura, mas a decisão dos links é humana.

**Padrão Boldfy: 2 itens**

| Item | Destino | Objetivo |
|------|---------|----------|
| Item 1 | **Book a call** | CTA direto de conversão |
| Item 2 | **Material rico** | Construção de autoridade e transmídia (YouTube, podcast, lead magnet, etc.) |

### Regra crítica de formatação
**Sem descrição nos itens do Destaque.** Com descrição, são necessários 2 cliques para acessar o conteúdo. Sem descrição, é 1 clique direto. O objetivo é remover qualquer fricção no caminho para o link.

### O que usar
- Título: pode ser reescrito para ser mais atrativo — não precisa ser o título original do link
- Mídia/imagem: deve ser visualmente atrativa e representar bem o conteúdo
- Links: funcionais, testados, sem redirecionamentos desnecessários

---

## 6. GAP ANALYSIS (Análise de Lacunas)

### Tom e abordagem
**Direto, objetivo, sem rodeios.** O gap analysis é um diagnóstico técnico do "código-fonte semântico" do perfil — não uma avaliação de performance pessoal. Não há espaço para linguagem suave ou corporativa. O TL precisa entender exatamente o que está quebrado e por quê isso importa para a distribuição do conteúdo.

### Critério de priorização
**Exclusivamente por impacto no algoritmo** — nunca por facilidade de correção. O 360Brew funciona através de "portões lógicos" sequenciais: se o perfil falhar na auditoria de identidade (primeira etapa), otimizar posts ou táticas de engajamento é inútil — a distribuição já foi bloqueada na raiz.

### Dois erros críticos (invalidam tudo o mais)

**1. Identity Mismatch (Dissonância Semântica)**
O erro mais destrutivo. Ocorre quando a expertise declarada no perfil conta uma história diferente dos tópicos abordados nos posts. O algoritmo não consegue classificar a autoridade do TL e corta a distribuição por considerá-lo de baixa confiança. Exemplo: perfil declara "Arquitetura de Nuvem", posts falam sobre "motivação e cultura" → distribuição bloqueada.

**2. Cargo Atual em Branco**
Erro técnico frequentemente ignorado, mas fatal. O algoritmo interpreta a ausência como erro de dados e suprime a visibilidade tanto na busca quanto no feed orgânico. Mesmo em transição de carreira: obrigatório preencher (ex: "Consultora Independente", "Pausa na Carreira").

### Estrutura do gap analysis gerado pela IA
Para cada problema identificado:
1. **Elemento afetado:** qual parte do perfil (headline, sobre, competências, experiência atual, destaque)
2. **Problema:** o que está errado, tecnicamente
3. **Impacto:** qual penalidade isso gera no algoritmo
4. **Correção:** o que fazer especificamente

---

## 7. SCORE DE ALINHAMENTO 360BREW

### O que mede
O score avalia a coerência semântica entre três zonas simultâneas:
1. **Identidade do perfil:** headline + sobre + competências
2. **Tópico do conteúdo:** pilares de conteúdo declarados no Brand Context + posts recentes
3. **Consistência:** ausência de dissonâncias entre as duas zonas acima

### Threshold
- **Score ≥ 40:** passa na auditoria → distribuição desbloqueada
- **Score < 40:** bloqueio de nicho → alcance limitado às conexões de 1º grau

### Como calcular (lógica determinística)
| Critério | Peso | Como avaliar |
|----------|------|-------------|
| Headline contém nicho + resultado claro | 25% | Verificar presença de palavras-chave dos pilares de conteúdo |
| Sobre menciona explicitamente os pilares | 25% | Verificar se os 2–3 tópicos de conteúdo estão nomeados |
| Competências espelham pilares de conteúdo | 25% | Calcular % de competências alinhadas aos pilares |
| Cargo atual preenchido com conteúdo relevante | 15% | Verificar se existe e se contém palavras-chave do nicho |
| Ausência de dissonâncias críticas | 10% | -10% por cada Identity Mismatch identificado |

---

## 8. REGRAS GERAIS PARA GERAÇÃO DE TEXTO

### Sempre fazer
- Usar os pilares de conteúdo do Brand Context como bússola semântica em todas as seções
- Incluir palavras-chave técnicas específicas do nicho (não genéricas)
- Escrever como um profissional experiente falando para outro profissional do mesmo setor
- Verificar coerência semântica entre todas as seções geradas antes de retornar o output

### Nunca fazer
- Usar buzzwords: "visionário", "inovador", "apaixonado", "transformador", "disruptivo"
- Usar linguagem corporativa engessada: "responsável por", "fui encarregado de", "atuei como"
- Gerar texto genérico que poderia ser de qualquer profissional em qualquer setor
- Ignorar os pilares de conteúdo do Brand Context — eles são a âncora de toda a otimização
- Inventar resultados ou números — se não há dados concretos, descrever metodologias e processos

### Teste de qualidade antes de retornar
Para cada seção gerada, fazer a pergunta:
> "Isso poderia ser de qualquer outro profissional no LinkedIn, ou é claramente do [nome do TL] no nicho [nicho específico]?"

Se a resposta for "poderia ser de qualquer um" → reescrever.

---

*Documento criado pela Boldfy · Abril 2026*
*Uso interno — treinamento da IA do LinkedIn Profile Optimizer*
