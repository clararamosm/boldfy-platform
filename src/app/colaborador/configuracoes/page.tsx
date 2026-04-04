// src/app/colaborador/configuracoes/page.tsx
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
import { useState, useEffect, useCallback, useRef } from "react";
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth, storage } from '@/lib/firebase';
import { Loader2, Camera } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type ProfileData = {
    name: string;
    email: string;
    company: string;
  photoURL?: string;
};

type BrandingData = {
    voice: string;
    expertise: string;
    value: string;
    position: string;
};

function SettingsSkeleton() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-4 w-[150px]" />
                </div>
            </div>
            <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
        </div>
    );
}

export default function SettingsPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [profile, setProfile] = useState<ProfileData>({ name: '', email: '', company: '' });
    const [branding, setBranding] = useState<BrandingData>({ voice: 'amigavel', expertise: '', value: '', position: '' });

    const fetchData = useCallback(async (userId: string) => {
        try {
            setIsLoading(true);
            const userDocRef = doc(db, 'users', userId);
            const userSnapshot = await getDoc(userDocRef);

            if (userSnapshot.exists()) {
                const data = userSnapshot.data();
          setProfile({
            name: data.profile?.name || data.name || '',
            email: data.profile?.email || data.email || '',
            company: data.companyName || '',
            photoURL: data.photoURL || '',
          });
                setBranding({
                    voice: data.voice || 'amigavel',
                    expertise: data.expertise || '',
                    value: data.value || '',
                    position: data.position || '',
                });
            } else {
                toast({
                    title: "Perfil não encontrado",
                    description: "Não foi possível encontrar os dados do seu perfil.",
                    variant: "destructive",
                });
            }
        } catch (error) {
            console.error("Erro ao buscar dados do usuário:", error);
            toast({
                title: "Erro ao carregar dados",
                description: "Ocorreu um erro ao carregar suas configurações. Tente novamente.",
                variant: "destructive",
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
                setCurrentUserId(null);
                setIsLoading(false);
                toast({
                    title: "Usuário não autenticado",
                    description: "Faça login para acessar as configurações.",
                    variant: "destructive",
                });
            }
        });

        return () => unsubscribe();
    }, [fetchData, toast]);

    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const user = auth.currentUser;
    if (!user) return;
    setIsUploadingPhoto(true);
    try {
      const fileRef = storageRef(storage, `users/${user.uid}/profile-photo`);
      uploadBytes(fileRef, file).then(() => {
        getDownloadURL(fileRef).then((downloadURL) => {
          const userDocRef = doc(db, "users", user.uid);
          setDoc(userDocRef, { photoURL: downloadURL }, { merge: true }).then(() => {
            setProfile(prev => prev ? { ...prev, photoURL: downloadURL } : prev);
            toast({ title: "Foto atualizada!", description: "Sua foto de perfil foi salva com sucesso." });
            setIsUploadingPhoto(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
          });
        });
      });
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast({ variant: "destructive", title: "Erro no upload", description: "N\u00e3o foi poss\u00edvel atualizar a foto." });
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

    const handleSave = async () => {
        if (!currentUserId) {
            toast({
                title: "Erro",
                description: "Usuário não identificado. Faça login novamente.",
                variant: "destructive",
            });
            return;
        }

        setIsSaving(true);
        try {
            const userDocRef = doc(db, 'users', currentUserId);
            await setDoc(userDocRef, {
                voice: branding.voice,
                expertise: branding.expertise,
                value: branding.value,
                position: branding.position,
            }, { merge: true });

            toast({
                title: "Configurações salvas",
                description: "Suas configurações foram atualizadas com sucesso.",
            });
        } catch (error) {
            console.error("Erro ao salvar configurações:", error);
            toast({
                title: "Erro ao salvar",
                description: "Não foi possível salvar suas configurações. Tente novamente.",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col">
            <Header />
            <main className="flex-1 p-6 md:p-10">
                <div className="mx-auto max-w-4xl space-y-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
                        <p className="text-muted-foreground">
                            Gerencie suas configurações de conta e preferências de marca pessoal.
                        </p>
                    </div>

                    {isLoading ? (
                        <SettingsSkeleton />
                    ) : (
                        <>
                            {/* Perfil */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Perfil</CardTitle>
                                    <CardDescription>
                                        Suas informações pessoais e dados de contato.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                                                        <div className="flex items-center gap-4">
                                        <div className="relative">
                                            <Avatar className="h-16 w-16">
                                                <AvatarImage src={profile?.photoURL || ""} />
                                                <AvatarFallback>
                                                    {profile?.name?.[0]?.toUpperCase() || "U"}
                                                </AvatarFallback>
                                            </Avatar>
                                            {isUploadingPhoto && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
                                                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                                            <Button variant="outline" size="sm" disabled={isUploadingPhoto} onClick={() => fileInputRef.current?.click()}>
                                                <Camera className="h-4 w-4 mr-2" />
                                                {isUploadingPhoto ? "Enviando..." : "Alterar foto"}
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="name">Nome completo</Label>
                                            <Input
                                                id="name"
                                                value={profile.name}
                                                readOnly
                                                disabled
                                                className="bg-muted cursor-not-allowed"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="email">E-mail</Label>
                                            <Input
                                                id="email"
                                                type="email"
                                                value={profile.email}
                                                readOnly
                                                disabled
                                                className="bg-muted cursor-not-allowed"
                                            />
                                        </div>
                                        <div className="space-y-2 md:col-span-2">
                                            <Label htmlFor="company">Empresa</Label>
                                            <Input
                                                id="company"
                                                value={profile.company}
                                                readOnly
                                                disabled
                                                className="bg-muted cursor-not-allowed"
                                            />
                                            <p className="text-xs text-muted-foreground">Estes campos são gerenciados pelo administrador da sua empresa.</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Marca Pessoal */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Marca Pessoal</CardTitle>
                                    <CardDescription>
                                        Configure sua identidade de marca para geração de conteúdo.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="voice">Tom de voz</Label>
                                        <Select
                                            value={branding.voice}
                                            onValueChange={(value) =>
                                                setBranding({ ...branding, voice: value })
                                            }
                                        >
                                            <SelectTrigger id="voice">
                                                <SelectValue placeholder="Selecione o tom de voz" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="amigavel">Amigável</SelectItem>
                                                <SelectItem value="profissional">Profissional</SelectItem>
                                                <SelectItem value="inspirador">Inspirador</SelectItem>
                                                <SelectItem value="educativo">Educativo</SelectItem>
                                                <SelectItem value="provocativo">Provocativo</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="expertise">Áreas de expertise</Label>
                                        <Textarea
                                            id="expertise"
                                            placeholder="Ex: Marketing Digital, Vendas, Liderança..."
                                            value={branding.expertise}
                                            onChange={(e) =>
                                                setBranding({ ...branding, expertise: e.target.value })
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="value">Proposta de valor</Label>
                                        <Textarea
                                            id="value"
                                            placeholder="O que você oferece de único para sua audiência?"
                                            value={branding.value}
                                            onChange={(e) =>
                                                setBranding({ ...branding, value: e.target.value })
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="position">Cargo / Posição</Label>
                                        <Input
                                            id="position"
                                            placeholder="Ex: CEO, Diretor de Marketing, Consultor..."
                                            value={branding.position}
                                            onChange={(e) =>
                                                setBranding({ ...branding, position: e.target.value })
                                            }
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Notificações */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Notificações</CardTitle>
                                    <CardDescription>
                                        Configure como e quando deseja receber notificações.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label>Notificações por e-mail</Label>
                                            <p className="text-sm text-muted-foreground">
                                                Receba atualizações sobre novos conteúdos e análises.
                                            </p>
                                        </div>
                                        <Switch defaultChecked />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label>Lembretes de postagem</Label>
                                            <p className="text-sm text-muted-foreground">
                                                Seja lembrado quando houver conteúdo pronto para publicar.
                                            </p>
                                        </div>
                                        <Switch defaultChecked />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label>Relatórios semanais</Label>
                                            <p className="text-sm text-muted-foreground">
                                                Receba um resumo semanal do desempenho dos seus posts.
                                            </p>
                                        </div>
                                        <Switch />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Botão Salvar */}
                            <div className="flex justify-end">
                                <Button onClick={handleSave} disabled={isSaving}>
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Salvando...
                                        </>
                                    ) : (
                                        "Salvar configurações"
                                    )}
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}
