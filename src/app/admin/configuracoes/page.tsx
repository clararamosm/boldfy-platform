// src/app/admin/configuracoes/page.tsx
'use client';

import { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
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
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";


type ProfileData = {
    adminName: string;
    companyName: string;
    email: string;
};

type CompanyBrandingData = {
    tagline: string;
    audience: string;
    tone: string;
    messages: string;
};

const companyId = "company-123"; // In a real app, this would come from the user's session

export default function AdminConfiguracoesPage() {
    const { toast } = useToast();
    const [language, setLanguage] = useState("pt-br");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [profile, setProfile] = useState<ProfileData>({ adminName: '', companyName: '', email: '' });
    const [branding, setBranding] = useState<CompanyBrandingData>({ tagline: '', audience: '', tone: '', messages: '' });

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch profile and branding data from Firestore
                const companyDocRef = doc(db, "companies", companyId);
                const companyDocSnap = await getDoc(companyDocRef);

                if (companyDocSnap.exists()) {
                    const data = companyDocSnap.data();
                    setProfile({
                        adminName: data.adminProfile?.name || 'Admin',
                        companyName: data.companyName || 'Boldfy',
                        email: data.adminProfile?.email || 'admin@boldfy.com.br'
                    });
                    setBranding({
                        tagline: data.branding?.tagline || '',
                        audience: data.branding?.audience || '',
                        tone: data.branding?.tone || '',
                        messages: data.branding?.messages || ''
                    });
                } else {
                    // Set default data if doc doesn't exist
                    setProfile({ adminName: 'Admin', companyName: 'Boldfy', email: 'admin@boldfy.com.br' });
                    setBranding({ tagline: 'Turning Employees into Brand Influencers.', audience: 'Internal employees of our client companies.', tone: 'Encouraging, motivating, and professional.', messages: 'Emphasize participation, learning, and brand advocacy.'});
                }
            } catch (error) {
                console.error("Error fetching settings: ", error);
                toast({
                    variant: 'destructive',
                    title: "Erro ao carregar configurações",
                    description: "Não foi possível buscar os dados. Tente novamente mais tarde.",
                });
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [toast]);
    
    const handleSaveChanges = async (section: 'profile' | 'branding') => {
        setIsSaving(true);
        try {
            const companyDocRef = doc(db, "companies", companyId);
            
            let dataToSave = {};
            if (section === 'profile') {
                dataToSave = { 
                    companyName: profile.companyName,
                    adminProfile: {
                        name: profile.adminName,
                        email: profile.email // email is not editable, so we save it back as is
                    }
                };
            } else {
                 dataToSave = { 
                    branding: branding
                };
            }

            await setDoc(companyDocRef, dataToSave, { merge: true });

            toast({
                title: "Sucesso!",
                description: `As configurações de ${section === 'profile' ? 'perfil' : 'empresa'} foram salvas.`,
            });
        } catch (error) {
             console.error("Error saving settings: ", error);
             toast({
                variant: 'destructive',
                title: "Erro ao salvar",
                description: "Não foi possível salvar as alterações. Tente novamente.",
            });
        } finally {
            setIsSaving(false);
        }
    };


    const handleSaveLanguage = () => {
        // This remains client-side for now, could be saved to user profile in Firestore
        toast({
            title: "Idioma salvo!",
            description: `O idioma foi alterado para ${language === 'pt-br' ? 'Português (Brasil)' : 'English (United States)'}.`,
        });
    };

    if (isLoading) {
        return (
             <>
                <Header title="Configurações" />
                <main className="flex-1 overflow-auto p-4 md:p-6">
                    <div className="grid gap-6 max-w-4xl mx-auto">
                        <Card>
                            <CardHeader>
                                <Skeleton className="h-7 w-48" />
                                <Skeleton className="h-4 w-full max-w-sm" />
                            </CardHeader>
                            <CardContent className="space-y-4">
                               <div className="flex items-center gap-4">
                                    <Skeleton className="h-20 w-20 rounded-full" />
                                    <Skeleton className="h-10 w-28" />
                                </div>
                                <div className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-10 w-full" /></div>
                                <div className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-10 w-full" /></div>
                                <div className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-10 w-full" /></div>
                            </CardContent>
                             <CardFooter className="border-t px-6 py-4">
                                <Skeleton className="h-10 w-32" />
                            </CardFooter>
                        </Card>
                    </div>
                </main>
            </>
        )
    }

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
                    <AvatarFallback>{profile.adminName?.[0] || 'A'}</AvatarFallback>
                    </Avatar>
                    <Button variant="outline">Mudar foto</Button>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="name">Nome do Admin</Label>
                    <Input id="name" value={profile.adminName} onChange={e => setProfile({...profile, adminName: e.target.value})} />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" value={profile.email} disabled />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="companyName">Nome da Empresa</Label>
                    <Input id="companyName" value={profile.companyName} onChange={e => setProfile({...profile, companyName: e.target.value})} />
                </div>
                </CardContent>
                <CardFooter className="border-t px-6 py-4">
                    <Button onClick={() => handleSaveChanges('profile')} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Salvar Alterações
                    </Button>
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
                <Input id="tagline" placeholder="Sua tagline ou slogan" value={branding.tagline} onChange={e => setBranding({...branding, tagline: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="audience">Público-alvo</Label>
                <Textarea id="audience" placeholder="Descreva seu público-alvo" value={branding.audience} onChange={e => setBranding({...branding, audience: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tone">Tom de Voz</Label>
                <Textarea id="tone" placeholder="Descreva o tom de voz da marca" value={branding.tone} onChange={e => setBranding({...branding, tone: e.target.value})} />
              </div>
               <div className="space-y-2">
                <Label htmlFor="messages">Mensagens-chave</Label>
                <Textarea id="messages" placeholder="Quais são as mensagens principais que devem ser comunicadas?" value={branding.messages} onChange={e => setBranding({...branding, messages: e.target.value})} />
              </div>
            </CardContent>
            <CardFooter className="border-t px-6 py-4">
                 <Button onClick={() => handleSaveChanges('branding')} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar Configurações da Empresa
                </Button>
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
