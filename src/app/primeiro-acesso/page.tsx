'use client';

// src/app/primeiro-acesso/page.tsx
// Pagina hospedada no nosso dominio (em vez do dominio default do Firebase)
// pra primeiro acesso de qualquer role (admin, colaborador, tl, strategist).
//
// Por que existir: o link gerado por `generatePasswordResetLink` aponta
// pro dominio do Firebase. Quando o usuario salva a senha la, o browser
// guarda a credencial em `<authDomain>.firebaseapp.com`, NAO em
// `app.boldfy.com.br` — entao o autofill nao funciona quando ele cai
// no /login da gente.
//
// Aqui a gente parseia o `oobCode` (do email) e usa client SDK pra
// confirmar a nova senha + auto-login + redirecionar por role.
// Tudo no nosso dominio: browser salva a senha aqui e o autofill funciona.

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  verifyPasswordResetCode,
  confirmPasswordReset,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
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

function PrimeiroAcessoForm() {
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

  // Verifica oobCode no mount.
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!oobCode) {
        if (!cancelled) {
          setVerifyError(t.auth.firstAccess.errors.missingCode);
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
          setVerifyError(t.auth.firstAccess.errors.expiredCode);
        } else {
          setVerifyError(t.auth.firstAccess.errors.invalidCode);
        }
        setVerifying(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [oobCode, t.auth.firstAccess.errors]);

  async function redirectByRole(uid: string) {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
      setSubmitError(t.auth.errors.profileNotRecognized);
      setSubmitting(false);
      return;
    }
    const role = userDoc.data().role;
    if (role === 'master') router.push('/master/empresas');
    else if (role === 'admin') router.push('/admin/dashboard');
    else if (role === 'colaborador') router.push('/colaborador/dashboard');
    else if (role === 'thoughtleader') router.push('/thoughtleader/dashboard');
    else if (role === 'strategist') router.push('/strategist/dashboard');
    else {
      setSubmitError(t.auth.errors.profileNotRecognized);
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!oobCode || !verifiedEmail) {
      setSubmitError(t.auth.firstAccess.errors.invalidCode);
      return;
    }
    if (password.length < 8) {
      setSubmitError(t.auth.firstAccess.errors.weakPassword);
      return;
    }
    if (password !== confirmPwd) {
      setSubmitError(t.auth.firstAccess.errors.mismatch);
      return;
    }

    setSubmitting(true);

    // 1) Confirma reset (define a senha).
    try {
      await confirmPasswordReset(auth, oobCode, password);
    } catch (err: unknown) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? (err as { code: string }).code
          : '';
      if (code === 'auth/expired-action-code') {
        setSubmitError(t.auth.firstAccess.errors.expiredCode);
      } else if (code === 'auth/weak-password') {
        setSubmitError(t.auth.firstAccess.errors.weakPassword);
      } else {
        setSubmitError(t.auth.firstAccess.errors.confirmFailed);
      }
      setSubmitting(false);
      return;
    }

    // 2) Auto-login com email confirmado.
    try {
      const cred = await signInWithEmailAndPassword(auth, verifiedEmail, password);
      const idToken = await cred.user.getIdToken();

      // 3) Cria sessao HttpOnly assinada (mesma logica do /login).
      const sessionRes = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      if (!sessionRes.ok) {
        setSubmitError(t.auth.errors.generic);
        setSubmitting(false);
        return;
      }

      // 4) Redireciona por role.
      await redirectByRole(cred.user.uid);
    } catch (err: unknown) {
      console.error('[primeiro-acesso] auto-login falhou:', err);
      setSubmitError(t.auth.firstAccess.errors.autoLoginFailed);
      setSubmitting(false);
    }
  }

  // ── render ───────────────────────────────────────────────────────────

  if (verifying) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <LogoFull height={48} />
          </div>
          <CardTitle className="text-2xl">{t.auth.firstAccess.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">{t.auth.firstAccess.verifying}</span>
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
          <CardTitle className="text-2xl">{t.auth.firstAccess.title}</CardTitle>
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
            {t.auth.firstAccess.goToLogin}
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
        <CardTitle className="text-2xl">{t.auth.firstAccess.title}</CardTitle>
        <CardDescription>{t.auth.firstAccess.subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Hidden email field pra autofill heuristic do browser. */}
          <input
            type="email"
            name="email"
            autoComplete="username"
            value={verifiedEmail ?? emailFromUrl ?? ''}
            readOnly
            hidden
          />

          <div className="space-y-2">
            <Label htmlFor="newPassword">{t.auth.firstAccess.newPassword}</Label>
            <PasswordInput
              id="newPassword"
              autoComplete="new-password"
              placeholder={t.auth.firstAccess.passwordPlaceholder}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              {t.auth.firstAccess.passwordHint}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">
              {t.auth.firstAccess.confirmPassword}
            </Label>
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              placeholder={t.auth.firstAccess.passwordPlaceholder}
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
                {t.auth.firstAccess.creating}
              </>
            ) : (
              t.auth.firstAccess.createPassword
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function PrimeiroAcessoPage() {
  return (
    <PublicLocaleWrapper>
      {(locale, setLocale) => (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4 relative">
          <div className="absolute top-4 right-4">
            <LanguageToggle locale={locale} onChange={setLocale} />
          </div>
          <Suspense fallback={null}>
            <PrimeiroAcessoForm />
          </Suspense>
        </div>
      )}
    </PublicLocaleWrapper>
  );
}
