// src/app/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, AuthErrorCodes } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
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
      
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
           throw new Error("User document not found in Firestore.");
      }
      
      const userRole = userDocSnap.data().role;

      toast({
        title: 'Login bem-sucedido!',
        description: 'Redirecionando para o seu dashboard.',
      });

      // Redirect based on user role from Firestore
      if (userRole === 'master') {
        router.push('/master/dashboard');
      } else if (userRole === 'admin') {
        router.push('/admin/dashboard');
      } else {
        router.push('/influencer/dashboard');
      }

    } catch (error: any) {
       let errorMessage = 'Ocorreu um erro desconhecido.';
        if (error.code) {
            switch (error.code) {
                case AuthErrorCodes.USER_DELETED:
                    errorMessage = 'Este usuário foi excluído.';
                    break;
                case 'auth/invalid-credential':
                    errorMessage = 'Credenciais inválidas. Verifique seu e-mail e senha.';
                    break;
                default:
                    errorMessage = error.message;
            }
        } else {
            errorMessage = error.toString();
        }
      
      toast({
            variant: 'destructive',
            title: 'Erro no Login',
            description: errorMessage,
        });
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
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
