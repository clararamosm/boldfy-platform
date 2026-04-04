// src/app/api/genkit/[...flow]/route.ts
// NOTA: Esta rota nao e usada ativamente — a geracao de IA usa /api/ai/generate.
// Protegida com auth para evitar consumo indevido de creditos.

import { NextRequest, NextResponse } from 'next/server';
import { auth as adminAuth } from '@/lib/firebase-admin';
import { appRoute } from '@genkit-ai/next';
import { alignContentFlow } from '@/ai/flows/align-content';

const genkitHandler = appRoute(alignContentFlow);

export async function POST(req: NextRequest, context: any) {
  // Verificar autenticacao antes de processar
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  return genkitHandler(req, context);
}
