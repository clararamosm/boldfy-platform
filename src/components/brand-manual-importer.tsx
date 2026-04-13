// src/components/brand-manual-importer.tsx
// Modal to paste raw brand manual text and auto-parse into BrandManualData fields.
// The parser recognises section headings from the brand-manual-writer skill output.

'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ClipboardPaste, HelpCircle, Loader2, Copy, Check } from 'lucide-react';
import type { BrandManualData } from '@/app/actions/content-strategy';

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

/** Trim blank lines at start/end and normalize whitespace. */
function trimLines(s: string): string {
  return s.replace(/^\s*\n/, '').replace(/\n\s*$/, '').trim();
}

/**
 * Split text by a regex for section headings.
 * Returns array of { heading, body }.
 */
function splitSections(text: string, pattern: RegExp): Array<{ heading: string; body: string }> {
  const sections: Array<{ heading: string; body: string }> = [];
  const parts = text.split(pattern);

  // parts[0] = text before first heading (usually empty)
  // then alternates: heading, body, heading, body …
  for (let i = 1; i < parts.length; i += 2) {
    const heading = (parts[i] || '').trim();
    const body = (parts[i + 1] || '').trim();
    if (heading) sections.push({ heading, body });
  }
  return sections;
}

/**
 * Extract numbered or bulleted list items from text.
 * Supports many formats:
 *   "1. Title — Description"
 *   "- Title: Description"
 *   "1. Title, description continues here"
 *   "• Title – Description"
 * Returns [{ title, description }].
 */
function extractTitleDescPairs(text: string): Array<{ title: string; description: string }> {
  const pairs: Array<{ title: string; description: string }> = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let currentTitle = '';
  let currentDesc = '';

  for (const line of lines) {
    // Strip markdown bold
    const clean = line.replace(/\*\*/g, '');

    // Try: "1. Title — Desc", "- Title: Desc", "• Title – Desc"
    const matchSep = clean.match(
      /^(?:\d+[\.\)]\s*|\-\s*|\•\s*|\*\s*)?([^:—–\n]+?)\s*(?:[:—–])\s*(.+)/
    );
    if (matchSep) {
      if (currentTitle) pairs.push({ title: currentTitle.trim(), description: currentDesc.trim() });
      currentTitle = matchSep[1].trim();
      currentDesc = matchSep[2].trim();
      continue;
    }

    // Try: "1. Title, description continues" (comma as separator, first part <= 40 chars)
    const matchComma = clean.match(
      /^(?:\d+[\.\)]\s*|\-\s*|\•\s*|\*\s*)([^,\n]{2,40}),\s*(.+)/
    );
    if (matchComma) {
      if (currentTitle) pairs.push({ title: currentTitle.trim(), description: currentDesc.trim() });
      currentTitle = matchComma[1].trim();
      currentDesc = matchComma[2].trim();
      continue;
    }

    // Numbered/bulleted line without any separator — use whole line as title
    if (/^(?:\d+[\.\)]\s*|\-\s*|\•\s*|\*\s*)/.test(clean)) {
      if (currentTitle) pairs.push({ title: currentTitle.trim(), description: currentDesc.trim() });
      currentTitle = clean.replace(/^(?:\d+[\.\)]\s*|\-\s*|\•\s*|\*\s*)/, '').trim();
      currentDesc = '';
      continue;
    }

    // Continuation line (no bullet/number prefix)
    if (currentTitle) {
      currentDesc += (currentDesc ? ' ' : '') + clean;
    }
  }
  if (currentTitle) pairs.push({ title: currentTitle.trim(), description: currentDesc.trim() });

  return pairs;
}

/**
 * Extract simple list items (strings) from text lines.
 */
function extractListItems(text: string): string[] {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => l.replace(/^(?:\d+[\.\)]\s*|\-\s*|\•\s*|\*\s*|✅\s*|🚫\s*)/, '').replace(/^\*\*|\*\*$/g, '').trim())
    .filter(Boolean);
}

/**
 * Normalise heading text for matching.
 */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function headingMatches(heading: string, keywords: string[]): boolean {
  const h = norm(heading);
  return keywords.some(k => h.includes(k));
}

// ────────────────────────────────────────────
// Main parser
// ────────────────────────────────────────────

