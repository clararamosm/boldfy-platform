// src/app/admin/colaboradores/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useResolvedCompanyId } from '@/hooks/use-resolved-company-id';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle, Loader2, Users, UserCheck, Linkedin, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ActionDialog } from "@/components/dashboard/action-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from '@/hooks/use-toast';
import { inviteCollaborator, deleteCollaborator, inviteThoughtLeader, invitePendingThoughtLeader, deleteThoughtLeader, updateCollaboratorProfile, toggleCollaboratorStatus } from '@/app/actions';
import { resendInvite } from '@/app/actions/users';
import { getAuthToken } from '@/lib/auth-client';
import { useT } from '@/lib/i18n/context';
import { useAuth } from '@/contexts/auth-context';
import { useCompanyData } from '@/hooks/use-company-data';
import { completeOnboardingItem } from '@/hooks/use-onboarding';

type Collaborator = {
  id: string;
  name: string;
  email: string;
  points: number;
  status: 'Ativo' | 'Inativo' | 'Pendente';
  createdAt: { toDate?: () => Date } | string | null;
  avatarUrl?: string;
  linkedinStatus: 'connected' | 'expiring' | 'expired' | 'not_connected';
  pendingSetup?: boolean;
};

function getLinkedinTokenStatus(data: Record<string, unknown>): Collaborator['linkedinStatus'] {
  const connection = data?.linkedinConnection as { tokenExpiresAt?: number } | undefined;
  if (!connection?.tokenExpiresAt) return 'not_connected';
  const msLeft = connection.tokenExpiresAt - Date.now();
  if (msLeft <= 0) return 'expired';
  if (msLeft <= 7 * 24 * 60 * 60 * 1000) return 'expiring';
  return 'connected';
}

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
  const t = useT();
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">{t.adminCollaborators.inviteName}</Label>
        <Input name="name" id="name" placeholder={t.adminCollaborators.inviteNamePlaceholder} required disabled={pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">{t.adminCollaborators.inviteEmail}</Label>
        <Input name="email" id="email" type="email" placeholder={t.adminCollaborators.inviteEmailPlaceholder} required disabled={pending} />
      </div>
    </div>
  );
}

function TLInviteForm({ formAction, companyId, cachedToken, userRole, t }: {
  formAction: (payload: FormData) => void;
  companyId: string;
  cachedToken: string;
  userRole?: string;
  t: ReturnType<typeof useT>;
}) {
  const [skipInvite, setSkipInvite] = useState(false);
  const canSkip = userRole === 'master' || userRole === 'strategist';
  return (
    <form action={formAction}>
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="idToken" value={cachedToken} />
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="tlName">{t.adminTL.inviteName}</Label>
          <Input name="name" id="tlName" placeholder={t.adminTL.inviteNamePlaceholder} required />
        </div>
        {canSkip && (
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              name="skipInvite"
              value="true"
              id="tlSkipInvite"
              className="h-4 w-4 rounded border-gray-300"
              checked={skipInvite}
              onChange={(e) => setSkipInvite(e.target.checked)}
            />
            <Label htmlFor="tlSkipInvite" className="text-sm font-normal text-muted-foreground">Criar sem enviar convite</Label>
          </div>
        )}
        {!skipInvite && (
          <div className="space-y-2">
            <Label htmlFor="tlEmail">{t.adminTL.inviteEmail}</Label>
            <Input name="email" id="tlEmail" type="email" placeholder={t.adminTL.inviteEmailPlaceholder} required />
          </div>
        )}
      </div>
      <div className="flex justify-end mt-6">
        <Button type="submit">{skipInvite ? 'Criar Thought Leader' : t.adminTL.sendInvite}</Button>
      </div>
    </form>
  );
}

