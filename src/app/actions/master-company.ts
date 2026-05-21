// src/app/actions/master-company.ts
// Server actions de identidade da empresa (master only).
// Separado de billing.ts porque licenses/tlLicenses + companyName/locale/logoUrl
// vivem na raiz do doc da empresa, nao em billing.*. Manter aqui evita acoplar
// flow de billing testado.

'use server';

import { requireMaster } from '@/lib/auth-guard';
import { auth as adminAuth, db as adminDb } from '@/lib/firebase-admin';
import { appendActivityLog } from '@/lib/billing/activity-log';
import type { BillingActionResult } from './billing';

/** Mascara email pra activity log (joao@x.com -> jo***@x.com). */
function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '???';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

export interface SaveCompanyIdentityInput {
  idToken: string;
  companyId: string;
  companyName?: string;
  locale?: 'pt-BR' | 'en';
  logoUrl?: string;
  licenses?: number;
  tlLicenses?: number;
}

export interface SaveCompanyIdentityResult {
  companyName: string;
  locale: 'pt-BR' | 'en';
  logoUrl: string | null;
  licenses: number;
  tlLicenses: number;
}

/**
 * Atualiza identidade da empresa: nome, idioma, logo, e/ou seats.
 * Diff-aware: so escreve campos que vieram no input. Loga no activity log
 * com kinds diferentes pra identidade vs seats.
 */
