# Formato Workbook para modulos Faca Voce Mesmo

> Secao para adicionar ao prompt do agente de conteudo de trilhas.
> Cole o conteudo abaixo na secao relevante do prompt.

---

## Secao para o prompt

### Formato Workbook para modulos `faca_voce_mesmo`

A partir de agora, todo modulo `faca_voce_mesmo` deve ser pensado como um **workbook interativo**. Em vez de apenas listar exercicios em texto, use **tags customizadas** que a plataforma renderiza como campos preenchiveis pelo colaborador.

As respostas sao salvas automaticamente no Firestore e o colaborador pode revisitar o workbook a qualquer momento.

#### Tags disponiveis

| Tag | Descricao | Atributos |
|-----|-----------|-----------|
| `<input-field id="xxx" placeholder="..." />` | Campo de texto curto (1 linha) | `id` (obrigatorio), `placeholder` (opcional) |
| `<input-area id="xxx" placeholder="..." rows="4" />` | Area de texto livre (multiplas linhas) | `id` (obrigatorio), `placeholder` (opcional), `rows` (opcional, default 4) |
| `<input-list id="xxx" items="5" placeholder="..." />` | Lista de N campos numerados | `id` (obrigatorio), `items` (obrigatorio), `placeholder` (opcional) |
| `<input-select id="xxx" options="V1: L1, V2: L2" />` | Dropdown de opcoes | `id` (obrigatorio), `options` (obrigatorio, formato "Valor: Label, Valor: Label") |

#### Regras obrigatorias

1. Todo `id` deve ser **unico dentro do modulo** (usar kebab-case descritivo, ex: `adjetivos-espelho`, `frase-proposito`, `nivel-confianca`)
2. O HTML ao redor das tags continua sendo HTML normal (`<h2>`, `<h3>`, `<p>`, `<blockquote>`, `<mark>`, `<strong>`, `<em>`, `<ul>`, `<ol>`, `<li>`, `<hr>`, `<img>`)
3. Use `<hr>` para separar secoes visuais do exercicio
4. Inclua instrucoes contextuais em `<p>` antes de cada campo para guiar o colaborador
5. Use `<blockquote>` para dicas, lembretes e reflexoes
6. Pense na **experiencia**: o colaborador preenche tudo ali, salva, e pode revisitar depois
7. **NAO** use tags `<input-*>` dentro de `<blockquote>`, `<ul>` ou `<ol>` — elas devem estar no nivel raiz do HTML
8. As tags `<input-*>` sao self-closing (`/>`) ou podem ter closing tag (`</input-field>`)

#### Exemplo completo de `instrucaoCard` com workbook

```html
<h2>Discovery de Marca Pessoal</h2>
<p>Este exercicio vai te ajudar a descobrir os pilares da sua marca pessoal. Preencha cada secao com calma e honestidade — nao existe resposta errada.</p>

<hr>

<h3>1. Autoconhecimento</h3>
<p>Liste <strong>5 adjetivos</strong> que as pessoas usam para descrever voce profissionalmente:</p>
<input-list id="adjetivos-espelho" items="5" placeholder="Ex: estrategico, criativo, direto..." />

<p>Agora, liste <strong>5 adjetivos</strong> que voce gostaria que usassem:</p>
<input-list id="adjetivos-desejados" items="5" placeholder="Ex: visionario, inspirador..." />

<blockquote>Dica: compare as duas listas. Onde ha convergencia? Onde ha gap? Esse gap e seu territorio de crescimento.</blockquote>

<p>Avalie o alinhamento entre as listas:</p>
<input-select id="nivel-alinhamento" options="Verde: Alta convergencia, Amarelo: Convergencia parcial, Vermelho: Gap significativo" />

<hr>

<h3>2. Proposito</h3>
<p>Complete a frase: <mark>Eu ajudo [quem] a [fazer o que] para que [resultado].</mark></p>
<input-area id="frase-proposito" placeholder="Ex: Eu ajudo lideranças de RH a transformar cultura organizacional para que empresas retenham talentos..." rows="3" />

<hr>

<h3>3. Diferenciais</h3>
<p>O que voce faz que <strong>ninguem mais</strong> no seu mercado faz da mesma forma?</p>
<input-area id="diferencial-unico" placeholder="Pense no que te torna diferente dos outros profissionais da sua area..." rows="4" />

<p>Quais sao suas <strong>3 maiores conquistas profissionais</strong>?</p>
<input-list id="conquistas-top3" items="3" placeholder="Descreva brevemente cada conquista..." />

<hr>

<h3>4. Reflexao Final</h3>
<p>Em uma frase, como voce quer ser lembrado profissionalmente?</p>
<input-field id="legado-frase" placeholder="Ex: O lider que transformou a forma como empresas pensam em pessoas." />

<blockquote>Guarde essas respostas. Elas serao a base para construir seu posicionamento e tom de voz no LinkedIn.</blockquote>
```

#### Dicas para o agente

- **Varie os tipos de campo**: use `input-field` para respostas curtas, `input-area` para reflexoes longas, `input-list` para brainstorming, `input-select` para autoavaliacao
- **Crie uma narrativa**: o workbook deve ter um fluxo logico, guiando o colaborador de reflexao em reflexao
- **Use blockquotes estrategicamente**: dicas que ajudam o colaborador a pensar melhor, nao respostas prontas
- **Limite de campos**: entre 8 e 15 campos por workbook e o ideal. Menos pode ser raso, mais pode ser cansativo
- **IDs descritivos**: use nomes que facam sentido se voce ler o JSON cru (ex: `frase-proposito`, nao `campo-7`)
- **Placeholders que inspiram**: use exemplos reais nos placeholders para ajudar o colaborador a comecar

---

## Integracao no JSON da trilha

O workbook e um modulo `faca_voce_mesmo` normal. O campo `instrucaoCard` contem o HTML com as tags customizadas. A plataforma detecta automaticamente que e um workbook quando o HTML contem `<input-field>`, `<input-area>`, `<input-list>` ou `<input-select>`.

```json
{
  "id": "m5",
  "titulo": "Discovery de Marca Pessoal",
  "modo": "faca_voce_mesmo",
  "ordem": 5,
  "obrigatorio": true,
  "pontuacaoBase": 0,
  "pontuacaoBonus": 0,
  "instrucaoCard": "<h2>Discovery de Marca Pessoal</h2>..."
}
```

Nao ha mudanca no tipo do modulo. Se o `instrucaoCard` contem tags `<input-*>`, o player renderiza como workbook. Se nao contem, renderiza como texto normal.
