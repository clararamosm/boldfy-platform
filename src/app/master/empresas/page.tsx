// src/app/master/empresas/page.tsx
'use client';

import React, { useState, useEffect, useRef, useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, getDocs, getDoc, deleteDoc, doc, updateDoc, orderBy, query, where, writeBatch } from 'firebase/firestore';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MoreHorizontal, PlusCircle, LogIn, Loader2, Pencil, Trash2, Globe, Mail } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ActionDialog } from "@/components/dashboard/action-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { getAuthToken } from '@/lib/auth-client';
import { inviteAdmin, inviteAdminToCompany } from '@/app/actions';
import { deleteCompany } from '@/app/deleteCompanyAction';

type Company = {
    id: string;
    companyName: string;
    status: 'Ativa' | 'Inativa' | 'Trial';
    licenses: number;
    tlLicenses?: number;
    locale?: 'pt-BR' | 'en';
    adminProfile: { email: string; name: string; };
    strategistIds: string[];
    createdAt: { toDate?: () => Date } | string | null;
    subscription?: {
        plan?: string;
        status?: string;
        trialEnd?: { toDate?: () => Date } | string | null;
    };
    /** True when the admin has never logged in (no password set yet) */
    adminPending?: boolean;
    logoUrl?: string;
};

function CompanyFormContent() {
    const { pending } = useFormStatus();
    const [locale, setLocale] = useState('pt-BR');
    const [skipInvite, setSkipInvite] = useState(false);
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="companyName">Nome da Empresa</Label>
                <Input name="companyName" id="companyName" placeholder="Ex: TechCorp" disabled={pending} required />
            </div>
             <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  name="skipInvite"
                  value="true"
                  id="skipInvite"
                  className="h-4 w-4 rounded border-gray-300"
                  checked={skipInvite}
                  onChange={(e) => setSkipInvite(e.target.checked)}
                />
                <Label htmlFor="skipInvite" className="text-sm font-normal text-muted-foreground">Criar sem convidar admin (popular conta antes)</Label>
             </div>
            {!skipInvite && (
              <>
                <div className="space-y-2">
                    <Label htmlFor="adminName">Nome do Admin</Label>
                    <Input name="adminName" id="adminName" placeholder="Ex: João Silva" disabled={pending} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="adminEmail">E-mail do Admin</Label>
                    <Input name="adminEmail" id="adminEmail" type="email" placeholder="admin@techcorp.com" disabled={pending} required />
                </div>
              </>
            )}
             <div className="space-y-2">
                <Label htmlFor="licenses">Número de Licenças (mín. 5)</Label>
                <Input name="licenses" id="licenses" type="number" placeholder="Ex: 50" min="5" defaultValue="5" disabled={pending} required />
             </div>
             <div className="space-y-2">
                <Label htmlFor="tlLicenses">Licenças Thought Leader (opcional)</Label>
                <Input name="tlLicenses" id="tlLicenses" type="number" placeholder="Ex: 2" min="0" defaultValue="0" disabled={pending} />
                <p className="text-xs text-muted-foreground">Número de assentos para Thought Leaders (Content Full-Service). Cobrados separadamente.</p>
             </div>
             <div className="space-y-2">
                <Label htmlFor="locale">Idioma da Plataforma</Label>
                <input type="hidden" name="locale" value={locale} />
                <Select defaultValue="pt-BR" disabled={pending} onValueChange={setLocale}>
                    <SelectTrigger id="locale">
                        <SelectValue placeholder="Selecione o idioma" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="pt-BR">🇧🇷 Português (BR)</SelectItem>
                        <SelectItem value="en">🇺🇸 English</SelectItem>
                    </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Define o idioma de toda a interface para esta empresa.</p>
             </div>
             <p className="text-xs text-muted-foreground">Licenças contam apenas colaboradores (a conta de admin é gratuita). Mínimo de 5 licenças.</p>
        </div>
    );
}

type StrategistInfo = {
    name: string;
    avatarUrl?: string;
};

