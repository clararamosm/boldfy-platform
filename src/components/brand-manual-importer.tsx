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
 * Supports: "1. Title — Description", "- Title: Description", "• Title - Description"
 * Returns [{ title, description }].
 */
function extractTitleDescPairs(text: string): Array<{ title: string; description: string }> {
  const pairs: Array<{ title: string; description: string }> = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let currentTitle = '';
  let currentDesc = '';

  for (const line of lines) {
    // Match patterns like: "1. Title — Desc", "- Title: Desc", "• Title – Desc", "**Title** — Desc"
    const match = line.match(
      /^(?:\d+[\.\)]\s*|\-\s*|\•\s*|\*\s*)?(?:\*\*)?([^:—–\-\n*]+?)(?:\*\*)?\s*(?:[:—–\-])\s*(.+)/
    );
    if (match) {
      if (currentTitle) pairs.push({ title: currentTitle.trim(), description: currentDesc.trim() });
      currentTitle = match[1];
      currentDesc = match[2];
    } else if (/^(?:\d+[\.\)]\s*|\-\s*|\•\s*|\*\s*)/.test(line)) {
      // Numbered/bulleted line without separator — use whole line as title
      if (currentTitle) pairs.push({ title: currentTitle.trim(), description: currentDesc.trim() });
      currentTitle = line.replace(/^(?:\d+[\.\)]\s*|\-\s*|\•\s*|\*\s*)/, '').replace(/^\*\*|\*\*$/g, '');
      currentDesc = '';
    } else if (currentTitle) {
      // Continuation line
      currentDesc += ' ' + line;
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

export function parseBrandManualText(rawText: string): Partial<BrandManualData> {
  const result: Partial<BrandManualData> = {};

  // Split into top-level sections by markdown headings (##, ###) or **bold headings**
  const headingPattern = /\n(?:#{1,3}\s+(.+?)(?:\n|$)|\*\*\s*(\d+[\.\)]\s*)?(.+?)\s*\*\*\s*(?:\n|$))/;
  const sections = splitSections('\n' + rawText, headingPattern);

  // Merge heading captures (either from # or **)
  const normalised = sections.map(s => ({
    heading: s.heading,
    body: s.body,
  }));

  for (const { heading, body } of normalised) {
    const h = norm(heading);

    // ── Personalidade ──
    if (headingMatches(heading, ['personalidade', 'personality'])) {
      // Body may contain "Atributos" subsection
      const attrSplit = body.split(/(?:atributos|attributes|top\s*3)/i);
      const description = trimLines(attrSplit[0] || '');
      const attrText = attrSplit[1] || '';
      const attributes = extractTitleDescPairs(attrText);

      result.personality = {
        description: description || body.slice(0, 500),
        attributes: attributes.length > 0 ? attributes : [{ title: '', description: '' }],
      };
    }

    // ── Mindset ──
    else if (headingMatches(heading, ['mindset', 'mentalidade', 'principio'])) {
      const items = extractTitleDescPairs(body);
      if (items.length > 0) result.mindset = items;
    }

    // ── Arquétipos ──
    else if (headingMatches(heading, ['arquetipo', 'archetype'])) {
      const primaryMatch = body.match(/(?:prim[aá]rio|primary)\s*[:\-—–]?\s*\*?\*?([^*\n]+)/i);
      const secondaryMatch = body.match(/(?:secund[aá]rio|secondary)\s*[:\-—–]?\s*\*?\*?([^*\n]+)/i);

      // Try to extract descriptions after the titles
      const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
      let primaryTitle = primaryMatch?.[1]?.trim() || '';
      let primaryDesc = '';
      let secondaryTitle = secondaryMatch?.[1]?.trim() || '';
      let secondaryDesc = '';

      let phase: 'none' | 'primary' | 'secondary' = 'none';
      for (const line of lines) {
        if (/prim[aá]rio|primary/i.test(line)) {
          phase = 'primary';
          const titleMatch = line.match(/[:\-—–]\s*(.+)/);
          if (titleMatch) primaryTitle = titleMatch[1].replace(/\*\*/g, '').trim();
          continue;
        }
        if (/secund[aá]rio|secondary/i.test(line)) {
          phase = 'secondary';
          const titleMatch = line.match(/[:\-—–]\s*(.+)/);
          if (titleMatch) secondaryTitle = titleMatch[1].replace(/\*\*/g, '').trim();
          continue;
        }
        if (phase === 'primary') primaryDesc += line + ' ';
        else if (phase === 'secondary') secondaryDesc += line + ' ';
      }

      result.archetypes = {
        primary: { title: primaryTitle, description: primaryDesc.trim() },
        secondary: { title: secondaryTitle, description: secondaryDesc.trim() },
      };
    }

    // ── Tom de Voz ──
    else if (headingMatches(heading, ['tom de voz', 'tone of voice', 'tom'])) {
      const items = extractTitleDescPairs(body);
      if (items.length > 0) result.toneOfVoice = items;
    }

    // ── Estilo de Escrita / Linguagem ──
    else if (headingMatches(heading, ['estilo', 'linguagem', 'language', 'style', 'escrita'])) {
      const items = extractTitleDescPairs(body);
      if (items.length > 0) result.languageStyle = items;
    }

    // ── Do's & Don'ts / Boas Práticas ──
    else if (headingMatches(heading, ['do s', 'don t', 'boas praticas', 'best practice', 'dos donts'])) {
      const dosSection = body.split(/(?:don'?t|evitar|nao fazer|🚫)/i);
      const dosText = dosSection[0] || '';
      const dontsText = dosSection.slice(1).join('\n') || '';

      const dos = extractListItems(dosText);
      const donts = extractListItems(dontsText);

      result.bestPractices = {
        dos: dos.length > 0 ? dos : [''],
        donts: donts.length > 0 ? donts : [''],
      };
    }

    // ── Vocabulário ──
    else if (headingMatches(heading, ['vocabulario', 'vocabulary', 'keyword', 'palavra'])) {
      const evitarSplit = body.split(/(?:evitar|avoid|palavras?\s+(?:a\s+)?evitar)/i);
      const keywordsText = evitarSplit[0] || '';
      const expressionsText = evitarSplit[1] || body;

      // Extract keywords from first section, expressions from "Frase Assinatura" or second part
      const signatureSplit = keywordsText.split(/(?:frase\s+assinatura|signature)/i);
      const rawKeywords = extractListItems(signatureSplit[0] || '');
      const rawExpressions = extractListItems(expressionsText || '');
      const signature = signatureSplit[1] ? extractListItems(signatureSplit[1]) : [];

      result.vocabulary = {
        keywords: rawKeywords.length > 0 ? rawKeywords : [''],
        expressions: [...rawExpressions, ...signature].length > 0 ? [...rawExpressions, ...signature] : [''],
      };
    }

    // ── Resumo / Posicionamento ──
    else if (headingMatches(heading, ['resumo', 'summary', 'posicionamento', 'positioning', 'proposta de valor', 'value proposition'])) {
      // Try to find sub-fields
      const posMatch = body.match(/(?:posicionamento|positioning)\s*[:\-—–]\s*(.+?)(?:\n|$)/i);
      const valMatch = body.match(/(?:proposta de valor|value proposition)\s*[:\-—–]\s*(.+?)(?:\n|$)/i);
      const difMatch = body.match(/(?:diferencial|differential|differentiator)\s*[:\-—–]\s*(.+?)(?:\n|$)/i);
      const misMatch = body.match(/(?:miss[aã]o|mission)\s*[:\-—–]\s*(.+?)(?:\n|$)/i);

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
