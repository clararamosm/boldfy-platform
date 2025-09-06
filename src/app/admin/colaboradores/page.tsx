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
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  
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
  
  useEffect(() => {
    // Hardcoded for test mode
    const testCompanyId = "zla41D6y8A1Gz0dUnrR7";
    setCompanyId(testCompanyId);
    fetchData(testCompanyId);
  }, [fetchData]);

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
    switch (status) {
        case 'Ativo':
            return <Badge variant="default">Ativo</Badge>;
        case 'Inativo':
            return <Badge variant="destructive">Inativo</Badge>;
        case 'Pendente':
            return <Badge variant="secondary">Pendente</Badge>;
        default:
            return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  const handleFormAction = (formData: FormData) => {
    if (companyId) {
        formData.append('companyId', companyId);
        formAction(formData);
    } else {
        toast({ variant: "destructive", title: "Erro", description: "ID da empresa não encontrado." });
    }
  }

  return (
    <>
      <Header title="Colaboradores" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
            <StatCard title="Colaboradores Ativos" value={`${collaborators.length}`} icon={UserCheck} isLoading={isLoading} />
            <StatCard title="Licenças Contratadas" value={`${totalLicenses}`} icon={Users} isLoading={isLoading} />
        </div>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-headline">Gerenciar Colaboradores</CardTitle>
              <CardDescription>Adicione, edite ou remova colaboradores da plataforma.</CardDescription>
            </div>
            <ActionDialog
              title="Convidar Colaborador"
              description="Envie um convite por e-mail para um novo colaborador se juntar à plataforma."
              trigger={inviteButton}
              actionText="Enviar Convite"
              onAction={() => formRef.current?.requestSubmit()}
              formId="invite-form"
              open={isDialogOpen}
              onOpenChange={setIsDialogOpen}
            >
              <form action={handleFormAction} id="invite-form" ref={formRef}>
                <InviteFormContent />
              </form>
            </ActionDialog>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Pontos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data de Entrada</TableHead>
                  <TableHead><span className="sr-only">Ações</span></TableHead>
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
