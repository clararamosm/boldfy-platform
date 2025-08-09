
'use client';

import { Header } from "@/components/dashboard/header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function AdminConfiguracoesPage() {
    const { toast } = useToast();
    const [language, setLanguage] = useState("pt-br");

    const handleSaveLanguage = () => {
        toast({
        title: "Idioma salvo!",
        description: `O idioma foi alterado para ${language === 'pt-br' ? 'Português (Brasil)' : 'English (United States)'}.`,
        });
    };

  return (
    <>
      <Header title="Configurações" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid gap-6 max-w-4xl mx-auto">
            {/* Perfil */}
             <Card>
                <CardHeader>
                <CardTitle>Perfil do Administrador</CardTitle>
                <CardDescription>Gerencie as informações da sua conta e empresa.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                    <AvatarImage src="https://placehold.co/100x100.png" data-ai-hint="person avatar" />
                    <AvatarFallback>A</AvatarFallback>
                    </Avatar>
                    <Button variant="outline">Mudar foto</Button>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="name">Nome do Admin</Label>
                    <Input id="name" defaultValue="Admin" />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" defaultValue="admin@boldfy.com.br" disabled />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="companyName">Nome da Empresa</Label>
                    <Input id="companyName" defaultValue="Boldfy" />
                </div>
                </CardContent>
                <CardFooter className="border-t px-6 py-4">
                <Button>Salvar Alterações</Button>
                </CardFooter>
            </Card>

          {/* Configurações da Empresa */}
          <Card>
            <CardHeader>
              <CardTitle>Configurações da Empresa</CardTitle>
              <CardDescription>
                Essas informações treinarão a IA para alinhar o conteúdo dos colaboradores com a voz da sua marca.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
              <Button>Salvar Configurações da Empresa</Button>
            </CardFooter>
          </Card>

            {/* Idioma */}
            <Card>
                <CardHeader>
                <CardTitle>Idioma</CardTitle>
                <CardDescription>Escolha o idioma de exibição do sistema.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="w-[280px]">
                        <SelectValue placeholder="Selecione o idioma" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="pt-br">Português (Brasil)</SelectItem>
                        <SelectItem value="en-us">English (United States)</SelectItem>
                    </SelectContent>
                    </Select>
                </CardContent>
                <CardFooter className="border-t px-6 py-4">
                <Button onClick={handleSaveLanguage}>Salvar Idioma</Button>
                </CardFooter>
            </Card>

            {/* Notificações */}
            <Card>
                <CardHeader>
                <CardTitle>Notificações</CardTitle>
                <CardDescription>Gerencie como você recebe as notificações.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                    <Label htmlFor="new-missions">Resgates de Recompensas</Label>
                    <p className="text-sm text-muted-foreground">
                        Receba alertas quando um colaborador resgatar uma recompensa.
                    </p>
                    </div>
                    <Switch id="new-missions" defaultChecked />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                    <Label htmlFor="new-trails">Novos Colaboradores</Label>
                    <p className="text-sm text-muted-foreground">
                        Seja notificado quando um novo colaborador entrar na plataforma.
                    </p>
                    </div>
                    <Switch id="new-trails" defaultChecked />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                    <Label htmlFor="points-available">Relatórios Semanais</Label>
                    <p className="text-sm text-muted-foreground">
                        Receba relatórios de engajamento da plataforma.
                    </p>
                    </div>
                    <Switch id="points-available" defaultChecked />
                </div>
                </CardContent>
            </Card>
        </div>
      </main>
    </>
  );
}
