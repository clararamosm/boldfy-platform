// src/app/page.tsx
'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, UserCredential } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/logo';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: FormEvent, testUser?: {email: string, pass: string}) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const loginEmail = testUser ? testUser.email : email;
    const loginPassword = testUser ? testUser.pass : password;

    try {
      const userCredential: UserCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      const user = userCredential.user;

      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        const role = userData.role;

        switch (role) {
          case 'master':
            router.push('/master/dashboard');
            break;
          case 'admin':
            router.push('/admin/dashboard');
            break;
          case 'influencer':
            router.push('/influencer/dashboard');
            break;
          default:
            setError('Perfil de usuário não reconhecido.');
            await auth.signOut();
        }
      } else {
        setError('Dados do usuário não encontrados. Contate o suporte.');
        await auth.signOut();
      }
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('E-mail ou senha inválidos.');
      } else {
        setError('Ocorreu um erro ao fazer login. Tente novamente.');
      }
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestLogin = (e: FormEvent, role: 'master' | 'admin' | 'influencer') => {
    const testUsers = {
        master: { email: 'master@boldfy.com', pass: '123456' },
        admin: { email: 'admin@boldfy.com', pass: '123456' },
        influencer: { email: 'influencer@boldfy.com', pass: '123456' },
    }
    handleLogin(e, testUsers[role]);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-secondary/30">
      <div className="w-full max-w-sm">
        <Card className="shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-fit">
              <Logo />
            </div>
            <div className="space-y-1">
                <CardTitle className="font-headline text-3xl">Bem-vindo(a)!</CardTitle>
                <CardDescription>Faça login para acessar sua conta.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
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
                  disabled={isLoading}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Erro no Login</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Entrar
              </Button>
            </form>
             <p className="mt-4 text-center text-xs text-muted-foreground">
                Esqueceu a senha? Contate o administrador.
            </p>
          </CardContent>
          <CardFooter className="flex-col gap-4">
            <div className="relative w-full flex items-center">
              <Separator className="flex-1" />
              <span className="px-2 text-xs text-muted-foreground">Logins de Teste</span>
              <Separator className="flex-1" />
            </div>
             <div className="grid grid-cols-3 gap-2 w-full">
                <Button variant="outline" size="sm" onClick={(e) => handleTestLogin(e, 'master')} disabled={isLoading}>Master</Button>
                <Button variant="outline" size="sm" onClick={(e) => handleTestLogin(e, 'admin')} disabled={isLoading}>Admin</Button>
                <Button variant="outline" size="sm" onClick={(e) => handleTestLogin(e, 'influencer')} disabled={isLoading}>Influencer</Button>
             </div>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
