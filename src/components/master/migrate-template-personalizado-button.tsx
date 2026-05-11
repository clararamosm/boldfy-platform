// src/components/master/migrate-template-personalizado-button.tsx
//
// BOTAO TEMPORARIO — pode ser removido depois que rodar uma vez.
//
// Dispara migrateAllCompaniesTemplatePersonalizado pra criar a sessao
// "Trilhas Personalizadas — Template" em todas as empresas existentes
// que ainda nao receberam (a funcao e idempotente, ja skipa as que tem).
//
// Empresas criadas a partir do deploy ja recebem automaticamente via
// inviteAdmin → seedTemplatePersonalizado, entao este botao serve so pro
// backfill das antigas.
//
// COMO REMOVER:
// 1. Apague este arquivo
// 2. Em src/app/master/empresas/page.tsx: remova o import e a tag
//    <MigrateTemplatePersonalizadoButton /> do JSX

'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAuthToken } from '@/lib/auth-client';
import { migrateAllCompaniesTemplatePersonalizado } from '@/app/actions';

export function MigrateTemplatePersonalizadoButton() {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [hasRun, setHasRun] = useState(false);

  const handleClick = () => {
    const ok = window.confirm(
      'Criar a sessão "Marca Corporativa" em todas as empresas existentes que ainda não têm?\n\n' +
        'Esta ação é idempotente — empresas que já receberam serão ignoradas. ' +
        'Empresas novas (criadas a partir de hoje) já recebem automaticamente.',
    );
    if (!ok) return;

    startTransition(async () => {
      try {
        const idToken = await getAuthToken();
        const result = await migrateAllCompaniesTemplatePersonalizado(idToken);
        setHasRun(true);
        toast({
          title: 'Migration concluída',
          description:
            `Total: ${result.total} empresas · ` +
            `Criadas: ${result.created / 5} · ` +
            `Já tinham: ${result.skipped} · ` +
            `Erros: ${result.errors}`,
        });
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'Erro ao rodar migration',
          description: err instanceof Error ? err.message : 'Erro desconhecido',
        });
      }
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
      title="Cria a sessão template em todas as empresas existentes (idempotente)"
    >
      {isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <BookOpen className="mr-2 h-4 w-4" />
      )}
      {hasRun ? 'Rodar de novo' : 'Backfill Marca Corporativa'}
    </Button>
  );
}
