
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, serverTimestamp, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle, Calendar as CalendarIcon, ChevronDown, GripVertical, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ActionDialog } from "@/components/dashboard/action-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';


type Mission = {
  id: string;
  name: string;
  description: string;
  points: number;
  status: 'Fixa' | 'Ativa' | 'Agendada' | 'Passada' | 'Inativa';
  type: 'fixed' | 'timed';
  participants?: string; // e.g., '32 / 45'
  startDate?: any;
  endDate?: any;
}

const MissionForm = ({ mission, isSubmitting, formRef, isFixed = false }: { mission?: Mission, isSubmitting: boolean, formRef: React.RefObject<HTMLFormElement>, isFixed?: boolean }) => {
    const [startDate, setStartDate] = useState<Date | undefined>(mission?.startDate?.toDate());
    const [endDate, setEndDate] = useState<Date | undefined>(mission?.endDate?.toDate());

    return (
    <form id="mission-form" ref={formRef} className="space-y-4">
       <input type="hidden" name="startDate" value={startDate?.toISOString()} />
       <input type="hidden" name="endDate" value={endDate?.toISOString()} />
      <div className="space-y-2">
        <Label htmlFor="mission-name">Nome da Missão</Label>
        <Input id="mission-name" name="name" placeholder={isFixed ? "Ex: Atualize seu banner do LinkedIn" : "Ex: Compartilhar post no LinkedIn"} disabled={isSubmitting} defaultValue={mission?.name} required/>
      </div>
      <div className="space-y-2">
        <Label htmlFor="mission-description">Descrição</Label>
        <Textarea id="mission-description" name="description" placeholder="Descreva o que o colaborador precisa fazer." disabled={isSubmitting} defaultValue={mission?.description} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="mission-points">Pontos</Label>
        <Input id="mission-points" name="points" type="number" placeholder="Ex: 100" disabled={isSubmitting} defaultValue={mission?.points} required/>
      </div>
       {!isFixed && (
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="start-date">Data de Início</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal" disabled={isSubmitting}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {startDate ? format(startDate, "PPP") : <span>Selecione uma data</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                        </PopoverContent>
                    </Popover>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="end-date">Data de Término</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal" disabled={isSubmitting}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {endDate ? format(endDate, "PPP") : <span>Selecione uma data</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
       )}
    </>
  );
}

  const SubmissionsView = () => (
    <p className="text-sm text-muted-foreground">Nenhum envio para esta missão ainda.</p>
  );

  const TableSkeleton = ({ cols }) => (
    <TableRow>
      <TableCell colSpan={cols} className="h-24 text-center">
        <div className="flex justify-center items-center">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando missões...
        </div>
      </TableCell>
    </TableRow>
  );


