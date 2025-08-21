// src/app/influencer/configuracoes/page.tsx
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
import { useState, useEffect, useCallback } from "react";
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type ProfileData = {
  name: string;
  email: string;
  company: string;
};

type BrandingData = {
  voice: string;
  expertise: string;
  value: string;
  position: string;
};


const SettingsSkeleton = () => (
    <>
      <Header title="Configurações" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid gap-6 max-w-4xl mx-auto">
          <Card>
              <CardHeader>
                  <CardTitle><Skeleton className="h-7 w-24" /></CardTitle>
                  <CardDescription><Skeleton className="h-4 w-72" /></CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                      <Skeleton className="h-20 w-20 rounded-full" />
                      <Skeleton className="h-10 w-28" />
                  </div>
                  <div className="space-y-2"><Skeleton className="h-4 w-12" /><Skeleton className="h-10 w-full" /></div>
                  <div className="space-y-2"><Skeleton className="h-4 w-12" /><Skeleton className="h-10 w-full" /></div>
                  <div className="space-y-2"><Skeleton className="h-4 w-12" /><Skeleton className="h-10 w-full" /></div>
              </CardContent>
          </Card>
           <Card>
              <CardHeader>
                   <CardTitle><Skeleton className="h-7 w-40" /></CardTitle>
                  <CardDescription><Skeleton className="h-4 w-96" /></CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                  <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
                  <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
                  <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-20 w-full" /></div>
                  <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
              </CardContent>
          </Card>
           <div className="flex justify-end">
             <Skeleton className="h-10 w-36" />
           </div>
        </div>
      </main>
    </>
)

export default function SettingsPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileData>({ name: '', email: '', company: '' });
  const [branding, setBranding] = useState<BrandingData>({ voice: 'amigavel', expertise: '', value: '', position: '' });
  
  const fetchData = useCallback(async (userId: string) => {
    setIsLoading(true);
    try {
      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const data = userDocSnap.data();
        setProfile({
          name: data.profile?.name || '',
          email: data.profile?.email || '',
          company: data.companyName || 'N/A'
        });
        setBranding({
          voice: data.personalBranding?.voice || 'amigavel',
          expertise: data.personalBranding?.expertise || '',
          value: data.personalBranding?.value || '',
          position: data.personalBranding?.position || '',
        });
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      toast({
        variant: 'destructive',
        title: "Erro ao carregar dados",
        description: "Não foi possível buscar suas informações. Tente novamente.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
            if (user) {
                setCurrentUserId(user.uid);
                fetchData(user.uid);
            } else {
                setIsLoading(false);
            }
        });
        return () => unsubscribe();
  }, [fetchData]);

  const handleSave = async () => {
    if (!currentUserId) return;
    setIsSaving(true);
    try {
        const userDocRef = doc(db, "users", currentUserId);
        
        const dataToSave = {
            profile: {
                name: profile.name,
                // Email is intentionally not saved here to prevent mismatches with auth
            },
            personalBranding: branding
        };

        await setDoc(userDocRef, dataToSave, { merge: true });

        toast({
            title: "Sucesso!",
            description: `Suas configurações de perfil e branding foram salvas.`,
        });

    } catch (error) {
        console.error("Error saving settings:", error);
        toast({
            variant: 'destructive',
            title: "Erro ao salvar",
            description: "Não foi possível salvar suas alterações. Tente novamente.",
        });
    } finally {
        setIsSaving(false);
    }
  };

  if (isLoading) {
    return <SettingsSkeleton />
  }

  return (
    <>
      <Header title="Configurações" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid gap-6 max-w-4xl mx-auto">
          {/* Perfil */}
          <Card>
            <CardHeader>
              <CardTitle>Perfil e Branding Pessoal</CardTitle>
              <CardDescription>Gerencie suas informações e como a IA deve se comunicar em seu nome.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src="https://placehold.co/100x100.png" data-ai-hint="person avatar" />
                  <AvatarFallback>{profile.name?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                </Avatar>
                <Button variant="outline">Mudar foto</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input id="name" value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} disabled={isSaving} />
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="position">Qual sua posição na empresa?</Label>
                  <Input id="position" placeholder="Ex: Gerente de Marketing" value={branding.position} onChange={e => setBranding({...branding, position: e.target.value})} disabled={isSaving} />
                </div>
              </div>
               <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={profile.email} disabled />
              </div>
               <div className="space-y-2">
                <Label htmlFor="voice">Tom de Voz</Label>
                 <Select value={branding.voice} onValueChange={value => setBranding({...branding, voice: value})} disabled={isSaving}>
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
                <Input id="expertise" placeholder="Ex: Marketing Digital, Vendas, Liderança" value={branding.expertise} onChange={e => setBranding({...branding, expertise: e.target.value})} disabled={isSaving} />
              </div>
               <div className="space-y-2">
                <Label htmlFor="value">Entrega de Valor</Label>
                <Textarea id="value" placeholder="O que você oferece de único para sua audiência?" value={branding.value} onChange={e => setBranding({...branding, value: e.target.value})} disabled={isSaving} />
              </div>
            </CardContent>
             <CardFooter>
                 <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar Alterações
                </Button>
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
