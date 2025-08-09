// src/app/master/empresas/page.tsx
'use client';

import { useState, useEffect } from 'react';
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

type Company = {
    id: string;
    name: string;
    status: 'Ativa' | 'Inativa';
    licensesUsed: number;
    licensesTotal: number;
    adminEmail: string;
    startDate: string;
};


export default function MasterEmpresasPage() {
    const { toast } = useToast();
    const [companies, setCompanies] = useState<Company[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchCompanies = async () => {
            setIsLoading(true);
            try {
                // MOCK DATA - In a real app, fetch from Firestore
                const mockCompanies: Company[] = [
                    { id: "1", name: "TechCorp", status: "Ativa", licensesUsed: 100, licensesTotal: 100, adminEmail: "admin.techcorp@example.com", startDate: "2023-01-15" },
                    { id: "2", name: "Innovate Inc.", status: "Ativa", licensesUsed: 45, licensesTotal: 50, adminEmail: "admin.innovate@example.com", startDate: "2023-03-01" },
                    { id: "3", name: "Future Solutions", status: "Inativa", licensesUsed: 0, licensesTotal: 25, adminEmail: "admin.future@example.com", startDate: "2023-05-20" },
                ];
                await new Promise(resolve => setTimeout(resolve, 1000));
                setCompanies(mockCompanies);
            } catch (error) {
                console.error("Error fetching companies:", error);
                toast({ variant: 'destructive', title: 'Erro ao buscar empresas' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchCompanies();
    }, [toast]);

    const handleAddCompany = async () => {
        setIsSubmitting(true);
        // TODO: Implement create company logic (call a server action or Firebase function)
        console.log("Creating new company...");
        await new Promise(resolve => setTimeout(resolve, 1500));
        toast({ title: 'Empresa adicionada com sucesso!' });
        setIsSubmitting(false);
        // Here you would refetch the companies list
    };

    const addCompanyButton = (
        <Button size="sm">
            <PlusCircle className="mr-2 h-4 w-4" />
            Adicionar Empresa
        </Button>
    );

    const companyForm = (
        <>
            <div className="space-y-2">
                <Label htmlFor="company-name">Nome da Empresa</Label>
                <Input id="company-name" placeholder="Ex: TechCorp" disabled={isSubmitting} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="admin-email">E-mail do Admin</Label>
                <Input id="admin-email" type="email" placeholder="admin@techcorp.com" disabled={isSubmitting} />
            </div>
             <div className="space-y-2">
                <Label htmlFor="licenses">Número de Licenças</Label>
                <Input id="licenses" type="number" placeholder="Ex: 100" disabled={isSubmitting} />
            </div>
        </>
    );

  return (
    <>
      <Header title="Empresas" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="font-headline">Gerenciamento de Empresas</CardTitle>
                    <CardDescription>Adicione, edite ou remova empresas clientes.</CardDescription>
                </div>
                <ActionDialog
                    title="Adicionar Nova Empresa"
                    description="Cadastre uma nova empresa cliente na plataforma."
                    trigger={addCompanyButton}
                    actionText={isSubmitting ? "Salvando..." : "Salvar Empresa"}
                    onAction={handleAddCompany}
                >
                    {companyForm}
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
                                <TableRow key={company.id}>
                                    <TableCell className="font-medium">{company.name}</TableCell>
                                    <TableCell><Badge variant={company.status === 'Ativa' ? 'default' : 'destructive'}>{company.status}</Badge></TableCell>
                                    <TableCell>{company.licensesUsed} / {company.licensesTotal}</TableCell>
                                    <TableCell>{company.adminEmail}</TableCell>
                                    <TableCell>{company.startDate}</TableCell>
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
                                                <DropdownMenuItem asChild>
                                                    <Link href="/admin/dashboard"><LogIn className="mr-2 h-4 w-4" />Visualizar Ambiente</Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem>Editar</DropdownMenuItem>
                                                <DropdownMenuItem>{company.status === 'Ativa' ? 'Desativar' : 'Ativar'}</DropdownMenuItem>
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
