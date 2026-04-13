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
import { ClipboardPaste, Loader2 } from 'lucide-react';
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

type BrandManualImporterProps = {
  onImport: (data: Partial<BrandManualData>) => void;
};

export function BrandManualImporter({ onImport }: BrandManualImporterProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [isParsing, setIsParsing] = useState(false);

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
    }, 100);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Cole aqui o texto completo do Manual de Marca...\n\nExemplo de formato esperado:\n\n## Personalidade da Marca\nQuem é [nome] no mercado...\n\n## Mindset\n1. Princípio — Descrição...\n\n## Arquétipos\nPrimário: Nome — Descrição...\n\n## Tom de Voz\n1. Tom — Descrição...\n\n## Estilo de Escrita\n...\n\n## Do's & Don'ts\n✅ Fazer...\n🚫 Evitar...\n\n## Vocabulário\nPalavras-chave...\n\n## Resumo\nPosicionamento: ...\nProposta de Valor: ...`}
          className="flex-1 min-h-[300px] font-mono text-sm"
          disabled={isParsing}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isParsing}>
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={isParsing || !text.trim()}>
            {isParsing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Preencher Campos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
