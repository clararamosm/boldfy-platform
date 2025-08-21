// src/app/master/empresas/page.tsx
'use client';

import React, { useState, useEffect, useRef, useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, orderBy, query } from 'firebase/firestore';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, PlusCircle, LogIn, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ActionDialog } from "@/components/dashboard/action-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { inviteAdmin } from '@/app/actions';

type Company = {
    id: string;
    companyName: string;
    status: 'Ativa' | 'Inativa' | 'Trial';
    licenses: number;
    adminProfile: { email: string; name: string; };
    createdAt: any;
};

function CompanyFormContent() {
    const { pending } = useFormStatus();
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="companyName">Nome da Empresa</Label>
                <Input name="companyName" id="companyName" placeholder="Ex: TechCorp" disabled={pending} required />
            </div>
            <div className="space-y-2">
                <Label htmlFor="adminName">Nome do Admin</Label>
                <Input name="adminName" id="adminName" placeholder="Ex: João Silva" disabled={pending} required />
            </div>
            <div className="space-y-2">
                <Label htmlFor="adminEmail">E-mail do Admin</Label>
                <Input name="adminEmail" id="adminEmail" type="email" placeholder="admin@techcorp.com" disabled={pending} required />
            </div>
             <div className="space-y-2">
                <Label htmlFor="licenses">Número de Licenças (mín. 5)</Label>
                <Input name="licenses" id="licenses" type="number" placeholder="Ex: 50" min="5" defaultValue="5" disabled={pending} required />
             </div>
             <p className="text-xs text-muted-foreground">O free trial de 30 dias permite até 5 licenças. Após o período, a cobrança será baseada no número de licenças definido aqui.</p>
        </div>
    );
}

export default function MasterEmpresasPage() {
    const { toast } = useToast();
    const [companies, setCompanies] = useState<Company[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);

    const [inviteState, formAction] = useActionState(inviteAdmin, { error: undefined, success: undefined });

    const fetchCompanies = async () => {
        setIsLoading(true);
        try {
            const companiesQuery = collection(db, "companies");
            const querySnapshot = await getDocs(query(companiesQuery, orderBy("createdAt", "desc")));
            const companiesList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Company));
            setCompanies(companiesList);
        } catch (error) {
            console.error("Error fetching companies:", error);
            toast({ variant: 'destructive', title: 'Erro ao buscar empresas' });
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        if(inviteState.success) {
            toast({
                title: 'Empresa e Admin Criados!',
                description: 'A empresa foi criada em modo Trial. O admin pode agora fazer login e iniciar a assinatura.',
            });
            setIsDialogOpen(false);
            fetchCompanies();
        }
         if (inviteState.error) {
            toast({
                variant: 'destructive',
                title: 'Erro ao Criar Empresa',
                description: inviteState.error,
            });
        }
    }, [inviteState, toast]);

    useEffect(() => {
        fetchCompanies();
    }, []);
    
     const handleToggleStatus = async (company: Company) => {
        const newStatus = company.status === 'Ativa' ? 'Inativa' : 'Ativa';
        try {
            const companyDoc = doc(db, "companies", company.id);
            await updateDoc(companyDoc, { status: newStatus });
            toast({ title: `Status da empresa alterado para ${newStatus}` });
            fetchCompanies();
        } catch (error) {
            console.error("Error toggling company status:", error);
            toast({ variant: 'destructive', title: 'Erro ao alterar status da empresa.' });
        }
    };

    const addCompanyButton = (
        <Button size="sm">
            <PlusCircle className="mr-2 h-4 w-4" />
            Adicionar Empresa
        </Button>
    );

    const getStatusBadge = (status: Company['status']) => {
        switch (status) {
            case 'Ativa':
                return <Badge variant="default">Ativa</Badge>;
            case 'Inativa':
                return <Badge variant="destructive">Inativa</Badge>;
            case 'Trial':
                return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Trial</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

  return (
    <>
      <Header title="Empresas" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="font-headline">Gerenciamento de Empresas</CardTitle>
                    <CardDescription>Crie um novo ambiente de empresa e convide um administrador.</CardDescription>
                </div>
                 <ActionDialog
                    title="Adicionar Nova Empresa"
                    description="Preencha os dados para criar uma nova empresa. Ela começará com um free trial de 30 dias."
                    trigger={addCompanyButton}
                    actionText="Criar e Convidar Admin"
                    onAction={() => formRef.current?.requestSubmit()}
                    formId="company-form"
                    open={isDialogOpen}
                    onOpenChange={setIsDialogOpen}
                >
                    <form ref={formRef} action={formAction} id="company-form">
                        <CompanyFormContent />
                    </form>
                </ActionDialog>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Empresa</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Licenças</TableHead>
                            <TableHead>Admin</TableHead>
                            <TableHead>Data de Início</TableHead>
                            <TableHead><span className="sr-only">Ações</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center h-24">
                                     <div className="flex justify-center items-center">
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando empresas...
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : companies.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center h-24">Nenhuma empresa encontrada.</TableCell>
                            </TableRow>
                        ) : (
                            companies.map(company => (
                                <TableRow key={company.id} className={(company.status !== 'Ativa' && company.status !== 'Trial') ? 'text-muted-foreground' : ''}>
                                    <TableCell className="font-medium">{company.companyName}</TableCell>
                                    <TableCell>{getStatusBadge(company.status)}</TableCell>
                                    <TableCell>0 / {company.licenses}</TableCell>
                                    <TableCell>{company.adminProfile?.email}</TableCell>
                                    <TableCell>{company.createdAt?.toDate ? format(company.createdAt.toDate(), 'dd/MM/yyyy') : 'N/A'}</TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button aria-haspopup="true" size="icon" variant="ghost">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                    <span className="sr-only">Toggle menu</span>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                                <DropdownMenuItem asChild disabled={company.status === 'Inativa'}>
                                                    <Link href={`/admin/dashboard?companyId=${company.id}`}><LogIn className="mr-2 h-4 w-4" />Visualizar Ambiente</Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleToggleStatus(company)}>
                                                    {company.status === 'Ativa' ? 'Desativar' : 'Ativar'}
                                                </DropdownMenuItem>
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