export default function MasterEmpresasPage() {
    const { toast } = useToast();
    const [companies, setCompanies] = useState<Company[]>([]);
    const [colabCounts, setColabCounts] = useState<Record<string, number>>({});
    const [tlCounts, setTlCounts] = useState<Record<string, number>>({});
    const [strategistMap, setStrategistMap] = useState<Record<string, StrategistInfo>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingCompany, setEditingCompany] = useState<Company | null>(null);
    const [editCompanyName, setEditCompanyName] = useState("");
    const [editLicenses, setEditLicenses] = useState(0);
    const [editTLLicenses, setEditTLLicenses] = useState(0);
    const [isEditCompanyOpen, setIsEditCompanyOpen] = useState(false);
    const [editLogoUrl, setEditLogoUrl] = useState<string | undefined>(undefined);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [confirmDeleteName, setConfirmDeleteName] = useState("");
    const [inviteAdminCompany, setInviteAdminCompany] = useState<Company | null>(null);
    const [inviteAdminName, setInviteAdminName] = useState('');
    const [inviteAdminEmail, setInviteAdminEmail] = useState('');
    const [isInvitingAdmin, setIsInvitingAdmin] = useState(false);
    const [cachedToken, setCachedToken] = useState('');
    const formRef = useRef<HTMLFormElement>(null);

    const [inviteState, formAction] = useActionState(inviteAdmin, { error: undefined, success: undefined });

    useEffect(() => {
        getAuthToken().then(setCachedToken).catch(() => {});
    }, []);

    const fetchCompanies = async () => {
        setIsLoading(true);
        try {
            const companiesQuery = collection(db, "companies");
            const querySnapshot = await getDocs(query(companiesQuery, orderBy("createdAt", "desc")));
            const companiesList = querySnapshot.docs.map(d => {
                const data = d.data();
                // Backward compat: read strategistIds (new) or fall back to strategistId (old singular)
                const strategistIds: string[] = data.strategistIds || (data.strategistId ? [data.strategistId] : []);
                return { id: d.id, ...data, strategistIds } as Company;
            });

            // Fetch seat counts (colab vs TL) + detect admin pending
            const colabMap: Record<string, number> = {};
            const tlMap: Record<string, number> = {};
            for (const comp of companiesList) {
                // Count colaboradores
                const colabQuery = query(
                    collection(db, "users"),
                    where("companyId", "==", comp.id),
                    where("role", "==", "colaborador")
                );
                const colabSnap = await getDocs(colabQuery);
                colabMap[comp.id] = colabSnap.size;

                // Count thought leaders
                const tlQuery = query(
                    collection(db, "users"),
                    where("companyId", "==", comp.id),
                    where("role", "==", "thoughtleader")
                );
                const tlSnap = await getDocs(tlQuery);
                tlMap[comp.id] = tlSnap.size;

                // Check if admin user exists for this company
                const adminQuery = query(
                    collection(db, "users"),
                    where("companyId", "==", comp.id),
                    where("role", "==", "admin")
                );
                const adminSnap = await getDocs(adminQuery);
                if (adminSnap.empty) {
                    comp.adminPending = true;
                }
            }
            // Fetch strategist info for all unique strategists across companies
            const stratMap: Record<string, StrategistInfo> = {};
            const allStratIds = new Set(companiesList.flatMap(c => c.strategistIds));
            for (const stratId of allStratIds) {
                try {
                    const stratDoc = await getDoc(doc(db, 'users', stratId));
                    if (stratDoc.exists()) {
                        const sd = stratDoc.data();
                        stratMap[stratId] = {
                            name: sd.profile?.name || sd.name || '',
                            avatarUrl: sd.profile?.avatarUrl || sd.photoURL || '',
                        };
                    }
                } catch { /* skip */ }
            }

            setCompanies(companiesList);
            setColabCounts(colabMap);
            setTlCounts(tlMap);
            setStrategistMap(stratMap);
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

    const getStatusBadge = (company: Company) => {
        const plan = company.subscription?.plan;
        const trialEnd = company.subscription?.trialEnd;

        // Admin never logged in
        if (company.adminPending) {
            return <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-200">Pendente</Badge>;
        }

        // Show trial with days remaining
        if (plan === 'trial') {
            let daysLeft = 0;
            if (trialEnd) {
                const end = typeof trialEnd === 'object' && trialEnd !== null && 'toDate' in trialEnd && typeof trialEnd.toDate === 'function'
                    ? trialEnd.toDate()
                    : new Date(trialEnd as string);
                daysLeft = Math.max(0, Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
            }
            return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Trial ({daysLeft}d)</Badge>;
        }

        // Paid / Beta
        if (plan === 'paid' || plan === 'beta') {
            return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">Pagante</Badge>;
        }

        // Canceled
        if (plan === 'canceled') {
            return <Badge variant="destructive">Cancelado</Badge>;
        }

        // Fallback to legacy status field
        switch (company.status) {
            case 'Ativa':
                return <Badge variant="default">Ativa</Badge>;
            case 'Inativa':
                return <Badge variant="destructive">Inativa</Badge>;
            default:
                return <Badge variant="outline">{company.status}</Badge>;
        }
    };

  const handleEditCompanyOpen = (company: Company) => {
    setEditingCompany(company);
    setEditCompanyName(company.companyName);
    setEditLicenses(company.licenses);
    setEditTLLicenses(company.tlLicenses || 0);
    setEditLogoUrl(company.logoUrl);
    setInviteAdminName('');
    setInviteAdminEmail('');
    setIsEditCompanyOpen(true);
  };

  const handleLogoUpload = async (file: File) => {
    if (!editingCompany || !file) return;
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({ variant: 'destructive', title: 'Use PNG, JPG ou WEBP.' });
      return;
    }
    setIsUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const storageRef = ref(storage, `companies/${editingCompany.id}/logo.${ext}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setEditLogoUrl(url);
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao fazer upload do logo.' });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSaveCompanyEdit = async () => {
    if (!editingCompany) return;
    try {
      await updateDoc(doc(db, "companies", editingCompany.id), {
        companyName: editCompanyName,
        licenses: editLicenses,
        tlLicenses: editTLLicenses,
        ...(editLogoUrl !== undefined && { logoUrl: editLogoUrl }),
      });
      toast({ title: "Empresa atualizada com sucesso!" });
      setIsEditCompanyOpen(false);
      setEditingCompany(null);
      fetchCompanies();
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao atualizar empresa." });
    }
  };

  const handleInviteAdminToCompany = async () => {
    const targetCompany = inviteAdminCompany || editingCompany;
    if (!targetCompany) return;
    setIsInvitingAdmin(true);
    try {
      const token = await getAuthToken();
      const result = await inviteAdminToCompany(token, targetCompany.id, inviteAdminName, inviteAdminEmail);
      if (result.error) {
        toast({ variant: 'destructive', title: 'Erro', description: result.error });
      } else {
        toast({ title: 'Admin convidado com sucesso!', description: 'O admin receberá um e-mail para criar sua senha.' });
        setInviteAdminCompany(null);
        setInviteAdminName('');
        setInviteAdminEmail('');
        setIsEditCompanyOpen(false);
        fetchCompanies();
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao convidar admin.' });
    } finally {
      setIsInvitingAdmin(false);
    }
  };

  const handleDeleteCompanyConfirm = (company: Company) => {
    setConfirmDeleteId(company.id);
    setConfirmDeleteName(company.companyName);
  };

  const handleDeleteCompany = async () => {
    if (!confirmDeleteId) return;
    try {
      const token = await getAuthToken();
      const result = await deleteCompany(token, confirmDeleteId);
      if (result.error) {
        throw new Error(result.error);
      }
      toast({ title: "Empresa e todos os dados excluidos com sucesso!" });
      setConfirmDeleteId(null);
      setConfirmDeleteName("");
      fetchCompanies();
    } catch (error) {
      console.error("Error deleting company:", error);
      toast({ variant: "destructive", title: "Erro ao excluir empresa e seus dados." });
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
                    description="Preencha os dados para criar uma nova empresa. Ela começará com um free trial."
                    trigger={addCompanyButton}
                    actionText="Criar e Convidar Admin"
                    onAction={() => formRef.current?.requestSubmit()}
                    formId="company-form"
                    open={isDialogOpen}
                    onOpenChange={setIsDialogOpen}
                >
                    <form ref={formRef} action={formAction} id="company-form">
                        <input type="hidden" name="idToken" value={cachedToken} />
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
                            <TableHead>Estrategista</TableHead>
                            <TableHead>Idioma</TableHead>
                            <TableHead>Data de Início</TableHead>
                            <TableHead><span className="sr-only">Ações</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center h-24">
                                     <div className="flex justify-center items-center">
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando empresas...
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : companies.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center h-24">Nenhuma empresa encontrada.</TableCell>
                            </TableRow>
                        ) : (
                            companies.map(company => (
                                <TableRow key={company.id} className={(company.status !== 'Ativa' && company.status !== 'Trial') ? 'text-muted-foreground' : ''}>
                                    <TableCell className="font-medium">{company.companyName}</TableCell>
                                    <TableCell>{getStatusBadge(company)}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5">
                                            <Badge variant="outline" className="text-xs gap-1 font-normal">
                                                C: {colabCounts[company.id] || 0}/{company.licenses}
                                            </Badge>
                                            {(company.tlLicenses ?? 0) > 0 && (
                                                <Badge variant="outline" className="text-xs gap-1 font-normal">
                                                    TL: {tlCounts[company.id] || 0}/{company.tlLicenses}
                                                </Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>{company.adminProfile?.email}</TableCell>
                                    <TableCell>
                                        {company.strategistIds.length > 0 ? (
                                            <div className="flex -space-x-1.5">
                                                {company.strategistIds.map(sId => {
                                                    const info = strategistMap[sId];
                                                    if (!info) return null;
                                                    return (
                                                        <Avatar key={sId} className="h-6 w-6 border-2 border-background" title={info.name}>
                                                            {info.avatarUrl && <AvatarImage src={info.avatarUrl} alt={info.name} />}
                                                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                                                {info.name?.[0]?.toUpperCase() || 'S'}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="gap-1 text-xs">
                                            <Globe className="h-3 w-3" />
                                            {company.locale === 'en' ? 'EN' : 'PT'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{company.createdAt && typeof company.createdAt === 'object' && company.createdAt !== null && 'toDate' in company.createdAt && typeof company.createdAt.toDate === 'function' ? format(company.createdAt.toDate(), 'dd/MM/yyyy') : company.createdAt ? format(new Date(company.createdAt as string), 'dd/MM/yyyy') : 'N/A'}</TableCell>
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
                                                <DropdownMenuItem onClick={() => handleEditCompanyOpen(company)}>
                                                  <Pencil className="mr-2 h-4 w-4" />
                                                  Editar Empresa
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteCompanyConfirm(company)}>
                                                  <Trash2 className="mr-2 h-4 w-4" />
                                                  Excluir Empresa
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
      {/* Edit Company Dialog */}
      <ActionDialog
        open={isEditCompanyOpen}
        onOpenChange={setIsEditCompanyOpen}
        title="Editar Empresa"
        description="Altere o nome e as licenças da empresa."
      >
        <div className="space-y-4 py-4">
          {/* Logo */}
          <div className="space-y-2">
            <Label>Logo da Empresa</Label>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border">
                {editLogoUrl ? (
                  <AvatarImage src={editLogoUrl} alt="Logo" />
                ) : null}
                <AvatarFallback className="bg-muted text-muted-foreground text-lg">
                  {editCompanyName?.substring(0, 2).toUpperCase() || 'EM'}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={isUploadingLogo}
                >
                  {isUploadingLogo ? (
                    <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Enviando...</>
                  ) : editLogoUrl ? 'Trocar Logo' : 'Upload Logo'}
                </Button>
                <p className="text-[11px] text-muted-foreground">PNG, JPG ou WEBP</p>
              </div>
              <input
                ref={logoInputRef}
                type="file"
                className="hidden"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload(file);
                  e.target.value = '';
                }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="editCompanyName">Nome da Empresa</Label>
            <Input
              id="editCompanyName"
              value={editCompanyName}
              onChange={(e) => setEditCompanyName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="editLicenses">Licenças (Colaboradores)</Label>
            <Input
              id="editLicenses"
              type="number"
              min={1}
              value={editLicenses}
              onChange={(e) => setEditLicenses(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="editTLLicenses">Licenças Thought Leader</Label>
            <Input
              id="editTLLicenses"
              type="number"
              min={0}
              value={editTLLicenses}
              onChange={(e) => setEditTLLicenses(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">Assentos para Content Full-Service.</p>
          </div>
          <Button onClick={handleSaveCompanyEdit} className="w-full">
            Salvar Alterações
          </Button>
          {/* Invite Admin section — only when company has no admin */}
          {editingCompany?.adminPending && (
            <div className="border-t pt-4 mt-4 space-y-3">
              <div>
                <p className="text-sm font-medium">Convidar Admin</p>
                <p className="text-xs text-muted-foreground">Esta empresa ainda não tem um administrador. Preencha os dados abaixo para enviar o convite.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invAdminName">Nome do Admin</Label>
                <Input id="invAdminName" placeholder="Ex: João Silva" value={inviteAdminName} onChange={(e) => setInviteAdminName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invAdminEmail">E-mail do Admin</Label>
                <Input id="invAdminEmail" type="email" placeholder="admin@empresa.com" value={inviteAdminEmail} onChange={(e) => setInviteAdminEmail(e.target.value)} />
              </div>
              <Button
                variant="secondary"
                onClick={() => { setInviteAdminCompany(editingCompany); handleInviteAdminToCompany(); }}
                disabled={isInvitingAdmin || !inviteAdminName || !inviteAdminEmail}
                className="w-full"
              >
                {isInvitingAdmin ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</> : <><Mail className="mr-2 h-4 w-4" /> Enviar Convite ao Admin</>}
              </Button>
            </div>
          )}
        </div>
      </ActionDialog>

      {/* Confirm Delete Dialog */}
      <ActionDialog
        open={!!confirmDeleteId}
        onOpenChange={(open) => { if (!open) { setConfirmDeleteId(null); setConfirmDeleteName(""); } }}
        title="Excluir Empresa"
        description={`Tem certeza que deseja excluir a empresa "${confirmDeleteName}"? TODOS os dados serão permanentemente removidos: recompensas, missões, trilhas, biblioteca e usuários vinculados. Esta ação não pode ser desfeita.`}
      >
        <div className="flex gap-2 justify-end pt-4">
          <Button variant="outline" onClick={() => { setConfirmDeleteId(null); setConfirmDeleteName(""); }}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleDeleteCompany}>
            Excluir
          </Button>
        </div>
      </ActionDialog>
      </main>
    </>
  );
}
