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
import { Loader2, Shield, User, Star } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

type Role = 'master' | 'admin' | 'influencer';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState<Role | false>(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleTestLogin = async (role: Role) => {
    setIsLoading(role);

    const credentials = {
      master: { email: 'master@boldfy.com', password: 'master123', path: '/master/dashboard'},
      admin: { email: 'admin@empresa.com', password: 'admin123', path: '/admin/dashboard'},
      influencer: { email: 'influencer@empresa.com', password: 'influencer123', path: '/influencer/dashboard'}
    };

    const { email, password, path } = credentials[role];

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      toast({
        title: 'Login bem-sucedido!',
        description: 'Redirecionando para o seu dashboard.',
      });
      
      router.push(path);

    } catch (error: any) {
       let errorMessage = 'Ocorreu um erro desconhecido.';
        if (error.code) {
            switch (error.code) {
                case 'auth/user-not-found':
                    errorMessage = `Usuário de teste '${email}' não encontrado. Crie-o no seu console do Firebase (Authentication e Firestore) para testar.`;
                    break;
                case 'auth/invalid-credential':
                    errorMessage = 'Credenciais de teste inválidas. Verifique a senha ou crie o usuário no Firebase.';
                    break;
                default:
                    errorMessage = error.message;
            }
        } else {
            errorMessage = error.toString();
        }
      
      toast({
            variant: 'destructive',
            title: 'Erro no Login de Teste',
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
            <CardDescription>Plataforma de gamificação para embaixadores de marca.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Separator />
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center">
                <span className="bg-card px-2 text-sm text-muted-foreground">Acesso Rápido para Testes</span>
              </div>
            </div>
            <div className="flex flex-col space-y-2">
              <Button
                variant="outline"
                onClick={() => handleTestLogin('master')}
                disabled={!!isLoading}
                className="justify-start"
              >
                {isLoading === 'master' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
                Entrar como Master
              </Button>
              <Button
                variant="outline"
                onClick={() => handleTestLogin('admin')}
                disabled={!!isLoading}
                className="justify-start"
              >
                {isLoading === 'admin' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <User className="mr-2 h-4 w-4" />}
                Entrar como Admin
              </Button>
               <Button
                variant="outline"
                onClick={() => handleTestLogin('influencer')}
                disabled={!!isLoading}
                className="justify-start"
              >
                {isLoading === 'influencer' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Star className="mr-2 h-4 w-4" />}
                Entrar como Influencer
              </Button>
            </div>
             <p className="text-xs text-muted-foreground text-center pt-2">
                Certifique-se de que os usuários de teste (ex: master@boldfy.com) foram criados no seu console do Firebase.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
