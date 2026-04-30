'use client';

import { Suspense, useEffect, useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { triggerAdminFirstLogin } from '@/app/actions/billing';
import { requestPasswordReset } from '@/app/actions/users';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { LogoFull } from '@/components/logo';
import { PublicLocaleWrapper } from '@/components/public-locale-wrapper';
import { LanguageToggle } from '@/components/language-toggle';
import { useT } from '@/lib/i18n/context';

function LoginForm() {
  const t = useT();
  const searchParams = useSearchParams();

  // Quando o usuario chega aqui depois de criar a senha em /primeiro-acesso,
  // mostramos um banner verde e ja preenchemos o email.
  const justCreatedPassword = searchParams.get('primeiroAcesso') === '1';
  const emailFromUrl = searchParams.get('email') ?? '';

  const [email, setEmail] = useState(emailFromUrl);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'forgotPassword'>('login');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [showFirstAccessBanner, setShowFirstAccessBanner] = useState(justCreatedPassword);
  const router = useRouter();

  // Mantem email sincronizado se o param mudar (caso edge de navegacao).
  useEffect(() => {
    if (emailFromUrl && !email) setEmail(emailFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailFromUrl]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const userRole = userData.role;
        // Set signed HttpOnly session cookie via server API BEFORE redirect
        // The middleware requires HMAC-signed cookies — plain cookies get rejected
        const idToken = await user.getIdToken();
        const sessionRes = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
        if (!sessionRes.ok) {
          setError(t.auth.errors.generic);
          setLoading(false);
          return;
        }
        if (userRole === 'master') { router.push('/master/empresas'); }
        else if (userRole === 'admin') {
          // Idempotente: dispara onboarding billing no primeiro login do admin
          await triggerAdminFirstLogin(idToken);
          router.push('/admin/dashboard');
        }
        else if (userRole === 'colaborador') { router.push('/colaborador/dashboard'); }
        else if (userRole === 'thoughtleader') { router.push('/thoughtleader/backlog'); }
        else if (userRole === 'strategist') { router.push('/strategist/dashboard'); }
        else { setError(t.auth.errors.profileNotRecognized); setLoading(false); return; }
      } else {
        setError(t.auth.errors.profileNotRecognized);
        setLoading(false);
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err) {
        const code = (err as { code: string }).code;
        if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
          setError(t.auth.errors.wrongCredentials);
        } else if (code === 'auth/too-many-requests') {
          setError(t.auth.errors.tooManyRequests);
        } else {
          setError(t.auth.errors.generic);
        }
      } else {
        setError(t.auth.errors.generic);
      }
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResetSuccess(false);
    setResetLoading(true);
    try {
      // Server action: gera link branded apontando pra /redefinir-senha
      // e manda email pelo nosso template (mesma logica do invite).
      // Sempre devolve success pra nao vazar quais emails estao cadastrados.
      const res = await requestPasswordReset(email);
      if ('error' in res) {
        // Unico caso de erro exposto: email mal formado.
        setError(res.error);
      } else {
        setResetSuccess(true);
      }
    } catch (err: unknown) {
      console.error('[login/forgotPassword] erro:', err);
      setError(t.auth.errors.resetGeneric);
    } finally {
      setResetLoading(false);
    }
  };

  const switchToForgotPassword = () => { setMode('forgotPassword'); setError(''); setResetSuccess(false); };
  const switchToLogin = () => { setMode('login'); setError(''); setResetSuccess(false); };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4">
          <LogoFull height={48} />
        </div>
        <CardTitle className="text-2xl">
          {mode === 'login' ? t.auth.welcomeBack : t.auth.resetPassword}
        </CardTitle>
        <CardDescription>
          {mode === 'login'
            ? t.auth.loginSubtitle
            : t.auth.resetSubtitle}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            {showFirstAccessBanner && (
              <div className="flex items-start gap-2 rounded-md bg-green-50 p-3 text-sm text-green-700">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{t.auth.firstAccess.bannerLoginNow}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t.auth.email}</Label>
              <Input id="email" type="email" placeholder={t.auth.emailPlaceholder} value={email} onChange={(e) => { setEmail(e.target.value); setShowFirstAccessBanner(false); }} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t.auth.password}</Label>
              <PasswordInput id="password" placeholder="••••••••" value={password} onChange={(e) => { setPassword(e.target.value); setShowFirstAccessBanner(false); }} required />
            </div>
            {error && (<div className="text-sm text-red-500 text-center">{error}</div>)}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t.auth.loggingIn}</>) : (t.auth.login)}
            </Button>
            <button type="button" onClick={switchToForgotPassword} className="w-full text-sm text-muted-foreground hover:text-primary transition-colors">
              {t.auth.forgotPassword}
            </button>
          </form>
        ) : (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">{t.auth.email}</Label>
              <Input id="reset-email" type="email" placeholder={t.auth.emailPlaceholder} value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {error && (<div className="text-sm text-red-500 text-center">{error}</div>)}
            {resetSuccess && (
              <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
                {t.auth.resetEmailSent}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={resetLoading}>
              {resetLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t.common.loading}</>) : (t.auth.sendResetLink)}
            </Button>
            <button type="button" onClick={switchToLogin} className="w-full text-sm text-muted-foreground hover:text-primary transition-colors">
              {t.auth.backToLogin}
            </button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <PublicLocaleWrapper>
      {(locale, setLocale) => (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4 relative">
          <div className="absolute top-4 right-4">
            <LanguageToggle locale={locale} onChange={setLocale} />
          </div>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      )}
    </PublicLocaleWrapper>
  );
}
