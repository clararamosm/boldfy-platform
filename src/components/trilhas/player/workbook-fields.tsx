// src/components/trilhas/player/workbook-fields.tsx
'use client';

import type { ReactNode } from 'react';
import type { FieldChunk, AreaChunk, ListChunk, SelectChunk, WorkbookChunk } from './workbook-parser';

// ─── Shared styles ──────────────────────────────────────────
const inputBase =
  'w-full border border-purple-200 rounded-lg px-3.5 font-sans text-sm text-foreground bg-[#fdfbff] outline-none transition-all duration-200 placeholder:text-purple-300 placeholder:italic focus:border-purple-400 focus:ring-2 focus:ring-purple-400/15';

const inputFilled =
  'bg-purple-50/60 border-purple-300 text-purple-900';

// Wrappa label + input num bloco compacto. O parser absorve o <label for="ID">
// que vem imediatamente antes do <input-X id="ID"> e passa como prop `label`.
// Assim a label fica colada visualmente ao input em vez de ficar separada pelo
// space-y-6 do container do workbook.
function FieldWithLabel({ label, htmlFor, children }: { label?: string; htmlFor?: string; children: ReactNode }) {
  if (!label) return <>{children}</>;
  return (
    <div className="space-y-2">
      <label
        htmlFor={htmlFor}
        className="block text-base text-foreground leading-relaxed [&_strong]:font-semibold [&_em]:italic"
        dangerouslySetInnerHTML={{ __html: label }}
      />
      {children}
    </div>
  );
}

// ─── InputField (single line) ───────────────────────────────
function WorkbookInputField({
  id, placeholder, label, value, onChange,
}: FieldChunk & { value: string; onChange: (id: string, value: string) => void }) {
  const filled = value?.trim().length > 0;
  return (
    <FieldWithLabel label={label} htmlFor={id}>
      <input
        id={id}
        type="text"
        className={`${inputBase} h-[42px] ${filled ? inputFilled : ''}`}
        placeholder={placeholder || 'Digite aqui...'}
        value={value || ''}
        onChange={(e) => onChange(id, e.target.value)}
      />
    </FieldWithLabel>
  );
}

// ─── InputArea (textarea) ───────────────────────────────────
function WorkbookInputArea({
  id, placeholder, rows, label, value, onChange,
}: AreaChunk & { value: string; onChange: (id: string, value: string) => void }) {
  const filled = value?.trim().length > 0;
  return (
    <FieldWithLabel label={label} htmlFor={id}>
      <textarea
        id={id}
        className={`${inputBase} py-3 leading-relaxed resize-y border-dashed ${filled ? `${inputFilled} !border-solid` : ''}`}
        style={{ minHeight: rows ? `${rows * 28}px` : '100px' }}
        placeholder={placeholder || 'Escreva aqui...'}
        value={value || ''}
        onChange={(e) => onChange(id, e.target.value)}
      />
    </FieldWithLabel>
  );
}

// ─── InputList (N numbered inputs) ──────────────────────────
function WorkbookInputList({
  id, items, placeholder, label, values, onChange,
}: ListChunk & { values: string[]; onChange: (id: string, values: string[]) => void }) {
  // Ensure array has correct length
  const safeValues = Array.from({ length: items }, (_, i) => values?.[i] || '');

  const handleItemChange = (index: number, newValue: string) => {
    const updated = [...safeValues];
    updated[index] = newValue;
    onChange(id, updated);
  };

  return (
    <FieldWithLabel label={label} htmlFor={id}>
      <div className="flex flex-col gap-2.5">
        {safeValues.map((val, i) => {
          const filled = val.trim().length > 0;
          return (
            <div key={`${id}-${i}`} className="flex items-center gap-3">
              <span className="text-xs font-bold text-purple-400 tracking-wider min-w-[22px] text-right">
                {String(i + 1).padStart(2, '0')}
              </span>
              <input
                id={i === 0 ? id : undefined}
                type="text"
                className={`${inputBase} h-[42px] ${filled ? inputFilled : ''}`}
                placeholder={placeholder || `Item ${i + 1}...`}
                value={val}
                onChange={(e) => handleItemChange(i, e.target.value)}
              />
            </div>
          );
        })}
      </div>
    </FieldWithLabel>
  );
}

// ─── InputSelect (dropdown) ─────────────────────────────────
function WorkbookInputSelect({
  id, options, label, value, onChange,
}: SelectChunk & { value: string; onChange: (id: string, value: string) => void }) {
  const filled = value?.trim().length > 0;
  return (
    <FieldWithLabel label={label} htmlFor={id}>
      <select
        id={id}
        className={`${inputBase} h-[42px] cursor-pointer ${filled ? inputFilled : ''}`}
        value={value || ''}
        onChange={(e) => onChange(id, e.target.value)}
      >
        <option value="">Escolha...</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </FieldWithLabel>
  );
}

// ─── WorkbookField (router component) ───────────────────────
// Routes a chunk to the correct interactive component
export function WorkbookField({
  chunk,
  responses,
  onChange,
}: {
  chunk: WorkbookChunk;
  responses: Record<string, string | string[]>;
  onChange: (id: string, value: string | string[]) => void;
}) {
  switch (chunk.type) {
    case 'input-field':
      return (
        <WorkbookInputField
          {...chunk}
          value={(responses[chunk.id] as string) || ''}
          onChange={(id, val) => onChange(id, val)}
        />
      );

    case 'input-area':
      return (
        <WorkbookInputArea
          {...chunk}
          value={(responses[chunk.id] as string) || ''}
          onChange={(id, val) => onChange(id, val)}
        />
      );

    case 'input-list':
      return (
        <WorkbookInputList
          {...chunk}
          values={(responses[chunk.id] as string[]) || []}
          onChange={(id, vals) => onChange(id, vals)}
        />
      );

    case 'input-select':
      return (
        <WorkbookInputSelect
          {...chunk}
          value={(responses[chunk.id] as string) || ''}
          onChange={(id, val) => onChange(id, val)}
        />
      );

    default:
      return null;
  }
}
