/**
 * invite-tokens.ts
 *
 * Token customizado para convites de primeiro acesso na Boldfy.
 *
 * O Firebase Admin SDK so permite gerar links de reset de senha com TTL
 * fixo de 1 hora — curto demais pra convites B2B que podem demorar dias
 * pra serem abertos. Este modulo gera tokens proprios, armazenados no
 * Firestore, com validade configuravel (padrao: 72 horas).
 *
 * Usado por: todas as server actions de convite (inviteAdmin,
 * inviteCollaborator, inviteThoughtLeader, inviteStrategist, etc.)
 *
 * O fluxo de "esqueci minha senha" (requestPasswordReset) continua
 * usando o generatePasswordResetLink do Firebase — 1 hora e padrao
 * de seguranca aceitavel pra reset.
 */

import crypto from 'crypto';
import { auth as adminAuth, db as adminDb } from '@/lib/firebase-admin';

// ── Constantes ──────────────────────────────────────────────────────

/** Validade do token de convite: 72 horas. */
export const INVITE_TOKEN_TTL_MS = 72 * 60 * 60 * 1000;

/** Nome da collection no Firestore. */
const COLLECTION = 'invite_tokens';

// ── Tipos ───────────────────────────────────────────────────────────

export type InviteTokenError = 'token-expired' | 'token-invalid' | 'token-used';

export class InviteTokenException extends Error {
  constructor(public readonly code: InviteTokenError) {
    super(code);
    this.name = 'InviteTokenException';
  }
}

// ── Funções públicas ────────────────────────────────────────────────

/**
 * Gera um token criptograficamente seguro, persiste no Firestore com
 * TTL de 72h, e retorna a URL completa de primeiro acesso.
 */
export async function generateInviteLink(
  email: string,
  uid: string,
): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();

  await adminDb.collection(COLLECTION).doc(token).set({
    email: email.toLowerCase().trim(),
    uid,
    expiresAt: now + INVITE_TOKEN_TTL_MS,
    used: false,
    createdAt: now,
  });

  const base =
    process.env.NEXT_PUBLIC_BASE_URL || 'https://app.boldfy.com.br';
  const params = new URLSearchParams({ token, email });
  return `${base}/primeiro-acesso?${params.toString()}`;
}

/**
 * Valida um token de convite. Retorna email + uid se valido.
 * Lanca InviteTokenException se expirado, invalido ou ja usado.
 */
export async function verifyInviteToken(
  token: string,
): Promise<{ email: string; uid: string }> {
  const snap = await adminDb.collection(COLLECTION).doc(token).get();

  if (!snap.exists) {
    throw new InviteTokenException('token-invalid');
  }

  const data = snap.data()!;

  if (data.used) {
    throw new InviteTokenException('token-used');
  }

  if (Date.now() > data.expiresAt) {
    throw new InviteTokenException('token-expired');
  }

  return { email: data.email, uid: data.uid };
}

/**
 * Consome o token (marca como usado) e define a senha do usuario
 * via Firebase Admin SDK. Valida o token novamente antes de consumir
 * pra evitar race conditions.
 */
export async function consumeInviteToken(
  token: string,
  newPassword: string,
): Promise<{ email: string }> {
  const tokenRef = adminDb.collection(COLLECTION).doc(token);

  // Transacao pra garantir atomicidade (ninguem consome o mesmo token
  // entre o read e o update).
  const result = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(tokenRef);

    if (!snap.exists) {
      throw new InviteTokenException('token-invalid');
    }

    const data = snap.data()!;

    if (data.used) {
      throw new InviteTokenException('token-used');
    }

    if (Date.now() > data.expiresAt) {
      throw new InviteTokenException('token-expired');
    }

    // Marca como usado DENTRO da transacao.
    tx.update(tokenRef, { used: true, consumedAt: Date.now() });

    return { email: data.email as string, uid: data.uid as string };
  });

  // Seta a senha via Admin SDK (fora da transacao — Firestore
  // transactions nao devem ter side-effects externos).
  await adminAuth.updateUser(result.uid, { password: newPassword });

  return { email: result.email };
}
