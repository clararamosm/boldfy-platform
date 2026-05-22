// scripts/inspect-trail-progress.mjs
//
// Investigação de gap de pontos em trilhas: dado o email de um colaborador
// e (opcionalmente) o título/id de uma trilha, mostra:
//   - Os pontos configurados na trilha (pontuacaoTotal, pontuacaoBonus,
//     pontuacaoBonusTrilha + breakdown por módulo)
//   - O progresso real do user (pontosGanhos, pontuacaoFixadaPorModulo,
//     primeirasTentativasDesafio)
//   - O cálculo esperado vs o que efetivamente foi creditado
//
// Uso:
//   node scripts/inspect-trail-progress.mjs --user=email@exemplo.com
//   node scripts/inspect-trail-progress.mjs --user=email@exemplo.com --trail=discovery-marca-pessoal
//   node scripts/inspect-trail-progress.mjs --user=email@exemplo.com --trail-id=<docId>
//
// Pré-req: service-account.json na raiz do projeto.

import admin from 'firebase-admin';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceAccount = require(path.join(__dirname, '..', 'service-account.json'));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// ─── Args ────────────────────────────────────────────────
const args = process.argv.slice(2);
const userEmail = args.find((a) => a.startsWith('--user='))?.slice('--user='.length);
const trailQuery = args.find((a) => a.startsWith('--trail='))?.slice('--trail='.length);
const trailId = args.find((a) => a.startsWith('--trail-id='))?.slice('--trail-id='.length);

if (!userEmail) {
  console.error('Uso: --user=<email> [--trail=<título parcial>] [--trail-id=<docId>]');
  process.exit(1);
}

// ─── Helpers ─────────────────────────────────────────────
async function findUserByEmail(email) {
  const snap = await db.collection('users').where('email', '==', email).get();
  if (!snap.empty) {
    const d = snap.docs[0];
    return { id: d.id, ...d.data() };
  }
  // Fallback: scan
  const all = await db.collection('users').get();
  for (const d of all.docs) {
    const data = d.data();
    if ((data.email || data.profile?.email)?.toLowerCase() === email.toLowerCase()) {
      return { id: d.id, ...data };
    }
  }
  return null;
}

async function findTrails() {
  // Trilhas globais ficam em collection 'trails' (ou 'trilhas' — vou tentar ambos)
  const candidateCollections = ['trails', 'trilhas'];
  const allTrails = [];
  for (const col of candidateCollections) {
    try {
      const snap = await db.collection(col).get();
      snap.docs.forEach((d) => allTrails.push({ id: d.id, _collection: col, ...d.data() }));
    } catch {}
  }
  return allTrails;
}

function calculateExpectedPoints(trail, progress) {
  const moduloIds = (trail.modulos || []).map((m) => m.id);
  const completos = new Set(progress.modulosCompletos || []);
  let basePoints = 0;
  let bonusEarned = 0;
  const breakdown = [];

  for (const m of (trail.modulos || [])) {
    const isCompleted = completos.has(m.id);
    const attempt = progress.primeirasTentativasDesafio?.[m.id];
    const percent = attempt?.percentual ?? attempt?.percentualAcerto ?? null;

    const base = m.pontuacaoBase || 0;
    const bonus = m.pontuacaoBonus || 0;

    let earned = 0;
    let bonusGained = 0;
    if (isCompleted) {
      if (m.modo === 'desafio' && percent != null) {
        if (percent >= 80) { earned = base + bonus; bonusGained = bonus; }
        else if (percent >= 60) { earned = base; }
        // <60% = 0 (mas marcado como completo? pode ser inconsistência)
      } else {
        earned = base;
      }
    }
    basePoints += isCompleted ? base : 0;
    bonusEarned += bonusGained;
    breakdown.push({
      moduleId: m.id,
      titulo: m.titulo,
      modo: m.modo,
      base,
      bonus,
      completed: isCompleted,
      quizPercent: percent,
      earned,
    });
  }

  const allCompleted = trail.modulos?.length > 0 && trail.modulos.every((m) => completos.has(m.id));
  const trailCompletionBonus = allCompleted ? (trail.pontuacaoBonusTrilha || 0) : 0;

  const expectedTotal = basePoints + bonusEarned + trailCompletionBonus;
  return { basePoints, bonusEarned, trailCompletionBonus, expectedTotal, breakdown, allCompleted };
}

