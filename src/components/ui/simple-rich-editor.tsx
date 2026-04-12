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
}

export function SimpleRichEditor({
  value,
  onChange,
  placeholder = 'Digite o conteudo aqui...',
  className
}: SimpleRichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
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

    // Auto-replace -> with →
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      const node = range.startContainer;
      if (node.nodeType === Node.TEXT_NODE && node.textContent) {
        const offset = range.startOffset;
        const text = node.textContent;
        if (offset >= 2 && text.slice(offset - 2, offset) === '->') {
          node.textContent = text.slice(0, offset - 2) + '\u2192' + text.slice(offset);
          const newRange = document.createRange();
          newRange.setStart(node, offset - 1); // after the → char
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);
        }
      }
    }

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
            Digite <kbd className="px-1 py-0.5 bg-gray-200 rounded text-[11px] font-mono">-&gt;</kbd> para inserir uma seta →
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
