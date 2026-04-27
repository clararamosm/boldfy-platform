'use client';

import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/auth-client';
import { resolveSlugs } from '@/app/actions/content-pipeline';
import { useAuth } from '@/contexts/auth-context';
import { PostEditorShell } from './post-editor-shell';
import { Loader2 } from 'lucide-react';

type Props = {
  companySlug: string;
  tlSlug: string;
  postId: string;
};

export function SlugResolver({ companySlug, tlSlug, postId }: Props) {
  const { firebaseUser, loading: authLoading } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [tlId, setTlId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Aguarda Firebase Auth terminar de hidratar antes de tentar resolver
    if (authLoading) return;

    // Após hidratação: se não há usuário, mostra mensagem específica
    if (!firebaseUser) {
      setError('Você precisa estar logado para acessar este post.');
      return;
    }

    const resolve = async () => {
      try {
        const token = await getAuthToken();
        const result = await resolveSlugs(token, companySlug, tlSlug);
        if (result.error) {
          console.error('[SlugResolver] Server returned error:', result.error, { companySlug, tlSlug });
          setError(result.error);
          return;
        }
        if (result.companyId) setCompanyId(result.companyId);
        if (result.tlId) setTlId(result.tlId);
      } catch (err) {
        console.error('[SlugResolver] Unexpected error:', err, { companySlug, tlSlug });
        const msg = err instanceof Error ? err.message : 'Erro ao resolver identificadores.';
        setError(msg);
      }
    };
    resolve();
  }, [companySlug, tlSlug, authLoading, firebaseUser]);

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