// ─── Main ────────────────────────────────────────────────
async function main() {
  console.log(`\n🔍 Buscando user com email: ${userEmail}`);
  const user = await findUserByEmail(userEmail);
  if (!user) {
    console.error(`❌ User não encontrado.`);
    process.exit(1);
  }
  console.log(`✅ User encontrado: ${user.id} (${user.profile?.name || user.name})`);
  console.log(`   companyId: ${user.companyId}`);

  // Listar trilhas globais
  const allTrails = await findTrails();
  console.log(`\n📚 Total de trilhas no banco (globais): ${allTrails.length}`);

  // Filtrar pela trilha alvo
  let targetTrails = allTrails;
  if (trailId) {
    targetTrails = allTrails.filter((t) => t.id === trailId);
  } else if (trailQuery) {
    const q = trailQuery.toLowerCase();
    targetTrails = allTrails.filter((t) =>
      (t.titulo || '').toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q),
    );
  }

  if (targetTrails.length === 0) {
    console.log('❌ Nenhuma trilha encontrada com esse filtro. Trilhas disponíveis:');
    allTrails.forEach((t) => console.log(`  • ${t.id} | ${t.titulo} | bonus:${t.pontuacaoBonus} bonusTrilha:${t.pontuacaoBonusTrilha}`));
    process.exit(0);
  }

  // Pegar progresso do user pra cada trilha alvo
  const progressSnap = await db.collection('users').doc(user.id).collection('trailProgress').get();
  const progressMap = {};
  progressSnap.docs.forEach((d) => { progressMap[d.id] = d.data(); });

  for (const trail of targetTrails) {
    console.log('\n' + '='.repeat(70));
    console.log(`📚 TRILHA: ${trail.titulo}`);
    console.log(`   id: ${trail.id}`);
    console.log(`   pontuacaoTotal (config): ${trail.pontuacaoTotal}`);
    console.log(`   pontuacaoBonus (config — soma bonus quiz): ${trail.pontuacaoBonus}`);
    console.log(`   pontuacaoBonusTrilha (config — bônus conclusão): ${trail.pontuacaoBonusTrilha ?? 0}`);
    console.log(`   módulos: ${trail.modulos?.length || 0}`);

    const progress = progressMap[trail.id];
    if (!progress) {
      console.log('   ⏳ User ainda não iniciou esta trilha.');
      continue;
    }

    console.log(`\n   📊 PROGRESSO REGISTRADO:`);
    console.log(`     concluida: ${progress.concluida}`);
    console.log(`     percentual: ${progress.percentual}%`);
    console.log(`     pontosGanhos (atual): ${progress.pontosGanhos}`);
    console.log(`     modulosCompletos: ${progress.modulosCompletos?.length || 0}/${trail.modulos?.length || 0}`);

    const expected = calculateExpectedPoints(trail, progress);
    console.log(`\n   🧮 BREAKDOWN POR MÓDULO:`);
    expected.breakdown.forEach((b) => {
      const status = b.completed ? '✓' : '✗';
      const quizInfo = b.quizPercent != null ? ` (quiz: ${b.quizPercent}%)` : '';
      console.log(`     ${status} [${b.modo}] ${b.titulo} | base:${b.base} +bonus:${b.bonus}${quizInfo} → ganhou:${b.earned}`);
    });

    console.log(`\n   💰 CÁLCULO ESPERADO (lógica nova/correta):`);
    console.log(`     Base (módulos completados): ${expected.basePoints}`);
    console.log(`     Bonus de quiz (só >80%): ${expected.bonusEarned}`);
    console.log(`     Bonus de conclusão (pontuacaoBonusTrilha): ${expected.trailCompletionBonus}`);
    console.log(`     ─────────────────────────────`);
    console.log(`     TOTAL ESPERADO: ${expected.expectedTotal}`);

    const diff = (progress.pontosGanhos || 0) - expected.expectedTotal;
    console.log(`\n   🎯 DIFERENÇA: ${progress.pontosGanhos} (creditado) − ${expected.expectedTotal} (esperado) = ${diff > 0 ? '+' : ''}${diff}`);
    if (diff > 0) {
      console.log(`   ⚠️  User ganhou ${diff} pontos a mais que o esperado.`);
    } else if (diff < 0) {
      console.log(`   ⚠️  User ganhou ${Math.abs(diff)} pontos a menos.`);
    } else {
      console.log(`   ✅ Bate certinho.`);
    }
  }
  console.log('');
}

main().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
}).finally(() => process.exit());
