import { NextResponse } from 'next/server';
import {
  verifyInviteToken,
  InviteTokenException,
} from '@/lib/invite-tokens';

/**
 * POST /api/invite/verify
 *
 * Valida um token de convite e retorna o e-mail associado.
 * Chamado pela pagina /primeiro-acesso no mount pra verificar
 * se o link ainda e valido antes de mostrar o form de senha.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token } = body as { token?: string };

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'token-invalid' },
        { status: 400 },
      );
    }

    const { email } = await verifyInviteToken(token);

    return NextResponse.json({ email });
  } catch (err) {
    if (err instanceof InviteTokenException) {
      const status = err.code === 'token-expired' ? 410 : 400;
      return NextResponse.json({ error: err.code }, { status });
    }

    console.error('[api/invite/verify] Erro inesperado:', err);
    return NextResponse.json(
      { error: 'internal-error' },
      { status: 500 },
    );
  }
}
