// src/lib/auth-client.ts
// Client-side helper para obter o Firebase ID Token.
// Usado pelos componentes antes de chamar server actions protegidas.

import { auth } from '@/lib/firebase';

/**
 * Retorna o ID token do usuario autenticado no Firebase.
 * Lanca erro se nao houver usuario logado.
 *
 * Uso nos componentes:
 *   import { getAuthToken } from '@/lib/auth-client';
 *   const token = await getAuthToken();
 *   const result = await someServerAction(token, ...args);
 */
export async function getAuthToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Voce precisa estar logado para realizar esta acao.');
  }
  return user.getIdToken();
}
