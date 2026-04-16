# LinkedIn Mention/Tagging — Spec de Implementação

> **Status:** Aguardando acesso à Community Management API do LinkedIn.
> **Última atualização:** Abril 2026

---

## Objetivo

Permitir que a usuária marque pessoas ou empresas em posts publicados pela API do LinkedIn, usando uma experiência simples no editor mas publicando no formato nativo de mention (`@[Nome](urn:li:person:ID)`).

---

## Dependência Bloqueante

A resolução de URN (transformar URL de perfil em `urn:li:person:XXX`) requer a **People Typeahead API**, que faz parte do **Community Management API** do LinkedIn. A Boldfy ainda não tem acesso a esse tier.

Quando o acesso for liberado, essa feature pode ser implementada junto com as melhorias de métricas de engajamento.

---

## Fluxo Técnico

### Etapa 1: Capturar links no editor

No editor de conteúdo (tanto estrategista quanto colaborador), adicionar um **botão fixo de "Inserir Link"** na barra de ferramentas. O fluxo:

1. Usuária seleciona um nome no texto (ex: "Clara Ramos")
2. Clica no botão de link
3. Cola a URL do perfil LinkedIn (ex: `https://www.linkedin.com/in/clararamosm/`)
4. O texto fica visualmente marcado como link no editor

O conteúdo é salvo com `<a>` tags no campo `caption`:
```html
Concordo muito com <a href="https://www.linkedin.com/in/clararamosm/">Clara Ramos</a> sobre isso.
```

### Etapa 2: Identificar links candidatos a mention

Antes de publicar, filtrar hyperlinks que são do LinkedIn:
- Perfil pessoal: URL contém `/in/`
- Página de empresa: URL contém `/company/`

Links que não são do LinkedIn são tratados como texto normal.

### Etapa 3: Resolver URL para URN

Usando a **People Typeahead API**:

```
GET https://api.linkedin.com/v2/people?q=typeahead&query={vanityName}
```

Para cada link do LinkedIn:
1. Extrair a vanity do link (ex: `clararamosm`)
2. Consultar a API
3. Receber o `personUrn` (ex: `urn:li:person:123456789`)
4. Validar que o nome retornado bate com o texto visível

Para empresas: resolver para `urn:li:organization:...`

### Etapa 4: Gerar o commentary

Substituir os trechos anotados pelo formato LinkedIn:
```
Concordo muito com @[Clara Ramos](urn:li:person:123456789) sobre isso.
```

### Etapa 5: Publicar

Enviar via `POST /rest/posts` com o `commentary` formatado.

---

## Fallbacks

### URL não resolve URN
- Publicar como texto normal (sem menção)
- Opcionalmente avisar na interface: "não foi possível confirmar essa menção"

### Nome não bate com a entidade
- A Posts API exige correspondência entre o texto anotado e o nome da entidade
- Para membros: aceita primeiro nome, sobrenome ou nome completo (case-sensitive)
- Para organizações: precisa bater com o nome completo
- Se não bater: publicar como texto normal

### Múltiplas menções
- Converter cada uma individualmente antes de montar o commentary

---

## Modificações Necessárias no Código

### Frontend — Editor de Conteúdo

**Arquivos:**
- `src/app/colaborador/calendario/novo/page.tsx` — Editor do colaborador
- `src/components/post-editor/post-body-editor.tsx` — Editor do estrategista

**Mudanças:**
- Trocar `<Textarea>` por editor que suporte `<a>` tags (contentEditable ou lib como Tiptap)
- Adicionar botão "Inserir Link" fixo na barra de info
- Salvar `caption` com HTML incluindo `<a>` tags
- Permitir sanitização que preserve `<a>` tags com `href`

### Backend — Serviço de Resolução

**Novo arquivo:** `src/lib/mention-resolver.ts`

```typescript
// MentionResolverService
export function extractLinkedInEntityFromUrl(url: string): {
  type: 'person' | 'organization';
  vanity: string;
} | null

export async function resolveUrn(
  accessToken: string,
  entityType: 'person' | 'organization',
  vanity: string
): Promise<string | null>  // returns URN or null

export function buildLinkedInCommentary(
  text: string,
  mentions: Array<{
    displayText: string;
    startIndex: number;
    endIndex: number;
    urn: string;
  }>
): string
```

### Backend — Pipeline de Publicação

**Arquivo:** `src/lib/linkedin.ts`

**Mudanças no `htmlToLinkedInText()`:**
- Antes de strippar HTML, extrair `<a>` tags cujo `href` é do LinkedIn
- Guardar o texto, posição e URL de cada link
- Converter para formato de mention no commentary

**Mudanças no `publishLinkedInPost()`:**
- Adicionar passo de resolução de menções entre sanitização e publicação
- Pipeline: HTML → extrair links LinkedIn → resolver URNs → montar commentary → publicar

### Modelo de Dados

Nenhuma mudança no schema do Firestore. As menções ficam embutidas no campo `caption` como HTML e no `commentary` como formato LinkedIn.

Opcionalmente, para cache de URNs já resolvidos:
```typescript
// Collection: companies/{companyId}/linkedinUrnCache/{vanity}
{
  vanity: string;
  urn: string;
  name: string;
  entityType: 'person' | 'organization';
  resolvedAt: string;  // ISO
}
```

---

## MVP vs Versão Ideal

### MVP (quando API disponível)
- Botão de link no editor → colar URL do LinkedIn
- Extrair vanity URL
- Resolver URN via API
- Gerar commentary com `@[Nome](urn:...)`
- Fallback para texto normal quando resolução falhar

### V2
- Autocomplete de pessoas/empresas ao digitar `@`
- Preview da menção no editor
- Cache de URNs já resolvidos
- Validação de nome em tempo real
