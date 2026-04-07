// src/app/admin/colaboradores/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, getDocs, doc, getDoc, query, where, updateDoc } from 'firebase/firestore';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle, Loader2, Users, UserCheck, Linkedin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ActionDialog } from "@/components/dashboard/action-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from '@/hooks/use-toast';
import { inviteCollaborator, deleteCollaborator } from '@/app/actions';
import { getAuthToken } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n/context';

type Collaborator = {
  id: string;
  name: string;
  email: string;
  points: number;
  status: 'Ativo' | 'Inativo' | 'Pendente';
  createdAt: any;
  avatarUrl?: string;
  linkedinStatus: 'connected' | 'expiring' | 'expired' | 'not_connected';
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

export default function AdminColaboradoresPage() {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [totalLicenses, setTotalLicenses] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCollaborator, setEditingCollaborator] = useState<Collaborator | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteName, setConfirmDeleteName] = useState("");
  const [cachedToken, setCachedToken] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();
  const router = useRouter();
  const t = useT();

  const [inviteState, formAction] = useActionState(inviteCollaborator, { error: undefined, success: undefined });

  const fetchData = useCallback(async (currentCompanyId: string) => {
    setIsLoading(true);
    try {
      const companyDocRef = doc(db, "companies", currentCompanyId);
      const companyDocSnap = await getDoc(companyDocRef);
      if(companyDocSnap.exists()) {
        setTotalLicenses(companyDocSnap.data().licenses || 0);
      }

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

    } catch (error) {
      console.error("Error fetching collaborators: ", error);
      toast({ variant: "destructive", title: t.adminCollaborators.errorFetch});
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
        const token = await getAuthToken();
        setCachedToken(token);
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          const userCompanyId = userData.companyId;
          if (userCompanyId) {
            setCompanyId(userCompanyId);
            fetchData(userCompanyId);
          } else {
            toast({ variant: "destructive", title: t.adminCollaborators.errorCompanyNotFound });
            setIsLoading(false);
          }
        } else {
          toast({ variant: "destructive", title: t.adminCollaborators.errorUserNotFound });
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        toast({ variant: "destructive", title: t.adminCollaborators.errorLoadUser });
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [fetchData, router, toast]);

  useEffect(() => {
    if (inviteState.success) {
      toast({ title: t.adminCollaborators.toastInviteSent, description: t.adminCollaborators.toastInviteDescription });
      setIsDialogOpen(false);
      if (companyId) fetchData(companyId);
    }
    if (inviteState.error) {
      toast({ variant: "destructive", title: t.adminCollaborators.toastInviteError, description: inviteState.error });
    }
  }, [inviteState, toast, companyId, fetchData]);

  const inviteButton = (
    <Button size="sm" disabled={isLoading || !companyId || collaborators.length >= totalLicenses}>
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
      await updateDoc(doc(db, "users", editingCollaborator.id), {
        'profile.name': editName,
        'profile.email': editEmail,
      });
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
      await updateDoc(doc(db, "users", collab.id), { status: newStatus });
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
          <StatCard title={t.adminCollaborators.availableLicenses} value={`${collaborators.length} / ${totalLicenses}`} icon={Users} isLoading={isLoading} />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t.adminCollaborators.teamTitle}</CardTitle>
            <CardDescription>{t.adminCollaborators.teamDescription}</CardDescription>
          </CardHeader>
          <CardContent>
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
                      <TableCell>{user.createdAt?.toLocaleDateString() || 'N/A'}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>{t.common.viewProfile}</DropdownMenuItem>
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
          </CardContent>
        </Card>

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
      </main>
    </>
  );
}
