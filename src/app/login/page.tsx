'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { LogoFull } from '@/components/logo';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'forgotPassword'>('login');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const router = useRouter();

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
if (userRole === 'master') { router.push('/master/empresas'); }
else if (userRole === 'admin') { router.push('/admin/dashboard'); }
else if (userRole === 'colaborador') { router.push('/influencer/dashboard'); }
else { setError('Perfil de usuário não reconhecido.'); setLoading(false); return; }
        }
      } else {
        setError('Perfil de usuário não reconhecido.');
        setLoading(false);
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err) {
        const code = (err as { code: string }).code;
        if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
          setError('Email ou senha incorretos.');
        } else if (code === 'auth/too-many-requests') {
          setError('Muitas tentativas. Tente novamente em alguns minutos.');
        } else {
          setError('Erro ao fazer login. Tente novamente.');
        }
      } else {
        setError('Erro ao fazer login. Tente novamente.');
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
      await sendPasswordResetEmail(auth, email);
      setResetSuccess(true);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err) {
        const code = (err as { code: string }).code;
        if (code === 'auth/user-not-found') {
          setError('Nenhuma conta encontrada com este e-mail.');
        } else if (code === 'auth/invalid-email') {
          setError('E-mail inválido. Verifique e tente novamente.');
        } else if (code === 'auth/too-many-requests') {
          setError('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
        } else {
          setError('Erro ao enviar e-mail de recuperação. Tente novamente.');
        }
      } else {
        setError('Erro ao enviar e-mail de recuperação. Tente novamente.');
      }
    } finally {
      setResetLoading(false);
    }
  };

  const switchToForgotPassword = () => {
    setMode('forgotPassword');
    setError('');
    setResetSuccess(false);
  };

  const switchToLogin = () => {
    setMode('login');
    setError('');
    setResetSuccess(false);
  };

  return (
    <div className="mx-auto mb-4">
  <LogoFull height={48} />
</div>      
          <CardTitle className="text-2xl">
            {mode === 'login' ? 'Bem-vindo de volta' : 'Recuperar senha'}
          </CardTitle>
          <CardDescription>
            {mode === 'login'
              ? 'Entre com suas credenciais para acessar a plataforma'
              : 'Digite seu e-mail para receber o link de recuperação'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && (
                <div className="text-sm text-red-500 text-center">{error}</div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
              <button
                type="button"
                onClick={switchToForgotPassword}
                className="w-full text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Esqueci minha senha
              </button>
            </form>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {error && (
                <div className="text-sm text-red-500 text-center">{error}</div>
              )}
              {resetSuccess && (
                <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
                  Email de recuperação enviado! Verifique sua caixa de entrada e a pasta de spam.
                </div>
              )}
              <Button type="submit" className="w-full" disabled={resetLoading}>
                {resetLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Enviar link de recuperação'
                )}
              </Button>
              <button
                type="button"
                onClick={switchToLogin}
                className="w-full text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Voltar para o login
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
