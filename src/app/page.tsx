// src/app/page.tsx
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/logo';
import { Shield, User, Star } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';

export default function LoginPage() {
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
                className="justify-start"
                asChild
              >
                <Link href="/master/dashboard">
                    <Shield className="mr-2 h-4 w-4" />
                    Entrar como Master
                </Link>
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                asChild
              >
                 <Link href="/admin/dashboard">
                    <User className="mr-2 h-4 w-4" />
                    Entrar como Admin
                </Link>
              </Button>
               <Button
                variant="outline"
                className="justify-start"
                asChild
              >
                <Link href="/influencer/dashboard">
                    <Star className="mr-2 h-4 w-4" />
                    Entrar como Influencer
                </Link>
              </Button>
            </div>
             <p className="text-xs text-muted-foreground text-center pt-2">
                Clique em um perfil para navegar diretamente para o dashboard correspondente.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
