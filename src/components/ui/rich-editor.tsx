'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { useCallback, useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Bold, Italic, Strikethrough, Underline as UnderlineIcon,
  Heading2, Heading3, Link as LinkIcon, Highlighter,
  ImageIcon, X,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────

export interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  onImageUpload?: (file: File) => Promise<string>;
}

// ─── Component ────────────────────────────────────────────────

export function RichEditor({
  value,
  onChange,
  placeholder = 'Digite o conteudo aqui...',
  className = '',
  onImageUpload,
}: RichEditorProps) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-purple-600 underline' },
      }),
      Highlight.configure({
        multicolor: false,
        HTMLAttributes: { class: 'bg-purple-100 text-inherit px-0.5 rounded-sm' },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-base max-w-none min-h-[200px] p-4 focus:outline-none prose-p:leading-relaxed prose-p:mb-5 prose-h2:text-xl prose-h2:font-bold prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-lg prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-3 [&_mark]:bg-purple-100 [&_mark]:text-inherit [&_mark]:px-0.5 [&_mark]:rounded-sm [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-6 prose-a:text-purple-600 prose-a:underline [&_u]:underline',
      },
    },
  });

  // Sync external value changes
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleLinkSubmit = useCallback(() => {
    if (!editor || !linkUrl) return;
    if (linkUrl === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
    setShowLinkInput(false);
    setLinkUrl('');
  }, [editor, linkUrl]);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor || !onImageUpload) return;
    setUploading(true);
    try {
      const url = await onImageUpload(file);
      editor.chain().focus().setImage({ src: url }).run();
    } catch (err) {
      console.error('Image upload failed:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [editor, onImageUpload]);

  if (!editor) return null;

  return (
    <div className={`border rounded-lg overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b bg-muted/30">
        {/* Heading */}
        <ToolbarButton
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Titulo"
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Subtitulo"
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Formatting */}
        <ToolbarButton
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Negrito"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italico"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Tachado"
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Sublinhado"
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Link */}
        <ToolbarButton
          active={editor.isActive('link')}
          onClick={() => {
            if (editor.isActive('link')) {
              editor.chain().focus().unsetLink().run();
            } else {
              setShowLinkInput(true);
              setLinkUrl(editor.getAttributes('link').href || '');
            }
          }}
          title="Link"
        >
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>

        {/* Highlight */}
        <ToolbarButton
          active={editor.isActive('highlight')}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          title="Destaque"
        >
          <Highlighter className="h-4 w-4" />
        </ToolbarButton>

        {/* Image */}
        {onImageUpload && (
          <ToolbarButton
            active={false}
            onClick={() => fileInputRef.current?.click()}
            title="Imagem"
            disabled={uploading}
          >
            <ImageIcon className="h-4 w-4" />
          </ToolbarButton>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />
      </div>

      {/* Link URL input */}
      {showLinkInput && (
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/20">
          <Input
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            placeholder="https://..."
            className="flex-1 h-8 text-sm"
            onKeyDown={e => { if (e.key === 'Enter') handleLinkSubmit(); }}
            autoFocus
          />
          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={handleLinkSubmit}>
            OK
          </Button>
          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setShowLinkInput(false)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  );
}

// ─── Toolbar Button ───────────────────────────────────────────

function ToolbarButton({
  active, onClick, title, disabled, children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-purple-100 text-purple-700'
          : 'hover:bg-muted text-muted-foreground hover:text-foreground'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {children}
    </button>
  );
}
