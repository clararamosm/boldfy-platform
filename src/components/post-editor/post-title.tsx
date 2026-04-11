'use client';

import { useRef, useEffect, useCallback } from 'react';

type Props = {
  value: string;
  onChange: (value: string) => void;
  canEdit: boolean;
};

export function PostTitle({ value, onChange, canEdit }: Props) {
  const ref = useRef<HTMLHeadingElement>(null);
  const isInternalChange = useRef(false);

  // Sync value from outside
  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    if (ref.current && ref.current.textContent !== value) {
      ref.current.textContent = value;
    }
  }, [value]);

  const handleInput = useCallback(() => {
    if (ref.current) {
      isInternalChange.current = true;
      onChange(ref.current.textContent || '');
    }
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Prevent Enter in title — just blur or move to caption
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  }, []);

  if (!canEdit) {
    return (
      <h1 className="text-3xl font-bold text-foreground leading-tight">
        {value || 'Sem título'}
      </h1>
    );
  }

  return (
    <h1
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      data-placeholder="Sem título"
      className="text-3xl font-bold text-foreground leading-tight focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/50"
    />
  );
}
