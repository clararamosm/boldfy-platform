// src/app/page.tsx
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/logo';
import Link from 'next/link';

export default function TestHomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-secondary/30">
      <div className="w-full max-w-sm">
        <Card className="shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-fit">
              <Logo />
            </div>
            <div className="space-y-1">
                <CardTitle className="font-headline text-3xl">Portal de Testes</CardTitle>
                <CardDescription>Selecione um perfil para acessar o painel.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button asChild size="lg">
              <Link href="/master/dashboard">Acessar como Master</Link>
            </Button>
            <Button asChild size="lg">
              <Link href="/admin/dashboard">Acessar como Admin</Link>
            </Button>
            <Button asChild size="lg">
              <Link href="/influencer/dashboard">Acessar como Influencer</Link>
            </Button>
             <Button variant="outline" asChild>
                <Link href="/login">Ir para a página de Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
