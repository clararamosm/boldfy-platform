const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.join(__dirname, '..', 'service-account.json');
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function main() {
  // Buscar a Clara pelo email
  const usersSnap = await db.collection('users')
    .where('email', '==', 'clara@brandingdeproposito.com.br')
    .get();

  let claraId = null;

  if (usersSnap.empty) {
    // Tentar por nome
    const allUsers = await db.collection('users').get();
    for (const doc of allUsers.docs) {
      const d = doc.data();
      const name = (d.profile && d.profile.name) || d.name || '';
      if (name.toLowerCase().includes('clara')) {
        console.log('Encontrada por nome:', doc.id, name, d.email, d.role);
        claraId = doc.id;
      }
    }
  } else {
    for (const doc of usersSnap.docs) {
      console.log('UserId:', doc.id, '| Role:', doc.data().role, '| Email:', doc.data().email);
      claraId = doc.id;
    }
  }

  if (!claraId) {
    console.log('Clara não encontrada');
    return;
  }

  // Buscar todos os posts com status 'postado' no contentPipeline
  const pipelineSnap = await db
    .collection('users').doc(claraId)
    .collection('contentPipeline')
    .where('status', '==', 'postado')
    .get();

  console.log('\n=== contentPipeline posts com status postado:', pipelineSnap.size, '===');
  for (const doc of pipelineSnap.docs) {
    const d = doc.data();
    console.log({
      id: doc.id,
      title: d.title || d.caption && d.caption.substring(0, 50),
      publishedAt: d.publishedAt,
      scheduledFor: d.scheduledFor,
      linkedinPostId: d.linkedinPostId || '(vazio)',
      linkedinPostUrl: d.linkedinPostUrl || '(vazio)',
      updatedAt: d.updatedAt,
      createdAt: d.createdAt,
    });
  }

  // Também buscar scheduledPosts com status 'published'
  const scheduledSnap = await db
    .collection('users').doc(claraId)
    .collection('scheduledPosts')
    .where('status', '==', 'published')
    .get();

  console.log('\n=== scheduledPosts com status published:', scheduledSnap.size, '===');
  for (const doc of scheduledSnap.docs) {
    const d = doc.data();
    console.log({
      id: doc.id,
      caption: d.caption && d.caption.substring(0, 50),
      publishedAt: d.publishedAt,
      linkedinPostId: d.linkedinPostId || '(vazio)',
    });
  }
}

main().catch(console.error).finally(() => process.exit());
