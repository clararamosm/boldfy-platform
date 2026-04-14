'use client';

import { useState, useRef, useCallback } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { getAuthToken } from '@/lib/auth-client';
import { updatePipelinePost } from '@/app/actions/content-pipeline';
import { Button } from '@/components/ui/button';
import { Upload, X, FileText, Loader2, Image as ImageIcon, Film } from 'lucide-react';
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

    const allowedTypes = [
      'image/png', 'image/jpeg', 'image/webp', 'image/gif',
      'video/mp4', 'video/quicktime',
      'application/pdf',
    ];
    if (!allowedTypes.includes(file.type)) {
      alert('Formato não suportado. Use PNG, JPG, WEBP, GIF, MP4, MOV ou PDF.');
      return;
    }

    // Size limits: 200MB for video, 10MB for image/gif/pdf
    const isVideo = file.type.startsWith('video/');
    const maxSize = isVideo ? 200 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert(isVideo ? 'Vídeo muito grande. Máximo: 200MB.' : 'Arquivo muito grande. Máximo: 10MB.');
      return;
    }

    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `pipeline/${tlId}/${postId}/media.${ext}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      // Classify type: image, gif, video, pdf
      let type: string;
      if (file.type === 'image/gif') type = 'gif';
      else if (file.type.startsWith('video/')) type = 'video';
      else if (file.type === 'application/pdf') type = 'pdf';
      else type = 'image';

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
          {post.mediaType === 'video' ? (
            <video
              src={post.mediaUrl}
              controls
              className="rounded-lg border w-full bg-muted"
            />
          ) : (post.mediaType === 'image' || post.mediaType === 'gif') ? (
            <img
              src={post.mediaUrl}
              alt="Post media"
              className="rounded-lg border w-full object-contain bg-muted"
            />
          ) : post.mediaType === 'pdf' ? (
            <a
              href={post.mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-4 rounded-lg border bg-muted hover:bg-muted/80 transition-colors"
            >
              <FileText className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm">Visualizar PDF</span>
            </a>
          ) : (
            <img
              src={post.mediaUrl}
              alt="Post media"
              className="rounded-lg border w-full object-contain bg-muted"
            />
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
            accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,application/pdf"
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
