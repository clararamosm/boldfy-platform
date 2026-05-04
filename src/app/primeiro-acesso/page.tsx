'use client';

// src/app/primeiro-acesso/page.tsx
// Pagina hospedada no nosso dominio pra primeiro acesso de qualquer
// role (admin, colaborador, tl, strategist).
//
// Usa token customizado (armazenado no Firestore) com validade de
// 72 horas — em vez do oobCode do Firebase que expira em 1 hora.
//
// O token e validado e consumido via API routes server-side:
//   POST /api/invite/verify  → valida token, retorna email
//   POST /api/invite/confirm → consome token, seta senha via Admin SDK
//
// IMPORTANTE: nao fazemos auto-login aqui. O usuario PRECISA passar
// pelo /login pra que o trigger `triggerAdminFirstLogin` (e similares)
// dispare e a empresa fique marcada como "ativada".

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

  const token = searchParams.get('token');
  const emailFromUrl = searchParams.get('email');

  const [verifying, setVerifying] = useState(true);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Verifica token no mount via API server-side.
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!token) {
        if (!cancelled) {
          setVerifyError(t.auth.firstAccess.errors.missingCode);
          setVerifying(false);
        }
        return;
      }
      try {
        const res = await fetch('/api/invite/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();

        if (cancelled) return;

        if (!res.ok) {
          if (data.error === 'token-expired') {
            setVerifyError(t.auth.firstAccess.errors.expiredCode);
          } else {
            setVerifyError(t.auth.firstAccess.errors.invalidCode);
          }
          setVerifying(false);
          return;
        }

        setVerifiedEmail(data.email);
        setVerifying(false);
      } catch {
        if (cancelled) return;
        setVerifyError(t.auth.firstAccess.errors.invalidCode);
        setVerifying(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [token, t.auth.firstAccess.errors]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!token || !verifiedEmail) {
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

    // Define a senha via API server-side. NAO fazemos auto-login:
    // usuario precisa passar pelo /login pra disparar o trigger de
    // "primeiro login" (ex.: ativacao da empresa visivel pro master).
    try {
      const res = await fetch('/api/invite/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'token-expired') {
          setSubmitError(t.auth.firstAccess.errors.expiredCode);
        } else if (data.error === 'weak-password') {
          setSubmitError(t.auth.firstAccess.errors.weakPassword);
        } else {
          setSubmitError(t.auth.firstAccess.errors.confirmFailed);
        }
        setSubmitting(false);
        return;
      }
    } catch {
      setSubmitError(t.auth.firstAccess.errors.confirmFailed);
      setSubmitting(false);
      return;
    }

    // Redireciona pro login com flag pra mostrar banner de sucesso e
    // pre-preencher o email.
    const params = new URLSearchParams({ primeiroAcesso: '1' });
    if (verifiedEmail) params.set('email', verifiedEmail);
    router.push(`/login?${params.toString()}`);
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
