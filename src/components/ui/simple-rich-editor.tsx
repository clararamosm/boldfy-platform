'use client';

import React, { useRef, useCallback, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { cn } from '@/lib/utils';

const SYMBOL_BUTTONS = [
  { symbol: '→', label: 'Seta', title: 'Inserir seta →' },
  { symbol: '•', label: 'Bullet', title: 'Inserir bullet •' },
  { symbol: '✦', label: 'Destaque', title: 'Inserir destaque ✦' },
  { symbol: '✅', label: 'Check', title: 'Inserir check ✅' },
  { symbol: '❌', label: 'X', title: 'Inserir ❌' },
] as const;

interface SimpleRichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

export function SimpleRichEditor({
  value,
  onChange,
  placeholder = 'Digite o conteudo aqui...',
  className
}: SimpleRichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);

  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = DOMPurify.sanitize(value, {
        ALLOWED_TAGS: ['span', 'br', 'p', 'div'],
        ALLOWED_ATTR: [],
      });
    }
  }, [value]);

  const insertSymbol = useCallback((symbol: string) => {
    editorRef.current?.focus();
    document.execCommand('insertText', false, symbol);
    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }, []);

  return (
    <div className={cn('border rounded-md overflow-hidden', className)}>
      {/* Symbol toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b bg-gray-50">
        {SYMBOL_BUTTONS.map(({ symbol, label, title }) => (
          <button
            key={symbol}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); insertSymbol(symbol); }}
            title={title}
            className="px-2 py-1 rounded text-sm hover:bg-gray-200 transition-colors select-none"
          >
            {symbol}
          </button>
        ))}
      </div>
      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="min-h-[200px] p-3 text-sm focus:outline-none prose prose-sm max-w-none"
        onInput={handleInput}
        onPaste={handlePaste}
        data-placeholder={placeholder}
      />
    </div>
  );
}
