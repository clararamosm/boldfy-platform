// Script que usa as credenciais ADC do ambiente (Google Cloud)
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({ credential: applicationDefault() });
const db = getFirestore(app);

async function main() {
  // Buscar a Clara
  const usersSnap = await db.collection('users').get();
  let claraId = null;

  for (const doc of usersSnap.docs) {
    const d = doc.data();
    const email = d.email || '';
    const name = (d.profile && d.profile.name) || d.name || '';
    if (email.includes('clara') || name.toLowerCase().includes('clara ramos')) {
      console.log('Candidata:', doc.id, '|', name, '|', email, '|', d.role);
      claraId = doc.id;
    }
  }

  if (!claraId) {
    console.log('Clara nao encontrada');
    process.exit(1);
  }

  console.log('\n--- UserId da Clara:', claraId, '---\n');

  // Posts com status postado
  const pipelineSnap = await db
    .collection('users').doc(claraId)
    .collection('contentPipeline')
    .where('status', '==', 'postado')
    .get();

  console.log('contentPipeline posts postados:', pipelineSnap.size);
  console.log('\n--- CAMPOS DE CADA POST ---');

  for (const doc of pipelineSnap.docs) {
    const d = doc.data();
    const title = d.title || (d.caption || '').substring(0, 50);
    console.log({
      id: doc.id,
      title,
      publishedAt: d.publishedAt || 'AUSENTE',
      scheduledFor: d.scheduledFor || 'AUSENTE',
      linkedinPostId: d.linkedinPostId || 'AUSENTE',
      linkedinPostUrl: d.linkedinPostUrl || 'AUSENTE',
    });
  }
}

main().catch(console.error).finally(() => process.exit());
