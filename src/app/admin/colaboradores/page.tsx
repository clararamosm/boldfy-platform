// src/app/admin/colaboradores/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle, Loader2, Users, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ActionDialog } from "@/components/dashboard/action-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from '@/hooks/use-toast';
import { inviteCollaborator } from '@/app/actions';
import { useRouter } from 'next/navigation';

type Collaborator = {
  id: string;
  name: string;
  email: string;
  points: number;
  status: 'Ativo' | 'Inativo' | 'Pendente';
  createdAt: any;
  avatarUrl?: string;
};

const StatCard = ({ title, value, icon: Icon, isLoading }: { title: string, value: string, icon: React.ElementType, isLoading: boolean }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      {isLoading ? (
        <div className="h-8 w-16 bg-muted rounded animate-pulse mt-1" />
      ) : (
        <div className="text-2xl font-bold">{value}</div>
      )}
    </CardContent>
  </Card>
);

function InviteFormContent() {
  const { pending } = useFormStatus();
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome do Colaborador</Label>
        <Input name="name" id="name" placeholder="Ex: Maria Souza" required disabled={pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">E-mail do Colaborador</Label>
        <Input name="email" id="email" type="email" placeholder="nome@empresa.com.br" required disabled={pending} />
      </div>
    </div>
  );
}

export default function AdminColaboradoresPage() {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [totalLicenses, setTotalLicenses] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();
  const router = useRouter();

  const [inviteState, formAction] = useActionState(inviteCollaborator, { error: undefined, success: undefined });

  const fetchData = useCallback(async (currentCompanyId: string) => {
    setIsLoading(true);
    try {
      const companyDocRef = doc(db, "companies", currentCompanyId);
      const companyDocSnap = await getDoc(companyDocRef);
      if(companyDocSnap.exists()) {
        setTotalLicenses(companyDocSnap.data().licenses || 0);
      }

      const collaboratorsQuery = query(collection(db, "users"), where("companyId", "==", currentCompanyId), where("role", "==", "influencer"));
      const querySnapshot = await getDocs(collaboratorsQuery);
      const fetchedCollaborators = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.profile?.name || '',
          email: data.profile?.email || '',
          points: data.points || 0,
          status: data.status || 'Pendente',
          createdAt: data.createdAt?.toDate(),
          avatarUrl: data.profile?.avatarUrl
        }
      }) as Collaborator[];
      setCollaborators(fetchedCollaborators);

    } catch (error) {
      console.error("Error fetching collaborators: ", error);
      toast({ variant: "destructive", title: "Erro ao buscar colaboradores."});
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Real auth: get companyId from logged-in user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push('/login');
        return;
      }
      try {
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          const userCompanyId = userData.companyId;
          if (userCompanyId) {
            setCompanyId(userCompanyId);
            fetchData(userCompanyId);
          } else {
            toast({ variant: "destructive", title: "Empresa não encontrada no perfil do usuário." });
            setIsLoading(false);
          }
        } else {
          toast({ variant: "destructive", title: "Dados do usuário não encontrados." });
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        toast({ variant: "destructive", title: "Erro ao carregar dados do usuário." });
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [fetchData, router, toast]);

  useEffect(() => {
    if (inviteState.success) {
      toast({ title: "Convite enviado!", description: "O colaborador receberá um e-mail para definir sua senha." });
      setIsDialogOpen(false);
      if (companyId) fetchData(companyId);
    }
    if (inviteState.error) {
      toast({ variant: "destructive", title: "Erro ao convidar", description: inviteState.error });
    }
  }, [inviteState, toast, companyId, fetchData]);

  const inviteButton = (
    <Button size="sm" disabled={isLoading || !companyId || collaborators.length >= totalLicenses}>
      <PlusCircle className="mr-2 h-4 w-4" />
      Convidar Colaborador
    </Button>
  );

  const getStatusBadge = (status: Collaborator['status']) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      'Ativo': 'default',
      'Pendente': 'secondary',
      'Inativo': 'outline',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  return (
    <>
      <Header title="Colaboradores" action={
        <ActionDialog
          trigger={inviteButton}
          title="Convidar Novo Colaborador"
          description="Envie um convite para um novo membro da equipe. Ele receberá um e-mail para criar sua senha."
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
        >
          <form action={formAction} ref={formRef}>
            <input type="hidden" name="companyId" value={companyId || ''} />
            <InviteFormContent />
            <div className="flex justify-end mt-6">
              <Button type="submit">Enviar Convite</Button>
            </div>
          </form>
        </ActionDialog>
      } />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
          <StatCard title="Total de Colaboradores" value={String(collaborators.length)} icon={Users} isLoading={isLoading} />
          <StatCard title="Colaboradores Ativos" value={String(collaborators.filter(c => c.status === 'Ativo').length)} icon={UserCheck} isLoading={isLoading} />
          <StatCard title="Licenças Disponíveis" value={`${collaborators.length} / ${totalLicenses}`} icon={Users} isLoading={isLoading} />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Equipe</CardTitle>
            <CardDescription>Gerencie os colaboradores da sua empresa.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Pontos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data de Adesão</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      <div className="flex justify-center items-center p-4">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <span className="ml-2">Carregando colaboradores...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : collaborators.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      Nenhum colaborador encontrado. Convide o primeiro!
                    </TableCell>
                  </TableRow>
                ) : (
                  collaborators.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={user.avatarUrl} data-ai-hint="person avatar" />
                            <AvatarFallback>{user.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{user.points}</TableCell>
                      <TableCell>{getStatusBadge(user.status)}</TableCell>
                      <TableCell>{user.createdAt?.toLocaleDateString() || 'N/A'}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Ver Perfil</DropdownMenuItem>
                            <DropdownMenuItem>Editar</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive">Desativar</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
