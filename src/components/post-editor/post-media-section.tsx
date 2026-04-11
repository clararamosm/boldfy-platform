'use client';

import { useState, useRef, useCallback } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { getAuthToken } from '@/lib/auth-client';
import { updatePipelinePost } from '@/app/actions/content-pipeline';
import { Button } from '@/components/ui/button';
import { Upload, X, FileText, Loader2, Image as ImageIcon } from 'lucide-react';
import type { PipelinePost } from '@/app/actions/content-pipeline';

type Props = {
  post: PipelinePost;
  canEdit: boolean;
  tlId: string;
  postId: string;
  onMediaUpdate: (mediaUrl: string | undefined, mediaType: string | undefined) => void;
};

export function PostMediaSection({ post, canEdit, tlId, postId, onMediaUpdate }: Props) {
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async (file: File) => {
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      alert('Formato não suportado. Use PNG, JPG, WEBP ou PDF.');
      return;
    }

    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `pipeline/${tlId}/${postId}/media.${ext}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      const type = file.type.startsWith('image/') ? 'image' : 'pdf';

      // Save to Firestore
      const token = await getAuthToken();
      await updatePipelinePost(token, tlId, postId, { mediaUrl: url, mediaType: type });
      onMediaUpdate(url, type);
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Erro ao fazer upload.');
    } finally {
      setIsUploading(false);
    }
  }, [tlId, postId, onMediaUpdate]);

  const handleRemoveMedia = useCallback(async () => {
    try {
      const token = await getAuthToken();
      await updatePipelinePost(token, tlId, postId, { mediaUrl: '', mediaType: '' });
      onMediaUpdate(undefined, undefined);
    } catch {
      alert('Erro ao remover mídia.');
    }
  }, [tlId, postId, onMediaUpdate]);

  // No media and can't edit — show nothing
  if (!post.mediaUrl && !canEdit) return null;

  return (
    <div className="py-4 space-y-3">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Mídia
      </label>

      {/* Media preview */}
      {post.mediaUrl && (
        <div className="relative group">
          {post.mediaType === 'image' ? (
            <img
              src={post.mediaUrl}
              alt="Post media"
              className="rounded-lg border max-h-80 object-contain w-full bg-muted"
            />
          ) : (
            <a
              href={post.mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-4 rounded-lg border bg-muted hover:bg-muted/80 transition-colors"
            >
              <FileText className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm">Visualizar PDF</span>
            </a>
          )}

          {/* Remove button */}
          {canEdit && (
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleRemoveMedia}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}

      {/* Upload button */}
      {canEdit && (
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
            ) : post.mediaUrl ? (
              <><ImageIcon className="h-3.5 w-3.5" /> Trocar mídia</>
            ) : (
              <><Upload className="h-3.5 w-3.5" /> Upload de mídia</>
            )}
          </Button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = '';
            }}
          />
        </>
      )}
    </div>
  );
}
