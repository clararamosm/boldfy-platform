// src/app/admin/colaboradores/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, getDocs, doc, getDoc, query } from 'firebase/firestore';
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

type Collaborator = {
  id: string;
  name: string;
  email: string;
  points: number;
  status: 'Ativo' | 'Inativo';
  entryDate: any;
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


export default function AdminColaboradoresPage() {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [totalLicenses, setTotalLicenses] = useState(0); 
  const { toast } = useToast();
  
  const fetchData = useCallback(async (currentCompanyId: string) => {
      setIsLoading(true);
      try {
        const companyDocRef = doc(db, "companies", currentCompanyId);
        const companyDocSnap = await getDoc(companyDocRef);
        if(companyDocSnap.exists()) {
            setTotalLicenses(companyDocSnap.data().licenses || 0);
        }

        const collaboratorsQuery = query(collection(db, "companies", currentCompanyId, "collaborators"));
        const querySnapshot = await getDocs(collaboratorsQuery);
        const fetchedCollaborators = querySnapshot.docs.map(doc => ({ 
            id: doc.id,
            ...doc.data(),
            entryDate: doc.data().entryDate?.toDate() // Convert timestamp
         }) as Collaborator);
        setCollaborators(fetchedCollaborators);
        
      } catch (error) {
        console.error("Error fetching collaborators: ", error);
        toast({ variant: "destructive", title: "Erro ao buscar colaboradores."});
      } finally {
        setIsLoading(false);
      }
  }, [toast]);
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
        if (user) {
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const userCompanyId = userDocSnap.data().companyId;
                setCompanyId(userCompanyId);
                fetchData(userCompanyId);
            } else {
                 toast({ variant: "destructive", title: "Usuário não encontrado no banco de dados."});
                 setIsLoading(false);
            }
        } else {
            setIsLoading(false);
        }
    });
    return () => unsubscribe();
  }, [fetchData, toast]);


  const handleInvite = async () => {
      if (!companyId) return;
      setIsSubmitting(true);
      // TODO: Implement invite logic (e.g., call a server action or Firebase function)
      // This would typically involve sending an email and creating a pending user.
      console.log("Sending invite...");
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate async operation
      toast({ title: "Convite enviado com sucesso!"});
      setIsSubmitting(false);
      fetchData(companyId);
  }

  const inviteButton = (
    <Button size="sm" disabled={isSubmitting || !companyId}>
      <PlusCircle className="mr-2 h-4 w-4" />
      Convidar Colaborador
    </Button>
  );

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
              actionText={isSubmitting ? "Enviando..." : "Enviar Convite"}
              onAction={handleInvite}
            >
              <div className="space-y-2">
                <Label htmlFor="email">E-mail do Colaborador</Label>
                <Input id="email" type="email" placeholder="nome@empresa.com.br" disabled={isSubmitting} />
              </div>
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
                      <TableCell><Badge variant={user.status === 'Ativo' ? 'default' : 'destructive'}>{user.status}</Badge></TableCell>
                      <TableCell>{user.entryDate?.toLocaleDateString() || 'N/A'}</TableCell>
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
