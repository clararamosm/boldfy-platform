/**
 * Script: Migrar master de clara@boldfy para boldfy.app@gmail.com
 *
 * O que faz:
 * 1. Cria boldfy.app@gmail.com no Firebase Auth com senha temporária
 * 2. Cria documento users/{uid} com role: "master" no Firestore
 * 3. Deleta o documento Firestore da Clara (NÃO deleta o Auth dela)
 *
 * Como rodar:
 *   npx tsx scripts/migrate-master.ts
 *
 * Pré-requisito:
 *   - ter FIREBASE_SERVICE_ACCOUNT_KEY no .env.local
 *   - instalar tsx se não tiver: npx tsx (vai instalar automaticamente)
 */

import * as admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ─── Load .env.local manually (no dotenv dependency needed) ──────
function loadEnvFile(filePath: string) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.substring(0, eqIdx).trim();
      let value = trimmed.substring(eqIdx + 1).trim();
      // Remove surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // File not found, skip silently
  }
}

loadEnvFile(resolve(process.cwd(), '.env.local'));
loadEnvFile(resolve(process.cwd(), '.env'));

// ─── Init Admin SDK ──────
const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!serviceAccountKey) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY não encontrada no .env.local ou .env');
  console.error('   Certifique-se de que essa variável existe no seu arquivo .env.local');
  process.exit(1);
}

const serviceAccount = JSON.parse(serviceAccountKey);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const auth = admin.auth();

// ─── Config ──────
const NEW_MASTER_EMAIL = 'boldfy.app@gmail.com';
const NEW_MASTER_NAME = 'Fy: App Manager';
const TEMP_PASSWORD = 'Boldfy@2025';

async function run() {
  console.log('🚀 Iniciando migração do master...\n');

  // ── Step 1: Encontrar documento master atual no Firestore ──
  console.log('🔍 Buscando master atual...');
  let claraDocId: string | null = null;
  let claraEmail: string = '';

  const masterSnap = await db.collection('users')
    .where('role', '==', 'master')
    .get();

  if (!masterSnap.empty) {
    // Pegar o primeiro (e provavelmente único) master
    const doc = masterSnap.docs[0];
    const data = doc.data();
    claraDocId = doc.id;
    claraEmail = data.email || data.profile?.email || 'N/A';
    console.log(`  ✅ Master encontrado: uid=${doc.id}, email=${claraEmail}`);

    if (masterSnap.docs.length > 1) {
      console.log(`  ⚠️  Encontrados ${masterSnap.docs.length} masters! Usando o primeiro.`);
      masterSnap.docs.forEach((d, i) => {
        const e = d.data().email || 'N/A';
        console.log(`    [${i}] uid=${d.id}, email=${e}`);
      });
    }
  } else {
    console.log('  ⚠️  Nenhum master encontrado no Firestore. Apenas criando o novo...');
  }

  // ── Step 2: Criar boldfy.app@gmail.com no Firebase Auth ──
  console.log(`\n📧 Criando ${NEW_MASTER_EMAIL} no Firebase Auth...`);

  let newUid: string;
  try {
    // Verificar se já existe
    const existing = await auth.getUserByEmail(NEW_MASTER_EMAIL).catch(() => null);
    if (existing) {
      newUid = existing.uid;
      console.log(`  ⚠️  Usuário já existe no Auth: uid=${newUid}`);
    } else {
      const userRecord = await auth.createUser({
        email: NEW_MASTER_EMAIL,
        password: TEMP_PASSWORD,
        displayName: NEW_MASTER_NAME,
        emailVerified: true,
      });
      newUid = userRecord.uid;
      console.log(`  ✅ Usuário criado no Auth: uid=${newUid}`);
    }
  } catch (err) {
    console.error('  ❌ Erro ao criar usuário no Auth:', err);
    process.exit(1);
  }

  // ── Step 3: Criar documento master no Firestore ──
  console.log(`\n📄 Criando documento master no Firestore (users/${newUid})...`);

  try {
    await db.collection('users').doc(newUid).set({
      role: 'master',
      name: NEW_MASTER_NAME,
      email: NEW_MASTER_EMAIL,
      profile: {
        name: NEW_MASTER_NAME,
        email: NEW_MASTER_EMAIL,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('  ✅ Documento master criado!');
  } catch (err) {
    console.error('  ❌ Erro ao criar documento:', err);
    process.exit(1);
  }

  // ── Step 4: Deletar documento Firestore do master antigo ──
  if (claraDocId && claraDocId !== newUid) {
    console.log(`\n🗑️  Deletando documento Firestore do master antigo (users/${claraDocId})...`);
    console.log('  ℹ️  O Auth dela NÃO será deletado — pode se cadastrar como estrategista depois');

    try {
      await db.collection('users').doc(claraDocId).delete();
      console.log('  ✅ Documento deletado!');
    } catch (err) {
      console.error('  ❌ Erro ao deletar documento:', err);
    }
  }

  // ── Summary ──
  console.log('\n' + '═'.repeat(55));
  console.log('  ✅ MIGRAÇÃO CONCLUÍDA!');
  console.log('═'.repeat(55));
  console.log(`\n  Novo master: ${NEW_MASTER_EMAIL}`);
  console.log(`  Senha temporária: ${TEMP_PASSWORD}`);
  console.log(`  UID: ${newUid}`);
  if (claraDocId && claraDocId !== newUid) {
    console.log(`\n  Master antigo removido: users/${claraDocId} (${claraEmail})`);
    console.log('  Auth mantido — pode fazer login como outro role');
  }
  console.log('\n📋 Próximos passos:');
  console.log(`  1. Faça login com ${NEW_MASTER_EMAIL} / ${TEMP_PASSWORD}`);
  console.log('  2. Troque a senha (recomendado — use "Esqueci minha senha")');
  console.log('  3. Pelo painel master, cadastre a Clara como estrategista');
  console.log('');

  process.exit(0);
}

run().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
