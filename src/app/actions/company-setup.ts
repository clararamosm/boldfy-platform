// src/app/actions/company-setup.ts
'use server';

import { db as adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireMaster } from '@/lib/auth-guard';
import { NATIVE_REWARDS } from '@/lib/native-rewards';
import { getTemplateContent } from '@/lib/trilhas/template-content';
import { appendActivityLog } from '@/lib/billing/activity-log';

// ─── Seed native rewards for a single company ───────────────────────
// Idempotent: skips if isNative rewards already exist.
// Called by inviteAdmin (new companies) and migration endpoint (existing ones).

export async function seedNativeRewards(companyId: string): Promise<{ created: number; skipped: boolean }> {
  const rewardsRef = adminDb.collection('companies').doc(companyId).collection('rewards');

  // Check if native rewards already exist
  const existingNative = await rewardsRef.where('isNative', '==', true).limit(1).get();
  if (!existingNative.empty) {
    return { created: 0, skipped: true };
  }

  // Also remove old isDefault reward (legacy single seed) if present
  const legacyDefault = await rewardsRef.where('isDefault', '==', true).get();

  const batch = adminDb.batch();

  // Remove legacy default rewards
  for (const doc of legacyDefault.docs) {
    batch.delete(doc.ref);
  }

  // Get company locale for reward names
  const companyDoc = await adminDb.collection('companies').doc(companyId).get();
  const locale = companyDoc.data()?.locale || 'pt-BR';

  // Create native rewards
  for (const reward of NATIVE_REWARDS) {
    const docRef = rewardsRef.doc();
    batch.set(docRef, {
      name: locale === 'en' ? reward.nameEn : reward.name,
      points: reward.points,
      type: reward.type,
      creditsAmount: reward.creditsAmount,
      stock: 'Ilimitado',
      status: 'Disponível',
      isNative: true,
      imageUrl: null,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
  return { created: NATIVE_REWARDS.length, skipped: false };
}

// ─── Migration endpoint: seed all existing companies ─────────────────
// Requires master auth. Run once via admin panel or script.

export async function migrateAllCompaniesNativeRewards(
  idToken: string
): Promise<{ total: number; created: number; skipped: number; errors: number }> {
  await requireMaster(idToken);

  const companiesSnap = await adminDb.collection('companies').get();
  const result = { total: companiesSnap.size, created: 0, skipped: 0, errors: 0 };

  for (const companyDoc of companiesSnap.docs) {
    try {
      const { created, skipped } = await seedNativeRewards(companyDoc.id);
      if (skipped) {
        result.skipped++;
      } else {
        result.created += created;
      }
    } catch (error) {
      console.error(`[Migration] Failed to seed native rewards for company ${companyDoc.id}:`, error);
      result.errors++;
    }
  }

  return result;
}

// ─── Seed "Trilhas Personalizadas — Template" para uma empresa ────────
//
// Cria a sessao pre-mockada com 5 trilhas-esqueleto (modulos: []) que serve
// como guia removivel para o admin. Cada trilha vem com `descricao` que
// explica por que existe e o que poderia conter — admin apaga e personaliza.
//
// Idempotente: skipa se ja existe sessao com tipo='template_personalizado'.
// Chamado por inviteAdmin (empresas novas) e migrateAllCompaniesTemplatePersonalizado
// (empresas existentes).
//
// Trilhas nascem com ativa: false — nao aparecem pro colaborador ate que
// o admin ative manualmente. Sessao nasce com ativa: true pra aparecer
// na lista do admin.

export async function seedTemplatePersonalizado(
  companyId: string,
): Promise<{ created: number; skipped: boolean }> {
  const sessionsRef = adminDb.collection('companies').doc(companyId).collection('sessions');

  // Idempotencia: se ja existe sessao template, skipa.
  const existing = await sessionsRef.where('tipo', '==', 'template_personalizado').limit(1).get();
  if (!existing.empty) {
    return { created: 0, skipped: true };
  }

  // Le locale da empresa (pra escolher pt-BR ou en).
  const companyDoc = await adminDb.collection('companies').doc(companyId).get();
  const locale = companyDoc.data()?.locale || 'pt-BR';
  const content = getTemplateContent(locale);

  // Cria sessao + 5 trilhas em batch atomico.
  const batch = adminDb.batch();

  const newSessionRef = sessionsRef.doc();
  batch.set(newSessionRef, {
    titulo: content.sessaoTitulo,
    descricao: content.sessaoDescricao,
    ordem: 0,
    ativa: true,
    tipo: 'template_personalizado',
    locale,
    criadaEm: FieldValue.serverTimestamp(),
  });

  const trailsRef = newSessionRef.collection('trails');
  content.trilhas.forEach((trilha, idx) => {
    const trailRef = trailsRef.doc();
    batch.set(trailRef, {
      sessionId: newSessionRef.id,
      titulo: trilha.titulo,
      descricao: trilha.descricao,
      ordem: idx,
      ativa: false, // nao publicada ate admin ativar manualmente
      pontuacaoTotal: 0,
      pontuacaoBonus: 0,
      pontuacaoBonusTrilha: 0,
      tempoEstimadoMin: 0,
      modulos: [],
      isTemplate: true,
      criadaEm: FieldValue.serverTimestamp(),
    });
  });

  await batch.commit();

  // Activity log (best-effort — appendActivityLog nunca propaga erro).
  await appendActivityLog(
    companyId,
    {
      kind: 'template_personalizado.seeded',
      actorRole: 'system',
      actorUid: null,
      summary: `Sessão "Marca Corporativa" criada com ${content.trilhas.length} trilhas`,
    },
    { idempotencyKey: companyId },
  );

  return { created: content.trilhas.length, skipped: false };
}

// ─── Seed template em UMA empresa especifica (chamado pelo master) ─────
// Wrapper com auth check em volta de seedTemplatePersonalizado.
// Usado pelo botao "Criar Marca Corporativa" no menu de acoes de cada
// linha da tabela master/empresas — permite testar o seed em uma empresa
// antes de rodar em todas.

export async function seedTemplatePersonalizadoForCompany(
  idToken: string,
  companyId: string,
): Promise<{ created: number; skipped: boolean }> {
  await requireMaster(idToken);
  return seedTemplatePersonalizado(companyId);
}

// ─── Migration endpoint: seed template em todas as empresas existentes ──
// Requires master auth. Roda uma vez via admin panel ou script pra cobrir
// empresas criadas antes deste feature existir.

export async function migrateAllCompaniesTemplatePersonalizado(
  idToken: string,
): Promise<{ total: number; created: number; skipped: number; errors: number }> {
  await requireMaster(idToken);

  const companiesSnap = await adminDb.collection('companies').get();
  const result = { total: companiesSnap.size, created: 0, skipped: 0, errors: 0 };

  for (const companyDoc of companiesSnap.docs) {
    try {
      const { created, skipped } = await seedTemplatePersonalizado(companyDoc.id);
      if (skipped) {
        result.skipped++;
      } else {
        result.created += created;
      }
    } catch (error) {
      console.error(
        `[Migration] Failed to seed template personalizado for company ${companyDoc.id}:`,
        error,
      );
      result.errors++;
    }
  }

  return result;
}
