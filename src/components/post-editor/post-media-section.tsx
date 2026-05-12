'use client';

import { useState, useRef, useCallback } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { getAuthToken } from '@/lib/auth-client';
import { updatePipelinePost } from '@/app/actions/content-pipeline';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Upload, X, FileText, Loader2, Image as ImageIcon } from 'lucide-react';
import type { PipelinePost } from '@/app/actions/content-pipeline';
import {
  ACCEPTED_MEDIA_INPUT,
  classifyMimeType,
  validateNewMedia,
  MAX_GALLERY_IMAGES,
} from '@/lib/media-rules';

type Props = {
  post: PipelinePost;
  canEdit: boolean;
  tlId: string;
  postId: string;
  // Callback após cada save bem-sucedido. Recebe arrays paralelos quando há
  // galeria — mediaUrl/mediaType seguem com a primeira mídia pra retrocompat.
  onMediaUpdate: (
    mediaUrl: string | undefined,
    mediaType: string | undefined,
    mediaUrls?: string[],
    mediaTypes?: string[],
  ) => void;
};

export function PostMediaSection({ post, canEdit, tlId, postId, onMediaUpdate }: Props) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Coleta mediaItems do post atual. Galeria (mediaUrls/mediaTypes) tem
  // prioridade; cai pro singular legado se ausente.
  const currentUrls = post.mediaUrls && post.mediaUrls.length > 0
    ? post.mediaUrls
    : post.mediaUrl ? [post.mediaUrl] : [];
  const currentTypes = post.mediaTypes && post.mediaTypes.length > 0
    ? post.mediaTypes
    : post.mediaType ? [post.mediaType] : [];

  const primaryKind = currentUrls.length > 0
    ? classifyMimeType(currentTypes[0])
    : null;
  const isGallery = primaryKind === 'image' && currentUrls.length > 1;
  const canAddMore = currentUrls.length === 0
    || (primaryKind === 'image' && currentUrls.length < MAX_GALLERY_IMAGES);

  /**
   * Save da lista atualizada de mídia direto no Firestore + callback ao shell.
   * Sincroniza mediaUrl/mediaType com a primeira mídia da lista pra retrocompat.
   */
  const persistMedia = useCallback(async (urls: string[], types: string[]) => {
    const token = await getAuthToken();
    await updatePipelinePost(token, tlId, postId, {
      mediaUrls: urls,
      mediaTypes: types,
    });
    // Notifica shell — mediaUrl singular = primeira (ou undefined se vazio)
    onMediaUpdate(
      urls[0],
      types[0],
      urls.length > 1 ? urls : undefined,
      urls.length > 1 ? types : undefined,
    );
  }, [tlId, postId, onMediaUpdate]);

  /**
   * Upload de N arquivos (pode ser 1 ou múltiplos). Cada arquivo passa por
   * validateNewMedia antes do upload — se algum falhar, mostra toast e ignora.
   * Saves cumulativos: depois de subir N, salva o array combinado.
   */
  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const newUrls: string[] = [];
      const newTypes: string[] = [];

      for (const file of files) {
        const result = validateNewMedia(
          { mimeType: file.type, sizeBytes: file.size },
          [
            ...currentUrls.map((_, i) => ({ mimeType: currentTypes[i] ?? '' })),
            ...newTypes.map((t) => ({ mimeType: t })),
          ],
        );
        if (!result.ok) {
          toast({ variant: 'destructive', title: 'Mídia não aceita', description: result.reason });
          continue;
        }

        // Path: pipeline/{tlId}/{postId}/media-{timestamp}-{filename}
        // (mudou de "media.{ext}" estático pra path único — galeria precisa
        // de N paths distintos, e mesmo single-image agora preserva históricos
        // se alguém trocar várias vezes.)
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `pipeline/${tlId}/${postId}/media-${Date.now()}-${safeName}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);

        newUrls.push(url);
        newTypes.push(file.type);
      }

      if (newUrls.length === 0) return;

      // Append aos existentes e persiste
      const combinedUrls = [...currentUrls, ...newUrls];
      const combinedTypes = [...currentTypes, ...newTypes];
      await persistMedia(combinedUrls, combinedTypes);
    } catch (err) {
      console.error('Upload failed:', err);
      toast({ variant: 'destructive', title: 'Erro ao fazer upload', description: 'Tente novamente.' });
    } finally {
      setIsUploading(false);
    }
  }, [currentUrls, currentTypes, persistMedia, toast]);

  const handleRemoveAt = useCallback(async (idx: number) => {
    const newUrls = currentUrls.filter((_, i) => i !== idx);
    const newTypes = currentTypes.filter((_, i) => i !== idx);
    try {
      await persistMedia(newUrls, newTypes);
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao remover mídia' });
    }
  }, [currentUrls, currentTypes, persistMedia, toast]);

  // Sem mídia e sem permissão de edição — esconde a seção
  if (currentUrls.length === 0 && !canEdit) return null;

  return (
    <div className="py-4 space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Mídia
        </label>
        {isGallery && (
          <span className="text-xs text-muted-foreground">
            {currentUrls.length} de {MAX_GALLERY_IMAGES} imagens
          </span>
        )}
      </div>

      {/* Render: vazio / galeria / single */}
      {currentUrls.length === 0 ? null : isGallery ? (
        // Galeria: grid de previews
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {currentUrls.map((url, idx) => (
            <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border group bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Imagem ${idx + 1}`} className="w-full h-full object-cover" />
              {canEdit && (
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleRemoveAt(idx)}
                  aria-label={`Remover imagem ${idx + 1}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : (
        // Single: image / video / pdf / gif
        <div className="relative group">
          {primaryKind === 'video' ? (
            <video src={currentUrls[0]} controls className="rounded-lg border w-full bg-muted" />
          ) : primaryKind === 'pdf' ? (
            <a
              href={currentUrls[0]}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-4 rounded-lg border bg-muted hover:bg-muted/80 transition-colors"
            >
              <FileText className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm">Visualizar PDF</span>
            </a>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={currentUrls[0]} alt="Post media" className="rounded-lg border w-full object-contain bg-muted" />
          )}

          {canEdit && (
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => handleRemoveAt(0)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}

      {/* Upload button (só se canEdit) */}
      {canEdit && canAddMore && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={isUploading}
            className="gap-2"
          >
            {isUploading ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando...</>
            ) : currentUrls.length === 0 ? (
              <><Upload className="h-3.5 w-3.5" /> Upload de mídia</>
            ) : (
              <><ImageIcon className="h-3.5 w-3.5" /> Adicionar imagem</>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            Imagens (JPG/PNG/WEBP, até 5MB cada, até {MAX_GALLERY_IMAGES} numa galeria) · GIF/PDF (até 5MB) · Vídeo MP4/MOV (até 200MB)
          </p>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept={ACCEPTED_MEDIA_INPUT}
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length > 0) handleFiles(files);
              e.target.value = '';
            }}
          />
        </>
      )}

      {/* Quando atingiu cap, mostra hint */}
      {canEdit && !canAddMore && isGallery && (
        <p className="text-xs text-muted-foreground">
          Galeria cheia. Remova uma imagem pra adicionar outra.
        </p>
      )}
    </div>
  );
}
