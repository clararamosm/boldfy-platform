// src/app/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
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
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      toast({
        title: 'Login bem-sucedido!',
        description: 'Redirecionando para o seu dashboard.',
      });

      // Redirect based on email for demo purposes
      if (email.includes('master@')) {
        router.push('/master/dashboard');
      } else if (email.includes('admin@')) {
        router.push('/admin/dashboard');
      } else {
        router.push('/influencer/dashboard');
      }

    } catch (error: any) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        // Simple demo logic: if user doesn't exist, create one.
        // In a real app, this would be a separate "Sign Up" flow.
        try {
          const newUserCredential = await createUserWithEmailAndPassword(auth, email, password);
          const user = newUserCredential.user;

          // Create a user document in Firestore
          const userRole = email.includes('master@') ? 'master' : email.includes('admin@') ? 'admin' : 'influencer';
          await setDoc(doc(db, "users", user.uid), {
            email: user.email,
            role: userRole,
            createdAt: new Date(),
          });
          
           toast({
            title: 'Conta criada com sucesso!',
            description: 'Redirecionando para o seu dashboard.',
          });

          // Redirect after creation
          if (userRole === 'master') {
            router.push('/master/dashboard');
          } else if (userRole === 'admin') {
            router.push('/admin/dashboard');
          } else {
            router.push('/influencer/dashboard');
          }

        } catch (createError: any) {
            toast({
                variant: 'destructive',
                title: 'Erro ao criar conta',
                description: createError.message,
            });
        }
      } else {
        toast({
            variant: 'destructive',
            title: 'Erro no Login',
            description: 'Credenciais inválidas ou ocorreu um erro.',
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
                {isLoading ? <Loader2 className="animate-spin" /> : 'Login ou Criar Conta'}
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
