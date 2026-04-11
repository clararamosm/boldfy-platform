// src/app/actions/content-strategy.ts
'use server';

import { db as adminDb } from '@/lib/firebase-admin';
import { requireStrategistForTL, requireAuth } from '@/lib/auth-guard';

// ---- Types ----

export type ContentStrategyData = {
  // Content Types — 3 buckets
  contentTypes: {
    visibility: { percentage: number; description: string }; // ToFu
    authority: { percentage: number; description: string }; // MoFu
    conversion: { percentage: number; description: string }; // BoFu
  };
  // Messaging & Positioning
  messaging: {
    enemy: string;
    positioning: string;
    pointOfView: string;
  };
  // Central Narrative
  narrative: string;
  // Pain Points
  pains: Array<{ title: string; description: string }>;
  // Solutions
  solutions: Array<{ title: string; description: string }>;
  // Content Pillars
  pillars: Array<{
    name: string;
    subtitle: string;
    series: Array<{ name: string; objective: string; inputs: string }>;
  }>;
  // Metadata
  updatedAt?: string;
  updatedBy?: string;
};

export type BrandManualData = {
  // Personality
  personality: {
    description: string;
    attributes: Array<{ title: string; description: string }>;
  };
  // Mindset
  mindset: Array<{ title: string; description: string }>;
  // Archetypes
  archetypes: {
    primary: { title: string; description: string };
    secondary: { title: string; description: string };
  };
  // Tone of Voice
  toneOfVoice: Array<{ title: string; description: string }>;
  // Situations
  situations: Array<{ context: string; description: string }>;
  // Language & Style
  languageStyle: Array<{ title: string; description: string }>;
  // Do's & Don'ts
  bestPractices: {
    dos: string[];
    donts: string[];
  };
  // Vocabulary
  vocabulary: {
    keywords: string[];
    expressions: string[];
  };
  // Summary
  summary: {
    positioning: string;
    valueProposition: string;
    differential: string;
    mission: string;
  };
  // Metadata
  updatedAt?: string;
  updatedBy?: string;
};

// ---- Helper: doc paths ----

function getStrategyPath(companyId: string, tlUserId: string) {
  return `companies/${companyId}/thoughtLeaders/${tlUserId}`;
}

// ---- Save Content Strategy (Strategist only) ----

export async function saveContentStrategy(
  idToken: string,
  tlUserId: string,
  data: ContentStrategyData
): Promise<{ success?: boolean; error?: string }> {
  try {
    const user = await requireStrategistForTL(idToken, tlUserId);

    // Get TL's companyId
    const tlDoc = await adminDb.collection('users').doc(tlUserId).get();
    if (!tlDoc.exists) return { error: 'Thought Leader nao encontrado.' };
    const companyId = tlDoc.data()?.companyId;
    if (!companyId) return { error: 'Thought Leader sem empresa vinculada.' };

    const docRef = adminDb.doc(`${getStrategyPath(companyId, tlUserId)}/contentStrategy/main`);
    await docRef.set({
      ...data,
      updatedAt: new Date().toISOString(),
      updatedBy: user.uid,
    }, { merge: true });

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in saveContentStrategy:', msg);
    return { error: msg };
  }
}

// ---- Get Content Strategy (TL, Strategist, Admin, Master) ----

export async function getContentStrategy(
  idToken: string,
  tlUserId: string
): Promise<{ data?: ContentStrategyData | null; error?: string }> {
  try {
    const user = await requireAuth(idToken);

    // Access check
    if (user.role === 'master') {
      // OK
    } else if (user.uid === tlUserId) {
      // TL viewing their own
    } else if (user.role === 'strategist') {
      await requireStrategistForTL(idToken, tlUserId);
    } else if (user.role === 'admin') {
      const tlDoc = await adminDb.collection('users').doc(tlUserId).get();
      if (!tlDoc.exists || tlDoc.data()?.companyId !== user.companyId) {
        return { error: 'Acesso negado.' };
      }
    } else {
      return { error: 'Acesso negado.' };
    }

    // Get TL's companyId
    const tlDoc = await adminDb.collection('users').doc(tlUserId).get();
    if (!tlDoc.exists) return { error: 'Thought Leader nao encontrado.' };
    const companyId = tlDoc.data()?.companyId;
    if (!companyId) return { data: null };

    const docRef = adminDb.doc(`${getStrategyPath(companyId, tlUserId)}/contentStrategy/main`);
    const snap = await docRef.get();

    if (!snap.exists) {
      return { data: null };
    }

    return { data: snap.data() as ContentStrategyData };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in getContentStrategy:', msg);
    return { error: msg };
  }
}

// ---- Save Brand Manual (Strategist only) ----

export async function saveBrandManual(
  idToken: string,
  tlUserId: string,
  data: BrandManualData
): Promise<{ success?: boolean; error?: string }> {
  try {
    const user = await requireStrategistForTL(idToken, tlUserId);

    // Get TL's companyId
    const tlDoc = await adminDb.collection('users').doc(tlUserId).get();
    if (!tlDoc.exists) return { error: 'Thought Leader nao encontrado.' };
    const companyId = tlDoc.data()?.companyId;
    if (!companyId) return { error: 'Thought Leader sem empresa vinculada.' };

    const docRef = adminDb.doc(`${getStrategyPath(companyId, tlUserId)}/brandManual/main`);
    await docRef.set({
      ...data,
      updatedAt: new Date().toISOString(),
      updatedBy: user.uid,
    }, { merge: true });

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in saveBrandManual:', msg);
    return { error: msg };
  }
}

// ---- Get Brand Manual (TL, Strategist, Admin, Master) ----

export async function getBrandManual(
  idToken: string,
  tlUserId: string
): Promise<{ data?: BrandManualData | null; error?: string }> {
  try {
    const user = await requireAuth(idToken);

    // Access check
    if (user.role === 'master') {
      // OK
    } else if (user.uid === tlUserId) {
      // TL viewing their own
    } else if (user.role === 'strategist') {
      await requireStrategistForTL(idToken, tlUserId);
    } else if (user.role === 'admin') {
      const tlDoc = await adminDb.collection('users').doc(tlUserId).get();
      if (!tlDoc.exists || tlDoc.data()?.companyId !== user.companyId) {
        return { error: 'Acesso negado.' };
      }
    } else {
      return { error: 'Acesso negado.' };
    }

    // Get TL's companyId
    const tlDoc = await adminDb.collection('users').doc(tlUserId).get();
    if (!tlDoc.exists) return { error: 'Thought Leader nao encontrado.' };
    const companyId = tlDoc.data()?.companyId;
    if (!companyId) return { data: null };

    const docRef = adminDb.doc(`${getStrategyPath(companyId, tlUserId)}/brandManual/main`);
    const snap = await docRef.get();

    if (!snap.exists) {
      return { data: null };
    }

    return { data: snap.data() as BrandManualData };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in getBrandManual:', msg);
    return { error: msg };
  }
}
