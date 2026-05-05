// src/components/trilhas/player/workbook-fields.tsx
'use client';

import type { FieldChunk, AreaChunk, ListChunk, SelectChunk, WorkbookChunk } from './workbook-parser';

// ─── Shared styles ──────────────────────────────────────────
const inputBase =
  'w-full border border-purple-200 rounded-lg px-3.5 font-sans text-sm text-foreground bg-[#fdfbff] outline-none transition-all duration-200 placeholder:text-purple-300 placeholder:italic focus:border-purple-400 focus:ring-2 focus:ring-purple-400/15';

const inputFilled =
  'bg-purple-50/60 border-purple-300 text-purple-900';

// ─── InputField (single line) ───────────────────────────────
function WorkbookInputField({
  id, placeholder, value, onChange,
}: FieldChunk & { value: string; onChange: (id: string, value: string) => void }) {
  const filled = value?.trim().length > 0;
  return (
    <input
      type="text"
      className={`${inputBase} h-[42px] ${filled ? inputFilled : ''}`}
      placeholder={placeholder || 'Digite aqui...'}
      value={value || ''}
      onChange={(e) => onChange(id, e.target.value)}
    />
  );
}

// ─── InputArea (textarea) ───────────────────────────────────
function WorkbookInputArea({
  id, placeholder, rows, value, onChange,
}: AreaChunk & { value: string; onChange: (id: string, value: string) => void }) {
  const filled = value?.trim().length > 0;
  return (
    <textarea
      className={`${inputBase} py-3 leading-relaxed resize-y border-dashed ${filled ? `${inputFilled} !border-solid` : ''}`}
      style={{ minHeight: rows ? `${rows * 28}px` : '100px' }}
      placeholder={placeholder || 'Escreva aqui...'}
      value={value || ''}
      onChange={(e) => onChange(id, e.target.value)}
    />
  );
}

// ─── InputList (N numbered inputs) ──────────────────────────
function WorkbookInputList({
  id, items, placeholder, values, onChange,
}: ListChunk & { values: string[]; onChange: (id: string, values: string[]) => void }) {
  // Ensure array has correct length
  const safeValues = Array.from({ length: items }, (_, i) => values?.[i] || '');

  const handleItemChange = (index: number, newValue: string) => {
    const updated = [...safeValues];
    updated[index] = newValue;
    onChange(id, updated);
  };

  return (
    <div className="flex flex-col gap-2.5">
      {safeValues.map((val, i) => {
        const filled = val.trim().length > 0;
        return (
          <div key={`${id}-${i}`} className="flex items-center gap-3">
            <span className="text-xs font-bold text-purple-400 tracking-wider min-w-[22px] text-right">
              {String(i + 1).padStart(2, '0')}
            </span>
            <input
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
  );
}

// ─── InputSelect (dropdown) ─────────────────────────────────
function WorkbookInputSelect({
  id, options, value, onChange,
}: SelectChunk & { value: string; onChange: (id: string, value: string) => void }) {
  const filled = value?.trim().length > 0;
  return (
    <select
      className={`${inputBase} h-[42px] cursor-pointer ${filled ? inputFilled : ''}`}
      value={value || ''}
      onChange={(e) => onChange(id, e.target.value)}
    >
      <option value="">Escolha...</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.value}: {opt.label}
        </option>
      ))}
    </select>
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
