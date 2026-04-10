// src/lib/auth-guard.ts
// Server-side authentication guard for server actions.
// Verifies Firebase ID tokens and enforces role-based access control.

import { auth as adminAuth, db as adminDb } from '@/lib/firebase-admin';

export type AuthUser = {
  uid: string;
  name?: string;
  email?: string;
  role?: string;
  companyId?: string;
};

/**
 * Verifica o ID token do Firebase e retorna os dados do usuario autenticado.
 * Lanca erro se o token for invalido ou ausente.
 */
export async function requireAuth(idToken: string): Promise<AuthUser> {
  if (!idToken) {
    throw new Error('Token de autenticacao ausente.');
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);

    // Buscar role e companyId do Firestore
    const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
    const data = userDoc.exists ? userDoc.data() : undefined;

    return {
      uid: decoded.uid,
      name: data?.profile?.name || data?.name,
      email: decoded.email || data?.profile?.email || data?.email,
      role: data?.role,
      companyId: data?.companyId,
    };
  } catch (error) {
    console.error('Auth verification failed:', error);
    throw new Error('Sessao invalida ou expirada. Faca login novamente.');
  }
}

/**
 * Verifica autenticacao + garante que o usuario so acessa seus proprios dados.
 */
export async function requireSelf(idToken: string, targetUserId: string): Promise<AuthUser> {
  const user = await requireAuth(idToken);

  if (user.uid !== targetUserId) {
    throw new Error('Acesso negado: voce so pode acessar seus proprios dados.');
  }

  return user;
}

/**
 * Verifica autenticacao + garante que o usuario tem role de admin.
 * Opcionalmente verifica se e admin da empresa especifica.
 */
export async function requireAdmin(idToken: string, companyId?: string): Promise<AuthUser> {
  const user = await requireAuth(idToken);

  if (user.role !== 'admin' && user.role !== 'master') {
    throw new Error('Acesso negado: permissao de administrador necessaria.');
  }

  if (companyId && user.role === 'admin' && user.companyId !== companyId) {
    throw new Error('Acesso negado: voce nao tem permissao nesta empresa.');
  }

  return user;
}

/**
 * Verifica autenticacao + garante que o usuario tem role de master.
 */
export async function requireMaster(idToken: string): Promise<AuthUser> {
  const user = await requireAuth(idToken);

  if (user.role !== 'master') {
    throw new Error('Acesso negado: permissao de master necessaria.');
  }

  return user;
}