export async function saveCompanyIdentity(
  input: SaveCompanyIdentityInput,
): Promise<BillingActionResult<SaveCompanyIdentityResult>> {
  try {
    const master = await requireMaster(input.idToken);

    if (!input.companyId || typeof input.companyId !== 'string') {
      return { success: false, error: 'companyId obrigatorio.' };
    }

    // Validacao inline.
    const updates: Record<string, unknown> = {};
    const identityChanged: string[] = [];
    const seatsChanged: string[] = [];

    if (input.companyName !== undefined) {
      const trimmed = input.companyName.trim();
      if (trimmed.length < 1 || trimmed.length > 200) {
        return { success: false, error: 'Nome da empresa deve ter 1-200 caracteres.' };
      }
      updates.companyName = trimmed;
      identityChanged.push('nome');
    }

    if (input.locale !== undefined) {
      if (input.locale !== 'pt-BR' && input.locale !== 'en') {
        return { success: false, error: 'Idioma inválido. Use pt-BR ou en.' };
      }
      updates.locale = input.locale;
      identityChanged.push('idioma');
    }

    if (input.logoUrl !== undefined) {
      if (typeof input.logoUrl !== 'string' || input.logoUrl.length > 2048) {
        return { success: false, error: 'URL do logo invalida (max 2048 chars).' };
      }
      updates.logoUrl = input.logoUrl || null;
      identityChanged.push('logo');
    }

    if (input.licenses !== undefined) {
      if (!Number.isInteger(input.licenses) || input.licenses < 5) {
        return { success: false, error: 'Seats Platform deve ser inteiro >= 5.' };
      }
      updates.licenses = input.licenses;
      seatsChanged.push(`Platform=${input.licenses}`);
    }

    if (input.tlLicenses !== undefined) {
      if (!Number.isInteger(input.tlLicenses) || input.tlLicenses < 0 || input.tlLicenses > 50) {
        return { success: false, error: 'Seats TL deve ser inteiro entre 0 e 50.' };
      }
      updates.tlLicenses = input.tlLicenses;
      seatsChanged.push(`TL=${input.tlLicenses}`);
    }

    if (Object.keys(updates).length === 0) {
      return { success: false, error: 'Nenhum campo para atualizar.' };
    }

    const docRef = adminDb.collection('companies').doc(input.companyId);
    const snap = await docRef.get();
    if (!snap.exists) {
      return { success: false, error: 'Empresa não encontrada.' };
    }

    await docRef.update(updates);

    // Activity log — best effort.
    if (identityChanged.length > 0) {
      await appendActivityLog(input.companyId, {
        kind: 'company.identity_changed',
        actorRole: 'master',
        actorUid: master.uid,
        summary: `Identidade alterada: ${identityChanged.join(', ')}`,
      });
    }
    if (seatsChanged.length > 0) {
      await appendActivityLog(input.companyId, {
        kind: 'seats.changed',
        actorRole: 'master',
        actorUid: master.uid,
        summary: `Seats atualizados: ${seatsChanged.join(', ')}`,
      });
    }

    const after = await docRef.get();
    const data = after.data() ?? {};

    return {
      success: true,
      data: {
        companyName: String(data.companyName ?? ''),
        locale: (data.locale === 'en' ? 'en' : 'pt-BR'),
        logoUrl: typeof data.logoUrl === 'string' && data.logoUrl ? data.logoUrl : null,
        licenses: typeof data.licenses === 'number' ? data.licenses : 0,
        tlLicenses: typeof data.tlLicenses === 'number' ? data.tlLicenses : 0,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido.';
    return { success: false, error: message };
  }
}

export interface DeleteCompanyAdminInput {
  idToken: string;
  companyId: string;
  /** uid do admin a remover. Tem que pertencer a empresa indicada. */
  adminUid: string;
}

/**
 * Remove o admin de uma empresa. Usado tanto para "cancelar convite"
 * (admin nunca logou) quanto para "trocar admin" (admin ativo).
 *
 * Faz:
 *  - Valida master + que adminUid pertence a companyId com role='admin'
 *  - Deleta usuario do Firebase Auth (best-effort se ja nao existir)
 *  - Deleta subcolecoes do user doc
 *  - Deleta o user doc
 *  - Limpa companies.{id}.adminProfile
 *  - Loga em activity log (admin.invited com summary "removido")
 *
 * Empresa pode ficar sem admin: e' estado valido. Listagem ja mostra
 * "adminPending" pra empresas sem admin.
 */
export async function deleteCompanyAdmin(
  input: DeleteCompanyAdminInput,
): Promise<BillingActionResult<{ removed: true }>> {
  if (!adminAuth) {
    return { success: false, error: 'Servico de autenticacao indisponivel.' };
  }

  try {
    const master = await requireMaster(input.idToken);

    if (!input.companyId || !input.adminUid) {
      return { success: false, error: 'companyId e adminUid obrigatorios.' };
    }

    // Verifica que o uid e admin desta empresa.
    const userDoc = await adminDb.collection('users').doc(input.adminUid).get();
    if (!userDoc.exists) {
      return { success: false, error: 'Admin não encontrado.' };
    }
    const userData = userDoc.data() ?? {};
    if (userData.role !== 'admin' || userData.companyId !== input.companyId) {
      return { success: false, error: 'Usuário não é admin desta empresa.' };
    }

    const adminEmail = (userData.profile?.email as string | undefined)
      || (userData.email as string | undefined)
      || '';

    // Deleta do Firebase Auth (tolerante a not-found).
    try {
      await adminAuth.deleteUser(input.adminUid);
    } catch (authErr: unknown) {
      const e = authErr as { code?: string; message?: string };
      if (e?.code !== 'auth/user-not-found') {
        console.error('[deleteCompanyAdmin] auth delete falhou:', e?.message);
      }
    }

    // Limpa subcolecoes + doc.
    const userRef = adminDb.collection('users').doc(input.adminUid);
    const subcollections = await userRef.listCollections();
    for (const subcol of subcollections) {
      const docs = await subcol.listDocuments();
      for (const d of docs) {
        await d.delete();
      }
    }
    await userRef.delete();

    // Zera adminProfile na empresa pra listagem voltar a marcar adminPending=true.
    await adminDb.collection('companies').doc(input.companyId).update({
      adminProfile: null,
    });

    // Activity log.
    await appendActivityLog(input.companyId, {
      kind: 'admin.invited',
      actorRole: 'master',
      actorUid: master.uid,
      summary: adminEmail
        ? `Admin removido (${maskEmail(adminEmail)})`
        : 'Admin removido',
    });

    return { success: true, data: { removed: true } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido.';
    console.error('[deleteCompanyAdmin] erro:', message);
    return { success: false, error: message };
  }
}
