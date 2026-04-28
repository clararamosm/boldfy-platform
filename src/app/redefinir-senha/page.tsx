'use client';

// src/app/redefinir-senha/page.tsx
// Pagina branded de reset de senha (fluxo "esqueci minha senha"), no
// nosso dominio em vez do dominio default do Firebase.
//
// Diferenca pro /primeiro-acesso:
// - Copy de "redefinir" em vez de "primeiro acesso".
// - Apos confirmar, redireciona pro /login (SEM flag primeiroAcesso=1).
//   Nao queremos mostrar o banner de "primeiro acesso" pra quem ja era
//   usuario ativo e so esqueceu a senha.

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  verifyPasswordResetCode,
  confirmPasswordReset,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Loader2 } from 'lucide-react';
import { LogoFull } from '@/components/logo';
import { PublicLocaleWrapper } from '@/components/public-locale-wrapper';
import { LanguageToggle } from '@/components/language-toggle';
import { useT } from '@/lib/i18n/context';

function RedefinirSenhaForm() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();

  const oobCode = searchParams.get('oobCode');
  const emailFromUrl = searchParams.get('email');

  const [verifying, setVerifying] = useState(true);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!oobCode) {
        if (!cancelled) {
          setVerifyError(t.auth.resetPwd.errors.missingCode);
          setVerifying(false);
        }
        return;
      }
      try {
        const email = await verifyPasswordResetCode(auth, oobCode);
        if (!cancelled) {
          setVerifiedEmail(email);
          setVerifying(false);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const code =
          err && typeof err === 'object' && 'code' in err
            ? (err as { code: string }).code
            : '';
        if (code === 'auth/expired-action-code') {
          setVerifyError(t.auth.resetPwd.errors.expiredCode);
        } else {
          setVerifyError(t.auth.resetPwd.errors.invalidCode);
        }
        setVerifying(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [oobCode, t.auth.resetPwd.errors]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!oobCode || !verifiedEmail) {
      setSubmitError(t.auth.resetPwd.errors.invalidCode);
      return;
    }
    if (password.length < 8) {
      setSubmitError(t.auth.resetPwd.errors.weakPassword);
      return;
    }
    if (password !== confirmPwd) {
      setSubmitError(t.auth.resetPwd.errors.mismatch);
      return;
    }

    setSubmitting(true);

    try {
      await confirmPasswordReset(auth, oobCode, password);
    } catch (err: unknown) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? (err as { code: string }).code
          : '';
      if (code === 'auth/expired-action-code') {
        setSubmitError(t.auth.resetPwd.errors.expiredCode);
      } else if (code === 'auth/weak-password') {
        setSubmitError(t.auth.resetPwd.errors.weakPassword);
      } else {
        setSubmitError(t.auth.resetPwd.errors.confirmFailed);
      }
      setSubmitting(false);
      return;
    }

    // Redireciona pro /login pre-preenchendo o email — SEM flag
    // primeiroAcesso (esse usuario nao e' primeiro acesso).
    const params = new URLSearchParams();
    if (verifiedEmail) params.set('email', verifiedEmail);
    const qs = params.toString();
    router.push(qs ? `/login?${qs}` : '/login');
  }

  // ── render ───────────────────────────────────────────────────────────

  if (verifying) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <LogoFull height={48} />
          </div>
          <CardTitle className="text-2xl">{t.auth.resetPwd.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">{t.auth.resetPwd.verifying}</span>
        </CardContent>
      </Card>
    );
  }

  if (verifyError) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <LogoFull height={48} />
          </div>
          <CardTitle className="text-2xl">{t.auth.resetPwd.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            {verifyError}
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => router.push('/login')}
          >
            {t.auth.resetPwd.goToLogin}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4">
          <LogoFull height={48} />
        </div>
        <CardTitle className="text-2xl">{t.auth.resetPwd.title}</CardTitle>
        <CardDescription>{t.auth.resetPwd.subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Hidden email pra autofill heuristic do browser. */}
          <input
            type="email"
            name="email"
            autoComplete="username"
            value={verifiedEmail ?? emailFromUrl ?? ''}
            readOnly
            hidden
          />

          <div className="space-y-2">
            <Label htmlFor="newPassword">{t.auth.resetPwd.newPassword}</Label>
            <PasswordInput
              id="newPassword"
              autoComplete="new-password"
              placeholder={t.auth.resetPwd.passwordPlaceholder}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              {t.auth.resetPwd.passwordHint}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">
              {t.auth.resetPwd.confirmPassword}
            </Label>
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              placeholder={t.auth.resetPwd.passwordPlaceholder}
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              required
            />
          </div>

          {submitError && (
            <div className="text-sm text-red-500 text-center">
              {submitError}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t.auth.resetPwd.saving}
              </>
            ) : (
              t.auth.resetPwd.savePassword
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <PublicLocaleWrapper>
      {(locale, setLocale) => (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4 relative">
          <div className="absolute top-4 right-4">
            <LanguageToggle locale={locale} onChange={setLocale} />
          </div>
          <Suspense fallback={null}>
            <RedefinirSenhaForm />
          </Suspense>
        </div>
      )}
    </PublicLocaleWrapper>
  );
}
