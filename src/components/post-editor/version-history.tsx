'use client';

import { useState, useCallback } from 'react';
import { getAuthToken } from '@/lib/auth-client';
import { restorePostVersion } from '@/app/actions/post-editor';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { History, ChevronDown, RotateCcw, Loader2 } from 'lucide-react';
import type { PostVersion } from '@/lib/post-editor-types';

type Props = {
  versions: PostVersion[];
  onRestore: (version: PostVersion) => void;
  tlId: string;
  postId: string;
};

export function VersionHistory({ versions, onRestore, tlId, postId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const handleRestore = useCallback(async (version: PostVersion) => {
    setRestoringId(version.id);
    try {
      const token = await getAuthToken();
      const result = await restorePostVersion(token, tlId, postId, version.id);
      if (result.success) {
        onRestore(version);
      }
    } catch {
      // silent
    } finally {
      setRestoringId(null);
    }
  }, [tlId, postId, onRestore]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="py-2">
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
          <History className="h-3.5 w-3.5" />
          <span>Histórico de versões ({versions.length})</span>
          <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="pt-3">
        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {versions.map((version, idx) => (
            <div
              key={version.id}
              className="flex items-center justify-between px-3 py-2 rounded-md border bg-muted/30 text-xs"
            >
              <div className="space-y-0.5">
                <p className="font-medium">
                  {idx === 0 ? 'Versão mais recente' : `Versão ${versions.length - idx}`}
                </p>
                <p className="text-muted-foreground">
                  {version.savedByName} · {formatDate(version.createdAt)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => handleRestore(version)}
                disabled={restoringId === version.id}
              >
                {restoringId === version.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RotateCcw className="h-3 w-3" />
                )}
                Restaurar
              </Button>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
