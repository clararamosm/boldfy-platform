'use client';

import React, { useRef, useCallback, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { Bold, Italic, Underline, Highlighter, Palette } from 'lucide-react';
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
  const colorRef = useRef<HTMLInputElement>(null);
  const isInternalChange = useRef(false);

  // Only set innerHTML when value changes externally (not from user typing)
  // Sanitize with DOMPurify to prevent XSS
  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = DOMPurify.sanitize(value, {
        ALLOWED_TAGS: ['b', 'i', 'u', 'strong', 'em', 'span', 'br', 'p', 'div', 'mark', 'font'],
        ALLOWED_ATTR: ['style', 'color', 'face', 'size'],
      });
    }
  }, [value]);

  const execCmd = useCallback((command: string, val?: string) => {
    document.execCommand(command, false, val);
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

  const ToolbarBtn = ({ onClick, active, title, children }: {
    onClick: () => void;
    active?: boolean;
    title: string;
    children: React.ReactNode
  }) => (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={cn(
        'p-1.5 rounded hover:bg-gray-200 transition-colors',
        active && 'bg-gray-200'
      )}
    >
      {children}
    </button>
  );

  return (
    <div className={cn('border rounded-md overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 p-1.5 border-b bg-gray-50">
        <ToolbarBtn onClick={() => execCmd('bold')} title="Negrito (Ctrl+B)">
          <Bold className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => execCmd('italic')} title="Italico (Ctrl+I)">
          <Italic className="w-4 h-4" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => execCmd('underline')} title="Sublinhado (Ctrl+U)">
          <Underline className="w-4 h-4" />
        </ToolbarBtn>
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <ToolbarBtn onClick={() => execCmd('hiliteColor', '#fef08a')} title="Destacar texto">
          <Highlighter className="w-4 h-4" />
        </ToolbarBtn>
        <div className="relative">
          <ToolbarBtn onClick={() => colorRef.current?.click()} title="Cor do texto">
            <Palette className="w-4 h-4" />
          </ToolbarBtn>
          <input
            ref={colorRef}
            type="color"
            className="absolute opacity-0 w-0 h-0"
            onChange={(e) => execCmd('foreColor', e.target.value)}
          />
        </div>
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
