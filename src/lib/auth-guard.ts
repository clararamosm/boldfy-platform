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
    throw new Error('Acesso negado: você só pode acessar seus próprios dados.');
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
    throw new Error('Acesso negado: permissão de administrador necessária.');
  }

  if (companyId && user.role === 'admin' && user.companyId !== companyId) {
    throw new Error('Acesso negado: você não tem permissão nesta empresa.');
  }

  return user;
}

/**
 * Verifica autenticacao + garante que o usuario tem role de master.
 */
export async function requireMaster(idToken: string): Promise<AuthUser> {
  const user = await requireAuth(idToken);

  if (user.role !== 'master') {
    throw new Error('Acesso negado: permissão de master necessária.');
  }

  return user;
}

/**
 * Verifica autenticacao + garante que o usuario tem role de strategist.
 */
export async function requireStrategist(idToken: string): Promise<AuthUser> {
  const user = await requireAuth(idToken);

  if (user.role !== 'strategist') {
    throw new Error('Acesso negado: permissão de estrategista necessária.');
  }

  return user;
}

/**
 * Verifica autenticacao + garante que o usuario tem role de admin ou strategist
 * para a empresa especifica.
 * Strategists precisam ter a empresa em suas assignedCompanies.
 */
export async function requireAdminOrStrategist(idToken: string, companyId: string): Promise<AuthUser> {
  const user = await requireAuth(idToken);

  if (user.role === 'master') {
    // Master tem acesso total
    return user;
  }

  if (user.role === 'admin') {
    if (user.companyId !== companyId) {
      throw new Error('Acesso negado: você não tem permissão nesta empresa.');
    }
    return user;
  }

  if (user.role === 'strategist') {
    // Verifica se o strategist esta atribuido a esta empresa
    const userDoc = await adminDb.collection('users').doc(user.uid).get();
    const assignedCompanies = userDoc.data()?.assignedCompanies as string[] | undefined;
    if (!assignedCompanies?.includes(companyId)) {
      throw new Error('Acesso negado: você não está atribuído a esta empresa.');
    }
    return user;
  }

  throw new Error('Acesso negado: permissão de admin ou estrategista necessária.');
}

/**
 * Verifica autenticacao + garante que o usuario e thoughtleader ou master.
 * Usado para aprovar/rejeitar posts e ideias no pipeline.
 */
export async function requireTLOrMaster(idToken: string): Promise<AuthUser> {
  const user = await requireAuth(idToken);

  if (user.role !== 'thoughtleader' && user.role !== 'master') {
    throw new Error('Acesso negado: permissão de Thought Leader ou Master necessária.');
  }

  return user;
}

/**
 * Verifica autenticacao + garante que o usuario e strategist ou master.
 * Usado para funcoes de gestao de conteudo/config que permitem ambos os roles.
 */
export async function requireStrategistOrMaster(idToken: string): Promise<AuthUser> {
  const user = await requireAuth(idToken);

  if (user.role !== 'strategist' && user.role !== 'master') {
    throw new Error('Acesso negado: permissão de estrategista ou master necessária.');
  }

  return user;
}

/**
 * Verifica que o strategist tem acesso ao Thought Leader especifico.
 * O TL deve pertencer a uma empresa atribuida ao strategist.
 */
export async function requireStrategistForTL(idToken: string, tlUserId: string): Promise<AuthUser> {
  const user = await requireAuth(idToken);

  if (user.role === 'master') {
    return user;
  }

  if (user.role !== 'strategist') {
    throw new Error('Acesso negado: permissão de estrategista necessária.');
  }

  // Buscar o TL para saber a empresa
  const tlDoc = await adminDb.collection('users').doc(tlUserId).get();
  if (!tlDoc.exists) {
    throw new Error('Thought Leader não encontrado.');
  }

  const tlCompanyId = tlDoc.data()?.companyId;
  if (!tlCompanyId) {
    throw new Error('Thought Leader sem empresa vinculada.');
  }

  // Verificar se o strategist esta atribuido a empresa do TL
  const strategistDoc = await adminDb.collection('users').doc(user.uid).get();
  const assignedCompanies = strategistDoc.data()?.assignedCompanies as string[] | undefined;
  if (!assignedCompanies?.includes(tlCompanyId)) {
    throw new Error('Acesso negado: você não está atribuído à empresa deste Thought Leader.');
  }

  return user;
}
