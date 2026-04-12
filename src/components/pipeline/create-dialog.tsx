'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, SquareCheck, User } from 'lucide-react';
import { getAuthToken } from '@/lib/auth-client';
import { STATUS_CONFIG, PIPELINE_STATUSES } from '@/lib/pipeline-config';
import type { PipelineStatus } from '@/app/actions/content-pipeline';

type TLOption = { id: string; name: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | null;
  /** Pre-selected TL (or null if the user must pick) */
  defaultTlId: string | null;
  /** Available TLs for the selector */
  tlOptions: TLOption[];
  /** Show TL selector? (only when filter is "all" and multiple TLs) */
  showTlSelector: boolean;
  /** Initial status for the new post */
  initialStatus: PipelineStatus;
  /** Called after the post is created (for fallback refresh) */
  onCreated?: () => void;
  /** i18n helpers */
  labels: { statusLabel: (s: PipelineStatus) => string };
};

export function PipelineCreateDialog({
  open,
  onOpenChange,
  companyId,
  defaultTlId,
  tlOptions,
  showTlSelector,
  initialStatus,
  onCreated,
  labels,
}: Props) {
  const router = useRouter();
  const [tlId, setTlId] = useState<string | null>(defaultTlId);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<PipelineStatus>(initialStatus);
  const [isLoading, setIsLoading] = useState(false);

  // Reset form when dialog opens
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setTlId(defaultTlId);
      setTitle('');
      setStatus(initialStatus);
    }
    onOpenChange(v);
  };

  const handleSubmit = async () => {
    const effectiveTlId = tlId || defaultTlId;
    if (!effectiveTlId || !title.trim()) return;

    setIsLoading(true);
    try {
      const token = await getAuthToken();

      const postPayload = {
        title: title.trim(),
        caption: '',
        scheduledFor: null,
        status,
        editorial: '',
        etapa: '',
        formato: '',
        contentPillar: '',
        leadMagnet: false,
      };

      const { createPipelinePost } = await import('@/app/actions/content-pipeline');
      const result = await createPipelinePost(token, effectiveTlId, postPayload as Parameters<typeof createPipelinePost>[2]);

      if (result.postId) {
        onOpenChange(false);
        router.push(`/post/${companyId}/${effectiveTlId}/${result.postId}`);
      } else {
        onOpenChange(false);
        onCreated?.();
      }
    } catch (error) {
      console.error('Error creating post:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto p-0">
        {/* Title */}
        <div className="px-6 pt-6 pb-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título do post"
            className="text-xl font-semibold border-0 p-0 h-auto focus-visible:ring-0 placeholder:text-muted-foreground/50"
          />
        </div>

        {/* Properties */}
        <div className="px-6 py-3 border-y space-y-2">
          {/* TL selector */}
          {showTlSelector && (
            <div className="flex items-center gap-3 min-h-[32px]">
              <div className="flex items-center gap-2 w-32 shrink-0 text-sm text-muted-foreground">
                <User className="h-4 w-4" /> Perfil
              </div>
              <Select value={tlId || ''} onValueChange={setTlId}>
                <SelectTrigger className="h-8 w-auto min-w-[140px] border-0 bg-muted/50 hover:bg-muted">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {tlOptions.map(tl => (
                    <SelectItem key={tl.id} value={tl.id}>{tl.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Status */}
          <div className="flex items-center gap-3 min-h-[32px]">
            <div className="flex items-center gap-2 w-32 shrink-0 text-sm text-muted-foreground">
              <SquareCheck className="h-4 w-4" /> Status
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as PipelineStatus)}>
              <SelectTrigger className="h-8 w-auto min-w-[140px] border-0 bg-muted/50 hover:bg-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_STATUSES.map(s => (
                  <SelectItem key={s} value={s}>{labels.statusLabel(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t flex items-center justify-end gap-2 bg-muted/20">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={isLoading || !title.trim()}>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Criar Post
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
