'use client';

import React, { useRef, useCallback, useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SimpleRichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  /** Expose the contentEditable element ref to parent */
  editorRef?: React.RefObject<HTMLDivElement>;
}

export function SimpleRichEditor({
  value,
  onChange,
  placeholder = 'Digite o conteudo aqui...',
  className,
  editorRef: externalRef,
}: SimpleRichEditorProps) {
  const internalRef = useRef<HTMLDivElement>(null);
  const editorRef = externalRef || internalRef;
  const isInternalChange = useRef(false);
  const [showTip, setShowTip] = useState(false);

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

  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    isInternalChange.current = true;
    onChange(editorRef.current.innerHTML);
  }, [onChange]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }, []);

  return (
    <div className={cn('border rounded-md overflow-hidden', className)}>
      {/* Info bar */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b bg-gray-50">
        <button
          type="button"
          onClick={() => setShowTip(!showTip)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Info className="w-3.5 h-3.5" />
          <span>Atalhos</span>
        </button>
        {showTip && (
          <span className="text-xs text-muted-foreground">
            Use o caractere <kbd className="px-1 py-0.5 bg-gray-200 rounded text-[11px] font-mono">→</kbd> (seta) para destacar tópicos. Parênteses, colchetes e outros caracteres especiais são suportados normalmente.
          </span>
        )}
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
