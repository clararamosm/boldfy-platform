// src/lib/toast-helpers.ts
// Lightweight wrappers around the toast hook to standardize error/success patterns.
// Usage: const { toastError, toastSuccess } = useToastHelpers();

'use client';

import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

/**
 * Returns standardized toast helpers already bound to the toast instance.
 *
 * @example
 * const { toastError, toastSuccess, toastActionError } = useToastHelpers();
 *
 * toastError('Não foi possível carregar os dados.');
 * toastSuccess('Configurações salvas!');
 * toastActionError('salvar trilha', error);
 */
export function useToastHelpers() {
  const { toast } = useToast();

  /** Show a destructive toast with optional custom title (defaults to "Erro"). */
  const toastError = useCallback(
    (description: string, title = 'Erro') => {
      toast({ variant: 'destructive', title, description });
    },
    [toast],
  );

  /** Show a destructive toast for a failed action, extracting the error message. */
  const toastActionError = useCallback(
    (action: string, error?: unknown) => {
      const description =
        error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        variant: 'destructive',
        title: `Erro ao ${action}`,
        description,
      });
    },
    [toast],
  );

  /** Show a success toast (title only or with description). */
  const toastSuccess = useCallback(
    (title: string, description?: string) => {
      toast({ title, ...(description ? { description } : {}) });
    },
    [toast],
  );

  /** Show session-expired toast (common pattern across the codebase). */
  const toastSessionExpired = useCallback(() => {
    toast({
      variant: 'destructive',
      title: 'Erro',
      description: 'Sessão expirada. Faça login novamente.',
    });
  }, [toast]);

  return {
    toast,
    toastError,
    toastActionError,
    toastSuccess,
    toastSessionExpired,
  } as const;
}
