// src/app/strategist/configuracoes/page.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { Header } from "@/components/dashboard/header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Camera } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from '@/contexts/auth-context';
import { SlackSettingsCard } from '@/components/dashboard/slack-settings';

type ProfileData = {
  name: string;
  email: string;
  photoURL: string;
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
      </div>
    </div>
  );
}

export default function StrategistConfiguracoesPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const currentUserId = user?.uid || null;
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<ProfileData>({ name: '', email: '', photoURL: '' });
  const [editName, setEditName] = useState('');

  const fetchData = useCallback(async (userId: string) => {
    try {
      setIsLoading(true);
      const userDocRef = doc(db, 'users', userId);
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        const data = snap.data();
        const p: ProfileData = {
          name: data.profile?.name || data.name || '',
          email: data.profile?.email || data.email || '',
          photoURL: data.profile?.avatarUrl || data.photoURL || '',
        };
        setProfile(p);
        setEditName(p.name);
      }
    } catch (error) {
      console.error('Error fetching strategist profile:', error);
      toast({ variant: 'destructive', title: 'Erro ao carregar perfil.' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (currentUserId) fetchData(currentUserId);
  }, [currentUserId, fetchData]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUserId) return;
    setIsUploadingPhoto(true);
    try {
      const fileRef = storageRef(storage, `users/${currentUserId}/profile-photo`);
      await uploadBytes(fileRef, file);
      const downloadURL = await getDownloadURL(fileRef);
      const userDocRef = doc(db, 'users', currentUserId);
      await setDoc(userDocRef, {
        photoURL: downloadURL,
        profile: { ...({ name: profile.name, email: profile.email }), avatarUrl: downloadURL },
      }, { merge: true });
      setProfile(prev => ({ ...prev, photoURL: downloadURL }));
      toast({ title: 'Foto atualizada!' });
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast({ variant: 'destructive', title: 'Erro ao atualizar foto.' });
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!currentUserId) return;
    setIsSaving(true);
    try {
      const userDocRef = doc(db, 'users', currentUserId);
      await setDoc(userDocRef, {
        name: editName,
        profile: { name: editName, email: profile.email, avatarUrl: profile.photoURL || null },
      }, { merge: true });
      setProfile(prev => ({ ...prev, name: editName }));
      toast({ title: 'Configurações salvas com sucesso!' });
    } catch (error) {
      console.error('Error saving strategist profile:', error);
      toast({ variant: 'destructive', title: 'Erro ao salvar configurações.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Header title="Configurações" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
            <p className="text-muted-foreground">Gerencie seus dados de perfil.</p>
          </div>

          {isLoading ? (
            <SettingsSkeleton />
          ) : (
            <>
              {/* Profile Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Perfil</CardTitle>
                  <CardDescription>Suas informações pessoais como estrategista.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Avatar + Upload */}
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={profile.photoURL || ''} />
                        <AvatarFallback className="bg-primary/10 text-primary text-lg">
                          {profile.name?.[0]?.toUpperCase() || 'S'}
                        </AvatarFallback>
                      </Avatar>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoUpload}
                      />
                    </div>
                    <div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingPhoto}
                      >
                        {isUploadingPhoto ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
                        ) : (
                          <><Camera className="h-4 w-4 mr-2" /> Alterar Foto</>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-1">JPG, PNG. Máx 2MB.</p>
                    </div>
                  </div>

                  {/* Name */}
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome completo</Label>
                    <Input
                      id="name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Seu nome completo"
                    />
                  </div>

                  {/* Email (read-only) */}
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      value={profile.email}
                      readOnly
                      disabled
                      className="bg-muted cursor-not-allowed"
                    />
                    <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado.</p>
                  </div>
                </CardContent>
              </Card>

              {/* Save */}
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
                  ) : (
                    'Salvar Alterações'
                  )}
                </Button>
              </div>

              {/* Slack Notifications Settings */}
              <SlackSettingsCard />
            </>
          )}
        </div>
      </main>
    </>
  );
}
