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

export default function SettingsPage() {
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
              <CardTitle>Perfil</CardTitle>
              <CardDescription>Gerencie as informações da sua conta.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src="https://placehold.co/100x100.png" data-ai-hint="person avatar" />
                  <AvatarFallback>U</AvatarFallback>
                </Avatar>
                <Button variant="outline">Mudar foto</Button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" defaultValue="Clara" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" defaultValue="clara@boldfy.com.br" disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Empresa</Label>
                <Input id="company" defaultValue="Boldfy" disabled />
              </div>
            </CardContent>
            <CardFooter className="border-t px-6 py-4">
              <Button>Salvar Alterações</Button>
            </CardFooter>
          </Card>

          {/* Branding Pessoal */}
          <Card>
            <CardHeader>
              <CardTitle>Branding Pessoal</CardTitle>
              <CardDescription>
                Essas informações ajudarão o assistente de IA a criar conteúdos alinhados com sua voz e expertise.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="voice">Tom de Voz</Label>
                 <Select defaultValue="amigavel">
                  <SelectTrigger id="voice">
                    <SelectValue placeholder="Selecione um tom" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="amigavel">Amigável</SelectItem>
                    <SelectItem value="profissional">Profissional</SelectItem>
                    <SelectItem value="informativo">Informativo</SelectItem>
                    <SelectItem value="inspirador">Inspirador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expertise">Expertises</Label>
                <Input id="expertise" placeholder="Ex: Marketing Digital, Vendas, Liderança" />
              </div>
               <div className="space-y-2">
                <Label htmlFor="value">Entrega de Valor</Label>
                <Textarea id="value" placeholder="O que você oferece de único para sua audiência?" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">Qual sua posição na empresa?</Label>
                <Input id="position" placeholder="Ex: Gerente de Marketing" />
              </div>
            </CardContent>
             <CardFooter className="border-t px-6 py-4">
              <Button>Salvar Branding</Button>
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
                  <Label htmlFor="new-missions">Novas Missões</Label>
                  <p className="text-sm text-muted-foreground">
                    Receba alertas quando novas missões estiverem disponíveis.
                  </p>
                </div>
                <Switch id="new-missions" defaultChecked />
              </div>
               <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="new-trails">Novas Trilhas</Label>
                   <p className="text-sm text-muted-foreground">
                    Seja notificado sobre novas trilhas de aprendizagem.
                  </p>
                </div>
                <Switch id="new-trails" defaultChecked />
              </div>
               <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="points-available">Pontos Disponíveis</Label>
                   <p className="text-sm text-muted-foreground">
                    Lembretes mensais sobre seus pontos.
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
