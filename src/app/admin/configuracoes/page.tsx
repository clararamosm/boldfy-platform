'use client';

import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function AdminConfiguracoesPage() {

  return (
    <>
      <Header title="Configurações da Empresa" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid gap-6 max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Setup da Empresa</CardTitle>
              <CardDescription>
                Essas informações treinarão a IA para alinhar o conteúdo dos colaboradores com a voz da sua marca.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Nome da Empresa</Label>
                <Input id="companyName" defaultValue="Boldfy" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tagline">Tagline</Label>
                <Input id="tagline" placeholder="Sua tagline ou slogan" defaultValue="Turning Employees into Brand Influencers." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="audience">Público-alvo</Label>
                <Textarea id="audience" placeholder="Descreva seu público-alvo" defaultValue="Internal employees of our client companies." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tone">Tom de Voz</Label>
                <Textarea id="tone" placeholder="Descreva o tom de voz da marca" defaultValue="Encouraging, motivating, and professional." />
              </div>
               <div className="space-y-2">
                <Label htmlFor="messages">Mensagens-chave</Label>
                <Textarea id="messages" placeholder="Quais são as mensagens principais que devem ser comunicadas?" defaultValue="Emphasize participation, learning, and brand advocacy." />
              </div>
            </CardContent>
            <CardFooter className="border-t px-6 py-4">
              <Button>Salvar Configurações</Button>
            </CardFooter>
          </Card>
        </div>
      </main>
    </>
  );
}
