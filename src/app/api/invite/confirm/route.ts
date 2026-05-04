import { NextResponse } from 'next/server';
import {
  consumeInviteToken,
  InviteTokenException,
} from '@/lib/invite-tokens';

/**
 * POST /api/invite/confirm
 *
 * Consome o token de convite e define a senha do usuario.
 * Chamado pela pagina /primeiro-acesso quando o usuario submete
 * o formulario de criacao de senha.
 *
 * A senha e validada no client (min 8 chars, confirmacao),
 * mas fazemos uma checagem minima aqui tambem por seguranca.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, password } = body as {
      token?: string;
      password?: string;
    };

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'token-invalid' },
        { status: 400 },
      );
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { error: 'weak-password' },
        { status: 400 },
      );
    }

    const { email } = await consumeInviteToken(token, password);

    return NextResponse.json({ success: true, email });
  } catch (err) {
    if (err instanceof InviteTokenException) {
      const status = err.code === 'token-expired' ? 410 : 400;
      return NextResponse.json({ error: err.code }, { status });
    }

    // Firebase Admin SDK pode lancar erro se a senha for fraca demais
    // segundo as regras do projeto Firebase.
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === 'auth/weak-password'
    ) {
      return NextResponse.json(
        { error: 'weak-password' },
        { status: 400 },
      );
    }

    console.error('[api/invite/confirm] Erro inesperado:', err);
    return NextResponse.json(
      { error: 'internal-error' },
      { status: 500 },
    );
  }
}
