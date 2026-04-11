'use client';

import { SimpleRichEditor } from '@/components/ui/simple-rich-editor';
import DOMPurify from 'dompurify';

type Props = {
  value: string;
  onChange: (value: string) => void;
  canEdit: boolean;
};

export function PostBodyEditor({ value, onChange, canEdit }: Props) {
  if (!canEdit) {
    // Read-only: render sanitized HTML
    const sanitized = DOMPurify.sanitize(value || '', {
      ALLOWED_TAGS: ['b', 'i', 'u', 'strong', 'em', 'span', 'br', 'p', 'div', 'mark', 'font'],
      ALLOWED_ATTR: ['style', 'color'],
    });

    if (!sanitized) {
      return (
        <div className="text-sm text-muted-foreground italic py-4">
          Nenhum conteúdo ainda.
        </div>
      );
    }

    return (
      <div className="prose prose-sm max-w-none py-4">
        <div dangerouslySetInnerHTML={{ __html: sanitized }} />
      </div>
    );
  }

  return (
    <div className="py-2">
      <SimpleRichEditor
        value={value}
        onChange={onChange}
        placeholder="Escreva o conteúdo do post aqui..."
        className="min-h-[300px]"
      />
    </div>
  );
}
