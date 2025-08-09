// src/app/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/logo';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // For demonstration, we'll try to log in and redirect based on a mock logic.
      // In a real app, you'd fetch the user's role from Firestore after login.
      await signInWithEmailAndPassword(auth, email, password);
      
      toast({
        title: 'Login bem-sucedido!',
        description: 'Redirecionando para o seu dashboard.',
      });

      // Mock redirection logic based on email
      if (email.includes('master@')) {
        router.push('/master/dashboard');
      } else if (email.includes('admin@')) {
        router.push('/admin/dashboard');
      } else {
        router.push('/influencer/dashboard');
      }

    } catch (error: any) {
      console.error(error);
      // In a real app, you might want to create a user if they don't exist.
      // For this demo, we assume users are pre-created or we show an error.
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
         toast({
            variant: 'destructive',
            title: 'Erro no Login',
            description: 'Credenciais inválidas. Por favor, tente novamente.',
        });
      } else if (error.code === 'auth/wrong-password') {
         toast({
            variant: 'destructive',
            title: 'Erro no Login',
            description: 'Senha incorreta. Por favor, tente novamente.',
        });
      }
      else {
        toast({
            variant: 'destructive',
            title: 'Erro no Login',
            description: 'Ocorreu um erro desconhecido.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <Card className="shadow-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex items-center justify-center">
               <Logo />
            </div>
            <CardTitle className="font-headline text-3xl">Boldfy</CardTitle>
            <CardDescription>Faça login para começar sua jornada como um influenciador da marca.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="seu@email.com" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input 
                  id="password" 
                  type="password" 
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <Button type="submit" className="w-full font-bold" disabled={isLoading}>
                {isLoading ? <Loader2 className="animate-spin" /> : 'Login'}
              </Button>
            </form>
             <div className="mt-6 space-y-2 text-center">
                <p className="text-sm text-muted-foreground">Para demonstração (use qualquer senha):</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <Button onClick={() => setEmail('clara@boldfy.com.br')} variant="outline" className="w-full text-xs">
                        Logar como Influenciador
                    </Button>
                    <Button onClick={() => setEmail('admin@boldfy.com.br')} variant="outline" className="w-full text-xs">
                       Logar como Admin
                    </Button>
                    <Button onClick={() => setEmail('master@boldfy.com.br')} variant="outline" className="w-full text-xs">
                        Logar como Master
                    </Button>
                </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