export default function AdminColaboradoresPage() {
  const { user } = useAuth();
  const companyId = useResolvedCompanyId();
  const { company } = useCompanyData(companyId);
  // Nota: removido `totalLicenses` (company.licenses) pois nao limita mais
  // o convite de colaboradores no modelo per-seat dinamico. O TL ainda usa
  // tlLicenses pois o plano TL tem assentos contratados separadamente.
  const totalTLLicenses = company?.tlLicenses || 0;

  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [thoughtLeaders, setThoughtLeaders] = useState<Collaborator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTLDialogOpen, setIsTLDialogOpen] = useState(false);
  const [editingCollaborator, setEditingCollaborator] = useState<Collaborator | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteName, setConfirmDeleteName] = useState("");
  const [cachedToken, setCachedToken] = useState('');
  // TL management states
  const [editingTL, setEditingTL] = useState<Collaborator | null>(null);
  const [editTLName, setEditTLName] = useState("");
  const [editTLEmail, setEditTLEmail] = useState("");
  const [isEditTLDialogOpen, setIsEditTLDialogOpen] = useState(false);
  const [confirmDeleteTLId, setConfirmDeleteTLId] = useState<string | null>(null);
  const [confirmDeleteTLName, setConfirmDeleteTLName] = useState("");
  const [invitingTL, setInvitingTL] = useState<Collaborator | null>(null);
  const [isInviteTLDialogOpen, setIsInviteTLDialogOpen] = useState(false);
  const [inviteTLEmail, setInviteTLEmail] = useState("");
  const [isTLActionLoading, setIsTLActionLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();
  const t = useT();

  const [inviteState, formAction] = useActionState(inviteCollaborator, { error: undefined, success: undefined });
  const [inviteTLState, tlFormAction] = useActionState(inviteThoughtLeader, { error: undefined, success: undefined });


  const fetchCollaborators = useCallback(async (currentCompanyId: string) => {
    setIsLoading(true);
    try {
      // Fetch collaborators
      const collaboratorsQuery = query(collection(db, "users"), where("companyId", "==", currentCompanyId), where("role", "==", "colaborador"));
      const querySnapshot = await getDocs(collaboratorsQuery);
      const fetchedCollaborators = querySnapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: data.profile?.name || '',
          email: data.profile?.email || '',
          points: data.points || 0,
          status: data.status || 'Pendente',
          createdAt: data.createdAt?.toDate(),
          avatarUrl: data.profile?.avatarUrl || data.photoURL || data.linkedinConnection?.picture,
          linkedinStatus: getLinkedinTokenStatus(data),
        }
      }) as Collaborator[];
      setCollaborators(fetchedCollaborators);

      // Fetch thought leaders
      const tlQuery = query(collection(db, "users"), where("companyId", "==", currentCompanyId), where("role", "==", "thoughtleader"));
      const tlSnapshot = await getDocs(tlQuery);
      const fetchedTLs = tlSnapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: data.profile?.name || data.name || '',
          email: data.profile?.email || '',
          points: 0,
          status: data.status || 'Pendente',
          createdAt: data.createdAt?.toDate(),
          avatarUrl: data.profile?.avatarUrl || data.photoURL || data.linkedinConnection?.picture,
          linkedinStatus: getLinkedinTokenStatus(data),
          pendingSetup: data.pendingSetup || false,
        }
      }) as Collaborator[];
      setThoughtLeaders(fetchedTLs);
    } catch (error) {
      console.error("Error fetching collaborators: ", error);
      toast({ variant: "destructive", title: t.adminCollaborators.errorFetch});
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Fetch collaborators + auth token when companyId becomes available
  useEffect(() => {
    if (!companyId) return;
    fetchCollaborators(companyId);
    getAuthToken().then(setCachedToken).catch(() => {});
  }, [companyId, fetchCollaborators]);

  useEffect(() => {
    if (inviteState.success) {
      toast({ title: t.adminCollaborators.toastInviteSent, description: t.adminCollaborators.toastInviteDescription });
      setIsDialogOpen(false);
      if (companyId) fetchCollaborators(companyId);
      completeOnboardingItem(user?.uid, 'invite-collaborator');
    }
    if (inviteState.error) {
      toast({ variant: "destructive", title: t.adminCollaborators.toastInviteError, description: inviteState.error });
    }
  }, [inviteState, toast, companyId, fetchCollaborators]);

  useEffect(() => {
    if (inviteTLState.success) {
      toast({ title: t.adminTL.toastInviteSent, description: t.adminTL.toastInviteDescription });
      setIsTLDialogOpen(false);
      if (companyId) fetchCollaborators(companyId);
    }
    if (inviteTLState.error) {
      toast({ variant: "destructive", title: t.adminTL.toastInviteError, description: inviteTLState.error });
    }
  }, [inviteTLState, toast, companyId, fetchCollaborators]);

  // Modelo per-seat dinamico: convite e sempre permitido. Novos colaboradores
  // alem dos 3 seats minimos comecam a ser cobrados quando ativam a conta.
  const inviteButton = (
    <Button size="sm" disabled={isLoading || !companyId}>
      <PlusCircle className="mr-2 h-4 w-4" />
      {t.adminCollaborators.invite}
    </Button>
  );

  const getStatusBadge = (status: Collaborator['status']) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      'Ativo': 'default',
      'Pendente': 'secondary',
      'Inativo': 'outline',
    };
    const statusLabels: Record<string, string> = {
      'Ativo': t.common.active,
      'Pendente': t.adminCollaborators.statusPending,
      'Inativo': t.common.inactive,
    };
    return <Badge variant={variants[status] || 'outline'}>{statusLabels[status] || status}</Badge>;
  };


  // --- CRUD Handler Functions ---
  const refreshCollaborators = async () => {
    if (!companyId) return;
    const q = query(
      collection(db, "users"),
      where("companyId", "==", companyId),
      where("role", "==", "colaborador")
    );
    const snapshot = await getDocs(q);
    const collabList = snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        name: data.profile?.name || '',
        email: data.profile?.email || '',
        points: data.points || 0,
        status: data.status || 'Pendente',
        createdAt: data.createdAt?.toDate(),
        avatarUrl: data.profile?.avatarUrl || data.photoURL || data.linkedinConnection?.picture,
        linkedinStatus: getLinkedinTokenStatus(data),
      };
    }) as Collaborator[];
    setCollaborators(collabList);
  };

  const handleEditOpen = (collab: Collaborator) => {
    setEditingCollaborator(collab);
    setEditName(collab.name);
    setEditEmail(collab.email);
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingCollaborator) return;
    try {
      const token = await getAuthToken();
      const result = await updateCollaboratorProfile(token, companyId || '', editingCollaborator.id, editName, editEmail);
      if (result.error) {
        toast({ title: t.adminCollaborators.toastUpdateError, description: result.error, variant: "destructive" });
        return;
      }
      toast({ title: t.adminCollaborators.toastUpdated });
      setIsEditDialogOpen(false);
      setEditingCollaborator(null);
      await refreshCollaborators();
    } catch (error) {
      toast({ title: t.adminCollaborators.toastUpdateError, variant: "destructive" });
    }
  };

  const handleToggleStatus = async (collab: Collaborator) => {
    const newStatus = collab.status === "Ativo" ? "Inativo" : "Ativo";
    try {
      const token = await getAuthToken();
      const result = await toggleCollaboratorStatus(token, companyId || '', collab.id, newStatus);
      if (result.error) {
        toast({ title: t.adminCollaborators.toastToggleError, description: result.error, variant: "destructive" });
        return;
      }
      toast({ title: newStatus === "Ativo" ? t.adminCollaborators.toastActivated : t.adminCollaborators.toastDeactivated });
      await refreshCollaborators();
    } catch (error) {
      toast({ title: t.adminCollaborators.toastToggleError, variant: "destructive" });
    }
  };

  const handleRemoveConfirm = (collab: Collaborator) => {
    setConfirmDeleteId(collab.id);
    setConfirmDeleteName(collab.name);
  };

  const [resendingId, setResendingId] = useState<string | null>(null);

  const handleResendInvite = async (userId: string) => {
    setResendingId(userId);
    try {
      const token = await getAuthToken();
      const result = await resendInvite(token, userId);
      if (result.error) {
        toast({ title: 'Erro ao reenviar convite', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Convite reenviado!', description: 'Um novo link de acesso foi enviado por e-mail.' });
      }
    } catch {
      toast({ title: 'Erro ao reenviar convite', variant: 'destructive' });
    } finally {
      setResendingId(null);
    }
  };

  const handleRemoveCollaborator = async () => {
    if (!confirmDeleteId) return;
    try {
      const token = await getAuthToken();
      const result = await deleteCollaborator(token, confirmDeleteId);
      if (result.error) {
        toast({ title: t.adminCollaborators.toastRemoveError, description: result.error, variant: "destructive" });
      } else {
        toast({ title: t.adminCollaborators.toastRemoved });
      }
      setConfirmDeleteId(null);
      setConfirmDeleteName("");
      await refreshCollaborators();
    } catch (error) {
      toast({ title: t.adminCollaborators.toastRemoveError, variant: "destructive" });
    }
  };

  // --- TL CRUD Handler Functions ---
  const refreshThoughtLeaders = async () => {
    if (!companyId) return;
    const q = query(
      collection(db, "users"),
      where("companyId", "==", companyId),
      where("role", "==", "thoughtleader")
    );
    const snapshot = await getDocs(q);
    const tlList = snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        name: data.profile?.name || data.name || '',
        email: data.profile?.email || '',
        points: 0,
        status: data.status || 'Pendente',
        createdAt: data.createdAt?.toDate(),
        avatarUrl: data.profile?.avatarUrl || data.photoURL || data.linkedinConnection?.picture,
        linkedinStatus: getLinkedinTokenStatus(data),
        pendingSetup: data.pendingSetup || false,
      };
    }) as Collaborator[];
    setThoughtLeaders(tlList);
  };

  const handleTLInviteOpen = (tl: Collaborator) => {
    setInvitingTL(tl);
    setInviteTLEmail("");
    setIsInviteTLDialogOpen(true);
  };

  const handleTLInvite = async () => {
    if (!invitingTL || !inviteTLEmail) return;
    setIsTLActionLoading(true);
    try {
      const token = await getAuthToken();
      const result = await invitePendingThoughtLeader(token, invitingTL.id, inviteTLEmail);
      if (result.error) {
        toast({ title: t.adminTL.toastInvitePendingError, description: result.error, variant: "destructive" });
      } else {
        toast({ title: t.adminTL.toastInvitePendingSent, description: t.adminTL.toastInvitePendingSentDescription });
        setIsInviteTLDialogOpen(false);
        setInvitingTL(null);
        await refreshThoughtLeaders();
      }
    } catch {
      toast({ title: t.adminTL.toastInvitePendingError, variant: "destructive" });
    } finally {
      setIsTLActionLoading(false);
    }
  };

  const handleTLEditOpen = (tl: Collaborator) => {
    setEditingTL(tl);
    setEditTLName(tl.name);
    setEditTLEmail(tl.email);
    setIsEditTLDialogOpen(true);
  };

  const handleTLSaveEdit = async () => {
    if (!editingTL) return;
    setIsTLActionLoading(true);
    try {
      const token = await getAuthToken();
      const result = await updateCollaboratorProfile(token, companyId || '', editingTL.id, editTLName, editTLEmail);
      if (result.error) {
        toast({ title: t.adminTL.toastUpdateError, description: result.error, variant: "destructive" });
      } else {
        toast({ title: t.adminTL.toastUpdated });
        setIsEditTLDialogOpen(false);
        setEditingTL(null);
        await refreshThoughtLeaders();
      }
    } catch {
      toast({ title: t.adminTL.toastUpdateError, variant: "destructive" });
    } finally {
      setIsTLActionLoading(false);
    }
  };

  const handleTLToggleStatus = async (tl: Collaborator) => {
    const newStatus = tl.status === "Ativo" ? "Inativo" : "Ativo";
    try {
      const token = await getAuthToken();
      const result = await toggleCollaboratorStatus(token, companyId || '', tl.id, newStatus);
      if (result.error) {
        toast({ title: t.adminTL.toastToggleError, description: result.error, variant: "destructive" });
        return;
      }
      toast({ title: newStatus === "Ativo" ? t.adminTL.toastActivated : t.adminTL.toastDeactivated });
      await refreshThoughtLeaders();
    } catch {
      toast({ title: t.adminTL.toastToggleError, variant: "destructive" });
    }
  };

  const handleTLRemoveConfirm = (tl: Collaborator) => {
    setConfirmDeleteTLId(tl.id);
    setConfirmDeleteTLName(tl.name);
  };

  const handleTLRemove = async () => {
    if (!confirmDeleteTLId) return;
    setIsTLActionLoading(true);
    try {
      const token = await getAuthToken();
      const result = await deleteThoughtLeader(token, confirmDeleteTLId);
      if (result.error) {
        toast({ title: t.adminTL.toastRemoveError, description: result.error, variant: "destructive" });
      } else {
        toast({ title: t.adminTL.toastRemoved });
      }
      setConfirmDeleteTLId(null);
      setConfirmDeleteTLName("");
      await refreshThoughtLeaders();
    } catch {
      toast({ title: t.adminTL.toastRemoveError, variant: "destructive" });
    } finally {
      setIsTLActionLoading(false);
    }
  };

  return (
    <>
      <Header title={t.adminCollaborators.title} action={
        <ActionDialog
          trigger={inviteButton}
          title={t.adminCollaborators.inviteTitle}
          description={t.adminCollaborators.inviteDescription}
          open={isDialogOpen}
          onOpenChange={async (open) => {
            if (open) {
              const freshToken = await getAuthToken();
              setCachedToken(freshToken);
            }
            setIsDialogOpen(open);
          }}
        >
          <form action={formAction} ref={formRef}>
            <input type="hidden" name="companyId" value={companyId || ''} />
            <input type="hidden" name="idToken" value={cachedToken} />
            <InviteFormContent />
            <div className="flex justify-end mt-6">
              <Button type="submit">{t.adminCollaborators.sendInvite}</Button>
            </div>
          </form>
        </ActionDialog>
      } />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
          <StatCard title={t.adminCollaborators.totalCollaborators} value={String(collaborators.length)} icon={Users} isLoading={isLoading} />
          <StatCard title={t.adminCollaborators.activeCollaborators} value={String(collaborators.filter(c => c.status === 'Ativo').length)} icon={UserCheck} isLoading={isLoading} />
          {/*
            Modelo per-seat: nao ha mais limite. O numero mostrado e o de
            assentos cobrados (minimo 3, escala com colaboradores ativos).
            Label da chave i18n availableLicenses ja foi atualizado para
            "Assentos Cobrados" / "Billed Seats".
          */}
          <StatCard title={t.adminCollaborators.availableLicenses} value={String(Math.max(collaborators.filter(c => c.status === 'Ativo').length, 3))} icon={Users} isLoading={isLoading} />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t.adminCollaborators.teamTitle}</CardTitle>
            <CardDescription>{t.adminCollaborators.teamDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.adminCollaborators.tableCollaborator}</TableHead>
                  <TableHead>{t.adminCollaborators.tablePoints}</TableHead>
                  <TableHead>{t.adminCollaborators.tableStatus}</TableHead>
                  <TableHead>{t.adminCollaborators.tableLinkedin}</TableHead>
                  <TableHead>{t.adminCollaborators.tableJoinDate}</TableHead>
                  <TableHead className="text-right">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      <div className="flex justify-center items-center p-4">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <span className="ml-2">{t.adminCollaborators.loading}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : collaborators.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      {t.adminCollaborators.empty}
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
                      <TableCell>
                        {user.linkedinStatus === 'connected' && (
                          <Badge variant="outline" className="text-[#0A66C2] border-[#0A66C2]/30 bg-[#0A66C2]/5">
                            <Linkedin className="h-3 w-3 mr-1" /> {t.adminCollaborators.linkedinConnected}
                          </Badge>
                        )}
                        {user.linkedinStatus === 'expiring' && (
                          <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30">
                            <Linkedin className="h-3 w-3 mr-1" /> {t.adminCollaborators.linkedinExpiring}
                          </Badge>
                        )}
                        {user.linkedinStatus === 'expired' && (
                          <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50 dark:bg-red-950/30">
                            <Linkedin className="h-3 w-3 mr-1" /> {t.adminCollaborators.linkedinExpired}
                          </Badge>
                        )}
                        {user.linkedinStatus === 'not_connected' && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{user.createdAt && typeof user.createdAt === 'object' && user.createdAt !== null && 'toDate' in user.createdAt && typeof user.createdAt.toDate === 'function' ? user.createdAt.toDate().toLocaleDateString() : user.createdAt ? new Date(user.createdAt as string).toLocaleDateString() : 'N/A'}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {user.status === 'Pendente' && (
                              <>
                                <DropdownMenuItem onClick={() => handleResendInvite(user.id)} disabled={resendingId === user.id}>
                                  {resendingId === user.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                                  Reenviar Convite
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            <DropdownMenuItem onClick={() => handleEditOpen(user)}>{t.common.edit}</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleToggleStatus(user)}>{user.status === "Ativo" ? t.common.deactivate : t.common.activate}</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleRemoveConfirm(user)}>{t.common.remove}</DropdownMenuItem>
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

        {/* Thought Leaders Section */}
        {totalTLLicenses > 0 && (
          <Card className="mt-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t.adminTL.title}</CardTitle>
                <CardDescription>{thoughtLeaders.length} / {totalTLLicenses} {t.adminTL.availableTLLicenses.toLowerCase()}</CardDescription>
              </div>
              <ActionDialog
                trigger={
                  <div title={thoughtLeaders.length >= totalTLLicenses ? 'Limite de licenças de TL atingido' : undefined}>
                  <Button size="sm" disabled={isLoading || !companyId || thoughtLeaders.length >= totalTLLicenses}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    {t.adminTL.invite}
                  </Button>
                  </div>
                }
                title={t.adminTL.inviteTitle}
                description={t.adminTL.inviteDescription}
                open={isTLDialogOpen}
                onOpenChange={async (open) => {
                  if (open) {
                    const freshToken = await getAuthToken();
                    setCachedToken(freshToken);
                  }
                  setIsTLDialogOpen(open);
                }}
              >
                <TLInviteForm
                  formAction={tlFormAction}
                  companyId={companyId || ''}
                  cachedToken={cachedToken}
                  userRole={user?.role}
                  t={t}
                />
              </ActionDialog>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.adminTL.tableThoughtLeader}</TableHead>
                    <TableHead>{t.adminTL.tableStatus}</TableHead>
                    <TableHead>{t.adminTL.tableLinkedin}</TableHead>
                    <TableHead>{t.adminTL.tableJoinDate}</TableHead>
                    <TableHead className="text-right">{t.common.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : thoughtLeaders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        {t.adminTL.empty}
                      </TableCell>
                    </TableRow>
                  ) : (
                    thoughtLeaders.map((tl) => (
                      <TableRow key={tl.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={tl.avatarUrl} />
                              <AvatarFallback>{tl.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{tl.name}</p>
                              <p className="text-sm text-muted-foreground">{tl.email ? tl.email : <span className="italic text-muted-foreground/60">{t.adminTL.statusPending}</span>}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(tl.status)}</TableCell>
                        <TableCell>
                          {tl.linkedinStatus === 'connected' && (
                            <Badge variant="outline" className="text-[#0A66C2] border-[#0A66C2]/30 bg-[#0A66C2]/5">
                              <Linkedin className="h-3 w-3 mr-1" /> {t.adminCollaborators.linkedinConnected}
                            </Badge>
                          )}
                          {tl.linkedinStatus === 'expiring' && (
                            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                              <Linkedin className="h-3 w-3 mr-1" /> {t.adminCollaborators.linkedinExpiring}
                            </Badge>
                          )}
                          {tl.linkedinStatus === 'expired' && (
                            <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50">
                              <Linkedin className="h-3 w-3 mr-1" /> {t.adminCollaborators.linkedinExpired}
                            </Badge>
                          )}
                          {tl.linkedinStatus === 'not_connected' && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>{tl.createdAt && typeof tl.createdAt === 'object' && tl.createdAt !== null && 'toDate' in tl.createdAt && typeof tl.createdAt.toDate === 'function' ? tl.createdAt.toDate().toLocaleDateString() : tl.createdAt ? new Date(tl.createdAt as string).toLocaleDateString() : 'N/A'}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {tl.pendingSetup && (
                                <>
                                  <DropdownMenuItem onClick={() => handleTLInviteOpen(tl)}>
                                    <Send className="h-4 w-4 mr-2" />
                                    {t.adminTL.invitePendingButton}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              {tl.status === 'Pendente' && !tl.pendingSetup && (
                                <>
                                  <DropdownMenuItem onClick={() => handleResendInvite(tl.id)} disabled={resendingId === tl.id}>
                                    {resendingId === tl.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                                    Reenviar Convite
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              <DropdownMenuItem onClick={() => handleTLEditOpen(tl)}>{t.common.edit}</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleTLToggleStatus(tl)}>{tl.status === "Ativo" ? t.common.deactivate : t.common.activate}</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => handleTLRemoveConfirm(tl)}>{t.common.remove}</DropdownMenuItem>
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
        )}

        {/* Edit Collaborator Dialog */}
        <ActionDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          title={t.adminCollaborators.editTitle}
          description={t.adminCollaborators.editDescription}
        >
          <div className="space-y-4">
            <div>
              <Label htmlFor="editName">{t.adminCollaborators.nameLabel}</Label>
              <Input id="editName" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="editEmail">{t.adminCollaborators.emailLabel}</Label>
              <Input id="editEmail" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
            <Button onClick={handleSaveEdit} className="w-full">{t.common.save}</Button>
          </div>
        </ActionDialog>

        {/* Confirm Delete Dialog */}
        <ActionDialog
          open={!!confirmDeleteId}
          onOpenChange={(open) => { if (!open) { setConfirmDeleteId(null); setConfirmDeleteName(""); } }}
          title={t.adminCollaborators.removeTitle}
          description={t.adminCollaborators.removeConfirm.replace('{name}', confirmDeleteName)}
        >
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => { setConfirmDeleteId(null); setConfirmDeleteName(""); }}>{t.common.cancel}</Button>
            <Button variant="destructive" onClick={handleRemoveCollaborator}>{t.common.remove}</Button>
          </div>
        </ActionDialog>

        {/* TL: Invite Pending Dialog */}
        <ActionDialog
          open={isInviteTLDialogOpen}
          onOpenChange={(open) => { if (!open) { setIsInviteTLDialogOpen(false); setInvitingTL(null); setInviteTLEmail(""); } }}
          title={t.adminTL.invitePendingTitle}
          description={t.adminTL.invitePendingDescription}
        >
          <div className="space-y-4">
            <div>
              <Label>{t.adminTL.nameLabel}</Label>
              <Input value={invitingTL?.name || ''} disabled className="bg-muted" />
            </div>
            <div>
              <Label htmlFor="inviteTLEmail">{t.adminTL.invitePendingEmailLabel}</Label>
              <Input
                id="inviteTLEmail"
                type="email"
                value={inviteTLEmail}
                onChange={(e) => setInviteTLEmail(e.target.value)}
                placeholder={t.adminTL.invitePendingEmailPlaceholder}
                required
              />
            </div>
            <Button onClick={handleTLInvite} className="w-full" disabled={!inviteTLEmail || isTLActionLoading}>
              {isTLActionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              {t.adminTL.invitePendingButton}
            </Button>
          </div>
        </ActionDialog>

        {/* TL: Edit Dialog */}
        <ActionDialog
          open={isEditTLDialogOpen}
          onOpenChange={setIsEditTLDialogOpen}
          title={t.adminTL.editTitle}
          description={t.adminTL.editDescription}
        >
          <div className="space-y-4">
            <div>
              <Label htmlFor="editTLName">{t.adminTL.nameLabel}</Label>
              <Input id="editTLName" value={editTLName} onChange={(e) => setEditTLName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="editTLEmail">{t.adminTL.emailLabel}</Label>
              <Input id="editTLEmail" type="email" value={editTLEmail} onChange={(e) => setEditTLEmail(e.target.value)} />
            </div>
            <Button onClick={handleTLSaveEdit} className="w-full" disabled={isTLActionLoading}>
              {isTLActionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t.common.save}
            </Button>
          </div>
        </ActionDialog>

        {/* TL: Confirm Delete Dialog */}
        <ActionDialog
          open={!!confirmDeleteTLId}
          onOpenChange={(open) => { if (!open) { setConfirmDeleteTLId(null); setConfirmDeleteTLName(""); } }}
          title={t.adminTL.removeTitle}
          description={t.adminTL.removeConfirm.replace('{name}', confirmDeleteTLName)}
        >
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => { setConfirmDeleteTLId(null); setConfirmDeleteTLName(""); }}>{t.common.cancel}</Button>
            <Button variant="destructive" onClick={handleTLRemove} disabled={isTLActionLoading}>
              {isTLActionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t.common.remove}
            </Button>
          </div>
        </ActionDialog>
      </main>
    </>
  );
}
