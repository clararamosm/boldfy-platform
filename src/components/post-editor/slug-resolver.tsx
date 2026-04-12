'use client';

import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/auth-client';
import { resolveSlugs } from '@/app/actions/content-pipeline';
import { PostEditorShell } from './post-editor-shell';
import { Loader2 } from 'lucide-react';

type Props = {
  companySlug: string;
  tlSlug: string;
  postId: string;
};

export function SlugResolver({ companySlug, tlSlug, postId }: Props) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [tlId, setTlId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const resolve = async () => {
      try {
        const token = await getAuthToken();
        const result = await resolveSlugs(token, companySlug, tlSlug);
        if (result.error) {
          setError(result.error);
          return;
        }
        if (result.companyId) setCompanyId(result.companyId);
        if (result.tlId) setTlId(result.tlId);
      } catch {
        setError('Erro ao resolver identificadores.');
      }
    };
    resolve();
  }, [companySlug, tlSlug]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!companyId || !tlId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <PostEditorShell companyId={companyId} tlId={tlId} postId={postId} />;
}
