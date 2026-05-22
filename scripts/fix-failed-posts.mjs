// scripts/fix-failed-posts.mjs
//
// Backfill retroativo: identifica posts que ficaram com status `published`
// (scheduledPosts) ou `postado` (contentPipeline) mas sem linkedinPostId
// válido — sintoma do bug "falso sucesso" do cron, onde o LinkedIn
// respondia 2xx sem o header `x-restli-id` e gravávamos status=published
// com linkedinPostUrl quebrada (`https://www.linkedin.com/feed/update//`).
//
// Comportamento:
//   - DRY RUN (default): só lista os posts afetados, NÃO modifica nada.
//   - --apply: marca cada post afetado como falha (scheduledPosts → 'failed',
//     contentPipeline → 'agendado' pro estrategista ver), grava mensagem
//     explicativa em `error` e LIMPA linkedinPostUrl quebrada.
//   - --user=<email>: filtra por email específico (útil pra resolver casos
//     individuais antes de rodar o backfill global).
//
// Pré-requisitos:
//   - service-account.json na raiz do projeto (mesmo arquivo que check-feed.js usa)
//   - npm install firebase-admin (já está no package.json)
//
// Uso:
//   node scripts/fix-failed-posts.mjs                              # dry-run, todos os users
//   node scripts/fix-failed-posts.mjs --user=clara@example.com     # dry-run, user único
//   node scripts/fix-failed-posts.mjs --apply                      # commit, todos
//   node scripts/fix-failed-posts.mjs --user=clara@example.com --apply
//
// Histórico:
//   - Caso original: Clara Ramos (clara@brandingdeproposito.com.br), maio/2026.
//     Post com gif tagged como "Post publicado" mas LinkedIn não recebeu;
//     link "Ver post no LinkedIn" abria aba em branco porque postId vazio
//     gerava URL `feed/update//`. Bug raiz corrigido em src/lib/linkedin.ts
//     (validação de postId vazio). Este script limpa o legado.

import admin from 'firebase-admin';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const serviceAccountPath = path.join(__dirname, '..', 'service-account.json');
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

// ─── Args ────────────────────────────────────────────────
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const userFilter = args.find((a) => a.startsWith('--user='))?.slice('--user='.length);

const FAILURE_MESSAGE =
  'Não conseguimos confirmar a publicação no LinkedIn (postId não retornado pela API). ' +
  'Por favor, reagende para tentar de novo.';

// ─── Helpers ─────────────────────────────────────────────

/**
 * Detecta o sintoma do bug "falso sucesso":
 *   - linkedinPostId vazio/ausente/null
 *   - OU linkedinPostUrl com formato quebrado (`/feed/update//`)
 *
 * Posts saudáveis têm linkedinPostId não-vazio E URL bem formada.
 */
function isFakeSuccess(data) {
  const id = data.linkedinPostId;
  if (!id || (typeof id === 'string' && id.trim() === '')) return true;

  const url = data.linkedinPostUrl;
  if (typeof url === 'string' && /\/feed\/update\/\/?$/.test(url)) return true;

  return false;
}

/**
 * Resolve usuário pelo email. Tenta o campo `email` direto; se vazio, varre
 * tudo (custo aceitável pra esse script). Devolve [{ id, email, name }].
 */
