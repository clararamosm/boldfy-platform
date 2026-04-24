'use client';

import { ArrowLeft, Check, Loader2, AlertCircle, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

type Props = {
  companyName: string;
  tlName: string;
  postTitle: string;
  saveStatus: SaveStatus;
  onBack: () => void;
  onCopyLink?: () => void;
};

export function PostHeaderBar({ companyName, tlName, postTitle, saveStatus, onBack, onCopyLink }: Props) {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between px-4 h-14">
        {/* Left: Back + breadcrumb */}
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <nav className="flex items-center gap-1 text-sm text-muted-foreground truncate">
            <span className="truncate max-w-[120px]">{companyName}</span>
            <span className="text-muted-foreground/50">/</span>
            <span className="truncate max-w-[120px]">{tlName}</span>
            <span className="text-muted-foreground/50">/</span>
            <span className="truncate max-w-[200px] font-medium text-foreground">{postTitle}</span>
          </nav>
        </div>

        {/* Right: Copy link + Save status */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
          {onCopyLink && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCopyLink}
              className="h-8 gap-1.5 text-xs"
              title="Copiar link deste post"
            >
              <Link2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Copiar link</span>
            </Button>
          )}
          {saveStatus === 'saved' && (
            <>
              <Check className="h-3.5 w-3.5 text-green-500" />
              <span>Salvo</span>
            </>
          )}
          {saveStatus === 'saving' && (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Salvando...</span>
            </>
          )}
          {saveStatus === 'unsaved' && (
            <span className="text-amber-500">Alterações não salvas</span>
          )}
          {saveStatus === 'error' && (
            <>
              <AlertCircle className="h-3.5 w-3.5 text-destructive" />
              <span className="text-destructive">Erro ao salvar</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