// Known section names to search for (order matters — first match wins).
// Each entry: [keywords to match, canonical key].
const KNOWN_SECTIONS: Array<[string[], string]> = [
  [['personalidade da marca', 'personalidade', 'personality'], 'personalidade'],
  [['mindset', 'mentalidade'], 'mindset'],
  [['arquetipos', 'arquétipos', 'archetypes', 'arquetipo'], 'arquetipos'],
  [['tom de voz', 'tone of voice'], 'tom'],
  [['estilo de escrita', 'estilo', 'linguagem e estilo', 'language style'], 'estilo'],
  [['do\'s & don\'ts', 'dos & don\'ts', 'dos e don\'ts', 'do\'s & don\'ts', 'boas praticas', 'boas práticas', 'do s don t'], 'dos_donts'],
  [['vocabulario', 'vocabulário', 'vocabulary', 'palavras-chave'], 'vocabulario'],
  [['resumo', 'summary'], 'resumo'],
];

/**
 * Find section boundaries in the text by looking for known headings.
 * Works with any format: "## Heading", "**Heading**", or plain "Heading" on its own line.
 */
function findSections(text: string): Array<{ key: string; heading: string; body: string }> {
  const lines = text.split('\n');
  const found: Array<{ key: string; heading: string; lineIndex: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    // Strip markdown formatting from the line for matching
    const raw = lines[i]
      .replace(/^#{1,4}\s*/, '')    // remove ## prefixes
      .replace(/\*\*/g, '')         // remove bold markers
      .trim();

    if (!raw || raw.length > 60) continue; // Skip long lines (body text, not headings)

    const normalised = norm(raw);

    for (const [keywords, key] of KNOWN_SECTIONS) {
      // Check if already found (first match wins)
      if (found.some(f => f.key === key)) continue;

      const matches = keywords.some(kw => {
        const nkw = norm(kw);
        return normalised === nkw || normalised.startsWith(nkw);
      });

      if (matches) {
        found.push({ key, heading: raw, lineIndex: i });
        break;
      }
    }
  }

  // Sort by line index and extract bodies (text between headings)
  found.sort((a, b) => a.lineIndex - b.lineIndex);

  return found.map((sec, idx) => {
    const startLine = sec.lineIndex + 1;
    const endLine = idx < found.length - 1 ? found[idx + 1].lineIndex : lines.length;
    const body = lines.slice(startLine, endLine).join('\n').trim();
    return { key: sec.key, heading: sec.heading, body };
  });
}

export function parseBrandManualText(rawText: string): Partial<BrandManualData> {
  const result: Partial<BrandManualData> = {};
  const sections = findSections(rawText);

  for (const { key, body } of sections) {
    // ── Personalidade ──
    if (key === 'personalidade') {
      // Body may contain "Atributos" subsection
      const attrSplit = body.split(/\n\s*(?:#{1,3}\s*)?(?:\*\*)?(?:atributos|attributes|top\s*3\s*atributos?)(?:\*\*)?\s*\n?/i);
      const description = trimLines(attrSplit[0] || '');
      const attrText = attrSplit[1] || '';
      const attributes = extractTitleDescPairs(attrText);

      result.personality = {
        description: description || body.slice(0, 500),
        attributes: attributes.length > 0 ? attributes : [{ title: '', description: '' }],
      };
    }

    // ── Mindset ──
    else if (key === 'mindset') {
      const items = extractTitleDescPairs(body);
      if (items.length > 0) result.mindset = items;
    }

    // ── Arquétipos ──
    else if (key === 'arquetipos') {
      const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
      let primaryTitle = '';
      let primaryDesc = '';
      let secondaryTitle = '';
      let secondaryDesc = '';

      let phase: 'none' | 'primary' | 'secondary' = 'none';
      for (const line of lines) {
        const cleanLine = line.replace(/\*\*/g, '');
        if (/prim[aá]rio/i.test(cleanLine)) {
          phase = 'primary';
          // Extract title: "Primário: Sábio" or "Primário — Sábio"
          const titleMatch = cleanLine.match(/prim[aá]rio\s*[:\-—–]\s*(.+)/i);
          if (titleMatch) primaryTitle = titleMatch[1].trim();
          else {
            // Title might be the rest of the line after "Primário"
            const rest = cleanLine.replace(/.*prim[aá]rio\s*/i, '').trim();
            if (rest) primaryTitle = rest;
          }
          continue;
        }
        if (/secund[aá]rio/i.test(cleanLine)) {
          phase = 'secondary';
          const titleMatch = cleanLine.match(/secund[aá]rio\s*[:\-—–]\s*(.+)/i);
          if (titleMatch) secondaryTitle = titleMatch[1].trim();
          else {
            const rest = cleanLine.replace(/.*secund[aá]rio\s*/i, '').trim();
            if (rest) secondaryTitle = rest;
          }
          continue;
        }
        // Skip "Arquétipo em Ação" sub-header and table rows
        if (/em a[cç][aã]o/i.test(cleanLine)) break;

        if (phase === 'primary') primaryDesc += cleanLine + ' ';
        else if (phase === 'secondary') secondaryDesc += cleanLine + ' ';
      }

      result.archetypes = {
        primary: { title: primaryTitle, description: primaryDesc.trim() },
        secondary: { title: secondaryTitle, description: secondaryDesc.trim() },
      };
    }

    // ── Tom de Voz ──
    else if (key === 'tom') {
      const items = extractTitleDescPairs(body);
      if (items.length > 0) result.toneOfVoice = items;
    }

    // ── Estilo de Escrita / Linguagem ──
    else if (key === 'estilo') {
      const items = extractTitleDescPairs(body);
      if (items.length > 0) result.languageStyle = items;
    }

    // ── Do's & Don'ts ──
    else if (key === 'dos_donts') {
      // Split by 🚫 emoji — everything before is Do's, after is Don'ts
      const firstProhibit = body.indexOf('🚫');
      let dosText: string;
      let dontsText: string;

      if (firstProhibit >= 0) {
        dosText = body.slice(0, firstProhibit);
        dontsText = body.slice(firstProhibit);
      } else {
        // Try splitting by "Don't" or "Evitar" header
        const splitMatch = body.match(/\n\s*(?:#{1,3}\s*)?(?:\*\*)?(?:don'?t|evitar|nao fazer)s?(?:\*\*)?\s*(?:\(.*?\))?\s*\n/i);
        if (splitMatch && splitMatch.index !== undefined) {
          dosText = body.slice(0, splitMatch.index);
          dontsText = body.slice(splitMatch.index);
        } else {
          dosText = body;
          dontsText = '';
        }
      }

      const dos = extractListItems(dosText);
      const donts = extractListItems(dontsText);

      result.bestPractices = {
        dos: dos.length > 0 ? dos : [''],
        donts: donts.length > 0 ? donts : [''],
      };
    }

    // ── Vocabulário ──
    else if (key === 'vocabulario') {
      // Split by "Expressões" or "Expressoes" sub-header
      const exprSplit = body.split(/\n\s*(?:#{1,3}\s*)?(?:\*\*)?(?:express[oõ]es|expressions|frase\s+assinatura)(?:\*\*)?\s*\n?/i);
      const keywordsText = exprSplit[0] || '';
      const expressionsText = exprSplit.slice(1).join('\n') || '';

      // Remove sub-headers like "Palavras-chave" from keyword text
      const cleanKeywordsText = keywordsText.replace(/(?:#{1,3}\s*)?(?:\*\*)?(?:palavras?[\s-]*chave)(?:\*\*)?\s*/gi, '');

      const rawKeywords = extractListItems(cleanKeywordsText);
      const rawExpressions = extractListItems(expressionsText);

      result.vocabulary = {
        keywords: rawKeywords.length > 0 ? rawKeywords : [''],
        expressions: rawExpressions.length > 0 ? rawExpressions : [''],
      };
    }

    // ── Resumo ──
    else if (key === 'resumo') {
      // Multi-line field values: "Posicionamento: text that may span\nmultiple lines"
      // Use greedy match up to next field label or end
      const fieldPattern = (label: string) => {
        const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`${escaped}\\s*[:\\-—–]\\s*([\\s\\S]*?)(?=\\n\\s*(?:Proposta de Valor|Diferencial|Miss[aã]o|Posicionamento)\\s*[:\\-—–]|$)`, 'i');
      };

      const posMatch = body.match(fieldPattern('Posicionamento'));
      const valMatch = body.match(fieldPattern('Proposta de Valor'));
      const difMatch = body.match(fieldPattern('Diferencial'));
      const misMatch = body.match(fieldPattern('Miss[aã]o'));

      result.summary = {
        positioning: posMatch?.[1]?.trim() || '',
        valueProposition: valMatch?.[1]?.trim() || '',
        differential: difMatch?.[1]?.trim() || '',
        mission: misMatch?.[1]?.trim() || '',
      };

      // If no sub-fields found, put entire body as positioning
      if (!posMatch && !valMatch && !difMatch && !misMatch) {
        result.summary = {
          positioning: trimLines(body).slice(0, 1000),
          valueProposition: '',
          differential: '',
          mission: '',
        };
      }
    }
  }

  return result;
}

// ────────────────────────────────────────────
// Component
// ────────────────────────────────────────────

const TEMPLATE_TEXT = `## Personalidade da Marca
[Descrição geral de quem é a pessoa no mercado — 2-3 parágrafos]

### Atributos
1. Nome do Atributo — Descrição de como esse atributo se manifesta
2. Nome do Atributo — Descrição de como esse atributo se manifesta
3. Nome do Atributo — Descrição de como esse atributo se manifesta

## Mindset
1. Nome do Princípio — Explicação do princípio e por que importa
2. Nome do Princípio — Explicação do princípio e por que importa
3. Nome do Princípio — Explicação do princípio e por que importa
4. Nome do Princípio — Explicação do princípio e por que importa
5. Nome do Princípio — Explicação do princípio e por que importa

## Arquétipos
Primário: Nome do Arquétipo
Como se manifesta no conteúdo e comunicação da marca.

Secundário: Nome do Arquétipo
Como complementa o primário e quando aparece.

## Tom de Voz
1. Nome do Tom — Quando e como aparece na comunicação
2. Nome do Tom — Quando e como aparece na comunicação
3. Nome do Tom — Quando e como aparece na comunicação
4. Nome do Tom — Quando e como aparece na comunicação

## Estilo de Escrita
1. Estrutura — Como organiza os textos
2. Complexidade — Nível de linguagem e uso de jargões
3. Foco do Conteúdo — Ponto focal principal
4. Abordagem — Como os tópicos são tratados

## Do's & Don'ts
✅ Primeira boa prática a seguir
✅ Segunda boa prática a seguir
✅ Terceira boa prática a seguir
✅ Quarta boa prática a seguir
✅ Quinta boa prática a seguir
🚫 Primeira coisa a evitar
🚫 Segunda coisa a evitar
🚫 Terceira coisa a evitar
🚫 Quarta coisa a evitar
🚫 Quinta coisa a evitar

## Vocabulário
### Palavras-chave
- Palavra 1
- Palavra 2
- Palavra 3

### Expressões
- Expressão ou frase assinatura 1
- Expressão ou frase assinatura 2

## Resumo
Posicionamento: Como essa pessoa se posiciona no mercado
Proposta de Valor: O valor único que entrega à audiência
Diferencial: O que diferencia das demais vozes
Missão: A missão que guia a comunicação`;

type BrandManualImporterProps = {
  onImport: (data: Partial<BrandManualData>) => void;
};

export function BrandManualImporter({ onImport }: BrandManualImporterProps) {
  const [open, setOpen] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [text, setText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleImport = () => {
    if (!text.trim()) return;
    setIsParsing(true);

    // Parse in a timeout to allow UI update
    setTimeout(() => {
      const parsed = parseBrandManualText(text);
      onImport(parsed);
      setIsParsing(false);
      setText('');
      setOpen(false);
      setShowTemplate(false);
    }, 100);
  };

  const handleCopyTemplate = async () => {
    await navigator.clipboard.writeText(TEMPLATE_TEXT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-1.5">
      {/* Template info button */}
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Ver template de formatação">
            <HelpCircle className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Template de Formatação</DialogTitle>
            <DialogDescription>
              Use este template para formatar o manual de marca antes de importar.
              Copie, preencha as seções e cole no botão &quot;Importar Texto&quot;.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <pre className="bg-muted/50 border rounded-lg p-4 text-xs font-mono whitespace-pre-wrap leading-relaxed">{TEMPLATE_TEXT}</pre>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleCopyTemplate}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copiado!' : 'Copiar Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setShowTemplate(false); }}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <ClipboardPaste className="h-4 w-4" />
            Importar Texto
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Importar Manual de Marca</DialogTitle>
            <DialogDescription>
              Cole o texto completo do manual de marca abaixo. As seções serão
              identificadas automaticamente e os campos preenchidos.
            </DialogDescription>
          </DialogHeader>

          {showTemplate && (
            <div className="border rounded-lg bg-muted/30 p-3 max-h-[200px] overflow-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Template de referência</span>
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={handleCopyTemplate}>
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
              <pre className="text-[10px] font-mono whitespace-pre-wrap leading-relaxed text-muted-foreground">{TEMPLATE_TEXT}</pre>
            </div>
          )}

          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Cole aqui o texto completo do Manual de Marca..."
            className="flex-1 min-h-[300px] font-mono text-sm"
            disabled={isParsing}
          />
          <DialogFooter className="flex-row justify-between sm:justify-between">
            <Button
              variant="link"
              size="sm"
              className="text-xs text-muted-foreground px-0"
              onClick={() => setShowTemplate(!showTemplate)}
            >
              {showTemplate ? 'Ocultar template' : 'Ver template de formatação'}
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={isParsing}>
                Cancelar
              </Button>
              <Button onClick={handleImport} disabled={isParsing || !text.trim()}>
                {isParsing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Preencher Campos
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