async function findUsersByEmail(email) {
  const snap = await db.collection('users').where('email', '==', email).get();
  if (!snap.empty) {
    return snap.docs.map((d) => ({
      id: d.id,
      email: d.data().email,
      name: d.data().profile?.name || d.data().name,
      role: d.data().role,
    }));
  }
  // Fallback: scan completo (alguns users antigos podem não ter `email` raiz).
  const all = await db.collection('users').get();
  const out = [];
  for (const d of all.docs) {
    const data = d.data();
    const candidate = data.email || data.profile?.email;
    if (candidate?.toLowerCase() === email.toLowerCase()) {
      out.push({ id: d.id, email: candidate, name: data.profile?.name || data.name, role: data.role });
    }
  }
  return out;
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  console.log(`\n${APPLY ? '🔧 APPLY mode — vai modificar Firestore' : '🔍 DRY-RUN mode — sem modificações'}`);
  if (userFilter) console.log(`👤 Filtrando por email: ${userFilter}`);
  console.log('');

  // 1. Resolver lista de users
  let userIds = [];
  if (userFilter) {
    const users = await findUsersByEmail(userFilter);
    if (users.length === 0) {
      console.log(`❌ Nenhum user encontrado com email ${userFilter}`);
      process.exit(1);
    }
    users.forEach((u) => {
      console.log(`  • ${u.id} | ${u.role} | ${u.name} | ${u.email}`);
      userIds.push(u.id);
    });
    console.log('');
  } else {
    const all = await db.collection('users').get();
    userIds = all.docs.map((d) => d.id);
    console.log(`📊 Total de users no banco: ${userIds.length}`);
  }

  let totalScheduledAffected = 0;
  let totalPipelineAffected = 0;
  const now = new Date().toISOString();

  // 2. Varre scheduledPosts publicados sem postId válido
  console.log('\n=== scheduledPosts (colaborador) ===');
  for (const uid of userIds) {
    const snap = await db
      .collection('users')
      .doc(uid)
      .collection('scheduledPosts')
      .where('status', '==', 'published')
      .get();

    for (const postDoc of snap.docs) {
      const data = postDoc.data();
      if (!isFakeSuccess(data)) continue;

      totalScheduledAffected++;
      console.log(`\n  📄 user=${uid} post=${postDoc.id}`);
      console.log(`     caption: "${(data.caption || '').slice(0, 80)}..."`);
      console.log(`     linkedinPostId: ${JSON.stringify(data.linkedinPostId)}`);
      console.log(`     linkedinPostUrl: ${JSON.stringify(data.linkedinPostUrl)}`);
      console.log(`     publishedAt: ${data.publishedAt}`);

      if (APPLY) {
        await postDoc.ref.update({
          status: 'failed',
          error: FAILURE_MESSAGE,
          linkedinPostUrl: null,
          linkedinPostId: null,
          // Mantém publishedAt como histórico de quando a tentativa aconteceu.
          updatedAt: now,
        });
        console.log(`     ✅ marcado como failed`);
      }
    }
  }

  // 3. Varre contentPipeline postados sem postId válido (TLs)
  console.log('\n=== contentPipeline (thought leader) ===');
  for (const uid of userIds) {
    const snap = await db
      .collection('users')
      .doc(uid)
      .collection('contentPipeline')
      .where('status', '==', 'postado')
      .get();

    for (const postDoc of snap.docs) {
      const data = postDoc.data();
      if (!isFakeSuccess(data)) continue;

      totalPipelineAffected++;
      console.log(`\n  📄 user=${uid} post=${postDoc.id}`);
      console.log(`     title: ${data.title || (data.caption || '').slice(0, 80)}`);
      console.log(`     linkedinPostId: ${JSON.stringify(data.linkedinPostId)}`);
      console.log(`     linkedinPostUrl: ${JSON.stringify(data.linkedinPostUrl)}`);
      console.log(`     publishedAt: ${data.publishedAt}`);

      if (APPLY) {
        // contentPipeline: o cron de publicação faz revert pra 'agendado' em
        // caso de falha (não usa 'failed'). Seguimos a mesma convenção pro
        // estrategista poder ver no comment bot/sidebar.
        await postDoc.ref.update({
          status: 'agendado',
          error: FAILURE_MESSAGE,
          linkedinPostUrl: null,
          linkedinPostId: null,
          updatedAt: now,
        });
        console.log(`     ✅ revertido pra agendado`);
      }
    }
  }

  // 4. Summary
  console.log('\n' + '─'.repeat(60));
  console.log(`Resumo:`);
  console.log(`  scheduledPosts afetados: ${totalScheduledAffected}`);
  console.log(`  contentPipeline afetados: ${totalPipelineAffected}`);
  console.log(`  Total: ${totalScheduledAffected + totalPipelineAffected}`);
  if (!APPLY && totalScheduledAffected + totalPipelineAffected > 0) {
    console.log(`\n💡 Rode novamente com --apply pra commitar as mudanças.`);
  }
  console.log('');
}

main()
  .catch((err) => {
    console.error('Erro:', err);
    process.exit(1);
  })
  .finally(() => process.exit());
