// src/app/master/empresas/page.tsx
'use client';

import { useState, useEffect, useRef, useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
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
import { createCheckoutSession } from '@/app/actions';
import { getStripe } from '@/lib/stripe-client';

type Company = {
    id: string;
    companyName: string;
    status: 'Ativa' | 'Inativa' | 'pending_payment';
    licenses: number;
    adminProfile: { email: string; name: string; };
    createdAt: any;
};

// Sub-component to use useFormStatus
function CompanyFormContent({ isSubmitting }: { isSubmitting: boolean }) {
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="company-name">Nome da Empresa</Label>
                <Input name="companyName" id="company-name" placeholder="Ex: TechCorp" disabled={isSubmitting} required />
            </div>
            <div className="space-y-2">
                <Label htmlFor="admin-name">Nome do Admin</Label>
                <Input name="adminName" id="admin-name" placeholder="Ex: João Silva" disabled={isSubmitting} required />
            </div>
            <div className="space-y-2">
                <Label htmlFor="admin-email">E-mail do Admin</Label>
                <Input name="adminEmail" id="admin-email" type="email" placeholder="admin@techcorp.com" disabled={isSubmitting} required />
            </div>
             <div className="space-y-2">
                <Label htmlFor="licenses">Número de Licenças (Assentos)</Label>
                <Input name="licenses" id="licenses" type="number" placeholder="Ex: 50" min="1" disabled={isSubmitting} required />
            </div>
        </div>
    );
}

const CompanyForm = ({ formRef, formAction }: { formRef: React.RefObject<HTMLFormElement>, formAction: (payload: FormData) => void }) => {
    const { pending } = useFormStatus();
    return (
        <form ref={formRef} action={formAction} id="company-form">
            <CompanyFormContent isSubmitting={pending} />
        </form>
    );
};


export default function MasterEmpresasPage() {
    const { toast } = useToast();
    const [companies, setCompanies] = useState<Company[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const formRef = useRef<HTMLFormElement>(null);

    const [checkoutState, formAction] = useActionState(createCheckoutSession, { error: undefined, sessionId: undefined });

    useEffect(() => {
        if (checkoutState.sessionId) {
            const redirectToCheckout = async () => {
                const stripe = await getStripe();
                if (!stripe) {
                    console.error("Stripe.js not loaded");
                    return;
                }
                await stripe.redirectToCheckout({ sessionId: checkoutState.sessionId! });
            }
            redirectToCheckout();
        }
        if (checkoutState.error) {
            toast({
                variant: 'destructive',
                title: 'Erro no Checkout',
                description: checkoutState.error,
            });
        }
    }, [checkoutState, toast]);


    const fetchCompanies = async () => {
        setIsLoading(true);
        try {
            const companiesQuery = collection(db, "companies");
            const querySnapshot = await getDocs(companiesQuery);
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
            case 'pending_payment':
                return <Badge variant="secondary">Pagamento Pendente</Badge>;
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
                    <CardDescription>Adicione novas empresas clientes. O admin será redirecionado para o pagamento.</CardDescription>
                </div>
                <ActionDialog
                    title="Adicionar Nova Empresa"
                    description="Preencha os dados da nova empresa. Você será redirecionado para o Stripe para efetuar o pagamento da assinatura."
                    trigger={addCompanyButton}
                    actionText="Ir para Pagamento"
                    formId="company-form"
                    // The onAction is now handled by the form itself
                >
                    <CompanyForm formRef={formRef} formAction={formAction} />
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
                                <TableRow key={company.id} className={company.status !== 'Ativa' ? 'text-muted-foreground' : ''}>
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
                                                <DropdownMenuItem asChild disabled={company.status !== 'Ativa'}>
                                                    <Link href={`/admin/dashboard?companyId=${company.id}`}><LogIn className="mr-2 h-4 w-4" />Visualizar Ambiente</Link>
                                                </DropdownMenuItem>
                                                {/* <DropdownMenuItem>Editar</DropdownMenuItem> */}
                                                <DropdownMenuItem onClick={() => handleToggleStatus(company)} disabled={company.status === 'pending_payment'}>
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
