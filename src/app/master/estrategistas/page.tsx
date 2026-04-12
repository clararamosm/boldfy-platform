// src/app/master/estrategistas/page.tsx
'use client';

import React, { useState, useEffect, useRef, useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MoreHorizontal, PlusCircle, Loader2, Building2, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ActionDialog } from "@/components/dashboard/action-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from '@/hooks/use-toast';
import { getAuthToken } from '@/lib/auth-client';
import { inviteStrategist, deleteStrategist, assignCompaniesToStrategist } from '@/app/actions';

type Strategist = {
  id: string;
  name: string;
  email: string;
  status: string;
  avatarUrl?: string;
  assignedCompanies: string[];
};

type CompanyOption = {
  id: string;
  companyName: string;
};

function InviteFormContent() {
  const { pending } = useFormStatus();
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome</Label>
        <Input name="name" id="name" placeholder="Ex: Ana Costa" disabled={pending} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input name="email" id="email" type="email" placeholder="ana@boldfy.com" disabled={pending} required />
      </div>
    </div>
  );
}

export default function MasterEstrategistasPage() {
  const { toast } = useToast();
  const [strategists, setStrategists] = useState<Strategist[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [cachedToken, setCachedToken] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  // Assign companies dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assigningStrategist, setAssigningStrategist] = useState<Strategist | null>(null);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);

  // Delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingStrategist, setDeletingStrategist] = useState<Strategist | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [inviteState, formAction] = useActionState(inviteStrategist, { error: undefined, success: undefined });

  useEffect(() => {
    getAuthToken().then(setCachedToken).catch(() => {});
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch strategists
      const strategistsQuery = query(
        collection(db, 'users'),
        where('role', '==', 'strategist')
      );
      const strategistsSnap = await getDocs(strategistsQuery);
      const strategistsList = strategistsSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || '',
          email: data.profile?.email || '',
          status: data.status || 'Ativo',
          avatarUrl: data.profile?.avatarUrl || data.photoURL || '',
          assignedCompanies: data.assignedCompanies || [],
        } as Strategist;
      });
      // Sort client-side (no composite index needed)
      strategistsList.sort((a, b) => a.name.localeCompare(b.name));

      // Fetch companies
      const companiesSnap = await getDocs(collection(db, 'companies'));
      const companiesList = companiesSnap.docs.map(d => ({
        id: d.id,
        companyName: d.data().companyName || '',
      }));
      companiesList.sort((a, b) => a.companyName.localeCompare(b.companyName));

      // Build name map
      const nameMap: Record<string, string> = {};
      for (const c of companiesList) {
        nameMap[c.id] = c.companyName;
      }

      setStrategists(strategistsList);
      setCompanies(companiesList);
      setCompanyNames(nameMap);
    } catch (error) {
      console.error('Error fetching strategists:', error);
      toast({ variant: 'destructive', title: 'Erro ao buscar estrategistas' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (inviteState.success) {
      toast({ title: 'Estrategista criado com sucesso!', description: 'O estrategista receberá um e-mail para definir sua senha.' });
      setIsDialogOpen(false);
      fetchData();
    }
    if (inviteState.error) {
      toast({ variant: 'destructive', title: 'Erro ao criar estrategista', description: inviteState.error });
    }
  }, [inviteState, toast]);

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAssign = (strategist: Strategist) => {
    setAssigningStrategist(strategist);
    setSelectedCompanies([...strategist.assignedCompanies]);
    setAssignDialogOpen(true);
  };

  const handleToggleCompany = (companyId: string) => {
    setSelectedCompanies(prev =>
      prev.includes(companyId)
        ? prev.filter(id => id !== companyId)
        : [...prev, companyId]
    );
  };

  const handleSaveAssign = async () => {
    if (!assigningStrategist) return;
    setIsAssigning(true);
    try {
      const token = await getAuthToken();
      const result = await assignCompaniesToStrategist(token, assigningStrategist.id, selectedCompanies);
      if (result.error) throw new Error(result.error);
      toast({ title: 'Empresas atribuídas com sucesso!' });
      setAssignDialogOpen(false);
      setAssigningStrategist(null);
      fetchData();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro ao atribuir empresas', description: error instanceof Error ? error.message : '' });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleOpenDelete = (strategist: Strategist) => {
    setDeletingStrategist(strategist);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingStrategist) return;
    setIsDeleting(true);
    try {
      const token = await getAuthToken();
      const result = await deleteStrategist(token, deletingStrategist.id);
      if (result.error) throw new Error(result.error);
      toast({ title: 'Estrategista removido com sucesso!' });
      setDeleteDialogOpen(false);
      setDeletingStrategist(null);
      fetchData();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro ao remover estrategista', description: error instanceof Error ? error.message : '' });
    } finally {
      setIsDeleting(false);
    }
  };

  const addButton = (
    <Button size="sm">
      <PlusCircle className="mr-2 h-4 w-4" />
      Adicionar Estrategista
    </Button>
  );

  return (
    <>
      <Header title="Estrategistas" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-headline">Gerenciamento de Estrategistas</CardTitle>
              <CardDescription>Gerencie os estrategistas da Boldfy e suas atribuições de empresas.</CardDescription>
            </div>
            <ActionDialog
              title="Adicionar Novo Estrategista"
              description="Envie um convite para um novo estrategista da equipe Boldfy."
              trigger={addButton}
              actionText="Criar e Convidar"
              onAction={() => formRef.current?.requestSubmit()}
              formId="strategist-form"
              open={isDialogOpen}
              onOpenChange={setIsDialogOpen}
            >
              <form ref={formRef} action={formAction} id="strategist-form">
                <input type="hidden" name="idToken" value={cachedToken} />
                <InviteFormContent />
              </form>
            </ActionDialog>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estrategista</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Empresas Atribuídas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead><span className="sr-only">Ações</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24">
                      <div className="flex justify-center items-center">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando estrategistas...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : strategists.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24">Nenhum estrategista encontrado.</TableCell>
                  </TableRow>
                ) : (
                  strategists.map(strategist => (
                    <TableRow key={strategist.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            {strategist.avatarUrl && (
                              <AvatarImage src={strategist.avatarUrl} alt={strategist.name} />
                            )}
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                              {strategist.name?.[0]?.toUpperCase() || 'S'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{strategist.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{strategist.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {strategist.assignedCompanies.length === 0 ? (
                            <span className="text-xs text-muted-foreground">Nenhuma</span>
                          ) : (
                            strategist.assignedCompanies.map(cId => (
                              <Badge key={cId} variant="secondary" className="text-xs">
                                {companyNames[cId] || cId}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={strategist.status === 'Ativo' ? 'default' : 'outline'}>
                          {strategist.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleOpenAssign(strategist)}>
                              <Building2 className="mr-2 h-4 w-4" />
                              Atribuir Empresas
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleOpenDelete(strategist)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir Estrategista
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>

        {/* Assign Companies Dialog */}
        <ActionDialog
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
          title={`Atribuir Empresas — ${assigningStrategist?.name || ''}`}
          description="Selecione as empresas que este estrategista irá gerenciar."
        >
          <div className="space-y-3 py-2 max-h-[400px] overflow-y-auto">
            {companies.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma empresa encontrada.</p>
            ) : (
              companies.map(company => (
                <label
                  key={company.id}
                  className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedCompanies.includes(company.id)}
                    onCheckedChange={() => handleToggleCompany(company.id)}
                  />
                  <span className="text-sm font-medium">{company.companyName}</span>
                </label>
              ))
            )}
          </div>
          <div className="flex justify-end pt-4">
            <Button onClick={handleSaveAssign} disabled={isAssigning}>
              {isAssigning ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</> : 'Salvar Atribuições'}
            </Button>
          </div>
        </ActionDialog>

        {/* Delete Confirmation Dialog */}
        <ActionDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Excluir Estrategista"
          description={`Tem certeza que deseja excluir ${deletingStrategist?.name || 'este estrategista'}? Esta ação é irreversível e removerá o estrategista de todas as empresas atribuídas.`}
          showCancel={false}
        >
          <div className="py-2">
            <p className="text-sm text-muted-foreground">
              O estrategista será removido permanentemente da plataforma e desvinculado de todas as empresas.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Excluindo...</> : 'Excluir Permanentemente'}
            </Button>
          </div>
        </ActionDialog>
      </main>
    </>
  );
}