export default function AdminMissoesPage() {
  const [fixedMissions, setFixedMissions] = useState<Mission[]>([]);
  const [timedMissions, setTimedMissions] = useState<Mission[]>([]);
  const [pastMissions, setPastMissions] = useState<Mission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  
  const fetchMissions = useCallback(async (currentCompanyId: string) => {
    setIsLoading(true);
    try {
        const missionsCollection = collection(db, "companies", currentCompanyId, "missions");
        const missionsSnapshot = await getDocs(missionsCollection);
        const allMissions = missionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Mission);
        
        const now = new Date();
        const fixed = allMissions.filter(m => m.type === 'fixed');
        const timed = allMissions.filter(m => m.type === 'timed' && m.endDate?.toDate() >= now);
        const past = allMissions.filter(m => m.type === 'timed' && m.endDate?.toDate() < now);

        setFixedMissions(fixed);
        setTimedMissions(timed);
        setPastMissions(past);

    } catch(error) {
        console.error("Error fetching missions:", error);
        toast({ variant: 'destructive', title: 'Erro ao buscar missões.' });
    } finally {
        setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    onAuthStateChanged(auth, async (user: User | null) => {
        if (user) {
            const userDocSnap = await getDoc(doc(db, "users", user.uid));
            if (userDocSnap.exists()) {
                const userCompanyId = userDocSnap.data().companyId;
                setCompanyId(userCompanyId);
                fetchMissions(userCompanyId);
            } else {
                setIsLoading(false);
            }
        } else {
            setIsLoading(false);
        }
    });
  }, [fetchMissions]);

  const handleAction = async (missionId?: string, isFixed = false) => {
    if (!formRef.current || !companyId) return;

    setIsSubmitting(true);
    const formData = new FormData(formRef.current);
    const missionData: any = {
        name: formData.get('name'),
        description: formData.get('description'),
        points: Number(formData.get('points')),
        type: isFixed ? 'fixed' : 'timed',
        status: isFixed ? 'Fixa' : 'Agendada'
    };

    if (!isFixed) {
        missionData.startDate = new Date(formData.get('startDate') as string);
        missionData.endDate = new Date(formData.get('endDate') as string);
    }

    try {
        if (missionId) {
            await updateDoc(doc(db, "companies", companyId, "missions", missionId), missionData);
            toast({ title: "Missão atualizada com sucesso!" });
        } else {
            missionData.createdAt = serverTimestamp();
            await addDoc(collection(db, "companies", companyId, "missions"), missionData);
            toast({ title: "Missão criada com sucesso!" });
        }
        fetchMissions(companyId);
    } catch(error) {
        console.error("Error saving mission: ", error);
        toast({ variant: "destructive", title: "Erro ao salvar missão." });
    } finally {
        setIsSubmitting(false);
    }
  };

  const getStatusBadge = (mission: Mission) => {
    let variant: "default" | "secondary" | "outline" = "outline";
    let className = "";
    if (mission.status === 'Ativa') variant = "default";
    if (mission.status === 'Agendada') {
      variant = 'secondary';
      className = 'bg-primary/80 text-primary-foreground';
    }
    return <Badge variant={variant} className={className}>{mission.status}</Badge>;
  }

  const createTimedMissionButton = (
    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
      Criar Missão Padrão
    </DropdownMenuItem>
  );

  const createFixedMissionButton = (
     <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
      Criar Missão Fixa
    </DropdownMenuItem>
  );

    const editMissionButton = (isFixed = false) => (
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            Editar
        </DropdownMenuItem>
    );

     const viewSubmissionsButton = (
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            Ver Envios
        </DropdownMenuItem>
    );


  return (
    <>
      <Header title="Missões" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
          <div className="flex items-center justify-between">
             <div/>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="sm" disabled={isSubmitting || !companyId}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        <span>Criar Missão</span>
                        <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <ActionDialog
                      title="Criar Missão Padrão"
                      description="Configure uma nova missão com data de início e fim."
                      trigger={createTimedMissionButton}
                      actionText={isSubmitting ? "Salvando..." : "Salvar Missão"}
                      onAction={() => handleAction(undefined, false)}
                      formId="mission-form"
                    >
                      <MissionForm isSubmitting={isSubmitting} formRef={formRef} />
                    </ActionDialog>
                    <ActionDialog
                      title="Criar Missão Fixa"
                      description="Configure uma missão que ficará sempre ativa."
                      trigger={createFixedMissionButton}
                      actionText={isSubmitting ? "Salvando..." : "Salvar Missão"}
                      onAction={() => handleAction(undefined, true)}
                      formId="mission-form"
                    >
                      <MissionForm isSubmitting={isSubmitting} formRef={formRef} isFixed />
                    </ActionDialog>
                </DropdownMenuContent>
            </DropdownMenu>
          </div>
            <Card>
              <CardHeader>
                <CardTitle>Missões Fixas</CardTitle>
                <CardDescription>Gerencie as missões de onboarding que estão sempre ativas.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]"><span className="sr-only">Reordenar</span></TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Pontos</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Participantes</TableHead>
                      <TableHead><span className="sr-only">Ações</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                     {isLoading ? <TableSkeleton cols={6} /> : fixedMissions.length === 0 ? (
                        <TableRow>
                           <TableCell colSpan={6} className="text-center py-8">Nenhuma missão fixa encontrada.</TableCell>
                        </TableRow>
                     ) : fixedMissions.map((mission) => (
                        <TableRow key={mission.id}>
                          <TableCell className="cursor-grab"><GripVertical className="h-5 w-5 text-muted-foreground" /></TableCell>
                          <TableCell className="font-medium">{mission.name}</TableCell>
                          <TableCell>{mission.points}</TableCell>
                          <TableCell><Badge variant="outline">{mission.status}</Badge></TableCell>
                          <TableCell>{mission.participants || 'N/A'}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                 <ActionDialog
                                  title="Editar Missão Fixa"
                                  description="Atualize os detalhes desta missão."
                                  trigger={editMissionButton(true)}
                                  actionText="Salvar Alterações"
                                >
                                  <MissionForm isSubmitting={isSubmitting} formRef={formRef} mission={mission} isFixed/>
                                </ActionDialog>
                                <DropdownMenuItem>Desativar</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                     ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Missões Ativas e Agendadas</CardTitle>
                <CardDescription>Gerencie as missões com data definida para seus colaboradores.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Pontos</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Participantes</TableHead>
                      <TableHead><span className="sr-only">Ações</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? <TableSkeleton cols={6} /> : timedMissions.length === 0 ? (
                         <TableRow>
                           <TableCell colSpan={6} className="text-center py-8">Nenhuma missão ativa ou agendada.</TableCell>
                        </TableRow>
                    ) : timedMissions.map((mission) => (
                        <TableRow key={mission.id}>
                          <TableCell className="font-medium">{mission.name}</TableCell>
                          <TableCell>{mission.startDate?.toDate().toLocaleDateString()} - {mission.endDate?.toDate().toLocaleDateString()}</TableCell>
                          <TableCell>{mission.points}</TableCell>
                          <TableCell>{getStatusBadge(mission)}</TableCell>
                          <TableCell>{mission.participants || 'N/A'}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {mission.status === 'Ativa' && (
                                  <ActionDialog
                                    title="Ver Envios"
                                    description="Veja as comprovações enviadas pelos colaboradores."
                                    trigger={viewSubmissionsButton}
                                    actionText="Fechar"
                                    >
                                    <SubmissionsView />
                                  </ActionDialog>
                                )}
                                 <ActionDialog
                                  title="Editar Missão"
                                  description="Atualize os detalhes desta missão."
                                  trigger={editMissionButton()}
                                  actionText="Salvar Alterações"
                                >
                                  <MissionForm isSubmitting={isSubmitting} formRef={formRef} mission={mission}/>
                                </ActionDialog>
                                <DropdownMenuItem>{mission.status === 'Agendada' ? 'Cancelar' : 'Desativar'}</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Histórico de Missões</CardTitle>
                <CardDescription>Visualize o desempenho das missões que já foram encerradas.</CardDescription>
              </CardHeader>
               <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Pontos</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Participantes</TableHead>
                       <TableHead><span className="sr-only">Ações</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                     {isLoading ? <TableSkeleton cols={6} /> : pastMissions.length === 0 ? (
                        <TableRow>
                           <TableCell colSpan={6} className="text-center py-8">Nenhum histórico de missões.</TableCell>
                        </TableRow>
                     ) : pastMissions.map((mission) => (
                        <TableRow key={mission.id} className="text-muted-foreground">
                          <TableCell className="font-medium">{mission.name}</TableCell>
                          <TableCell>{mission.startDate?.toDate().toLocaleDateString()} - {mission.endDate?.toDate().toLocaleDateString()}</TableCell>
                          <TableCell>{mission.points}</TableCell>
                          <TableCell><Badge variant="outline">{mission.status}</Badge></TableCell>
                          <TableCell>{mission.participants || 'N/A'}</TableCell>
                          <TableCell>
                             <ActionDialog
                                title="Ver Envios"
                                description="Veja as comprovações enviadas pelos colaboradores."
                                trigger={<Button variant="ghost" size="sm">Ver Envios</Button>}
                                actionText="Fechar"
                                >
                                <SubmissionsView />
                            </ActionDialog>
                          </TableCell>
                        </TableRow>
                     ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
      </main>
    </>
  );
}
