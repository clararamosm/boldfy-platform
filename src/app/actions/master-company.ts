// src/app/actions/master-company.ts
// Server actions de identidade da empresa (master only).
// Separado de billing.ts porque licenses/tlLicenses + companyName/locale/logoUrl
// vivem na raiz do doc da empresa, nao em billing.*. Manter aqui evita acoplar
// flow de billing testado.

'use server';

import { requireMaster } from '@/lib/auth-guard';
import { db as adminDb } from '@/lib/firebase-admin';
import { appendActivityLog } from '@/lib/billing/activity-log';
import type { BillingActionResult } from './billing';

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
        return { success: false, error: 'Idioma invalido. Use pt-BR ou en.' };
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
      return { success: false, error: 'Empresa nao encontrada.' };
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
