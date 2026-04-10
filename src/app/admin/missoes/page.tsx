'use client';

import { Header } from '@/components/dashboard/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ActionDialog } from '@/components/dashboard/action-dialog';
import { PlusCircle, ChevronDown, Sparkles, CheckCircle2, Clock, History, FileCheck } from 'lucide-react';

import { useAdminMissions } from '@/components/admin/missions/use-admin-missions';
import { MissionForm } from '@/components/admin/missions/mission-form';
import { MissionTable } from '@/components/admin/missions/mission-table';
import { AISuggestionsDialog } from '@/components/admin/missions/ai-suggestions-dialog';
import { ReviewSubmissionsSheet } from '@/components/admin/missions/review-submissions-sheet';

export default function AdminMissoesPage() {
  const m = useAdminMissions();

  return (
    <>
      <Header title="Missoes" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        {/* Actions bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {m.totalPending > 0 && (
              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 cursor-pointer hover:bg-yellow-200 transition-colors" onClick={() => m.setReviewSheetOpen(true)}>
                <FileCheck className="h-3 w-3 mr-1" />
                {m.totalPending} comprovacao(oes) pendente(s)
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { m.setAiDialogOpen(true); m.handleGenerateAI(); }} disabled={m.isSubmitting || !m.companyId}>
              <Sparkles className="mr-2 h-4 w-4" />
              Gerar com IA
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" disabled={m.isSubmitting || !m.companyId}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Criar Missão
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <ActionDialog
                  title="Criar Missão com Período"
                  description="Configure uma missão com data de início e fim."
                  trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Missão com Período</DropdownMenuItem>}
                  actionText={m.isSubmitting ? 'Salvando...' : 'Criar Missão'}
                  onAction={() => m.handleAction(undefined, false)}
                  formId="mission-form"
                  open={m.createDialogOpen}
                  onOpenChange={m.setCreateDialogOpen}
                >
                  <MissionForm isSubmitting={m.isSubmitting} formRef={m.formRef} />
                </ActionDialog>
                <ActionDialog
                  title="Criar Missão Fixa"
                  description="Missão sempre ativa, sem data de término."
                  trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Missão Fixa</DropdownMenuItem>}
                  actionText={m.isSubmitting ? 'Salvando...' : 'Criar Missão'}
                  onAction={() => m.handleAction(undefined, true)}
                  formId="mission-form"
                  open={m.createFixedDialogOpen}
                  onOpenChange={m.setCreateFixedDialogOpen}
                >
                  <MissionForm isSubmitting={m.isSubmitting} formRef={m.formRef} isFixed />
                </ActionDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="ativas">
          <TabsList>
            <TabsTrigger value="ativas" className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Ativas
              {m.activeMissions.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{m.activeMissions.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="agendadas" className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Agendadas
              {m.scheduledMissions.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{m.scheduledMissions.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" />
              Histórico
              {m.pastMissions.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{m.pastMissions.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ativas">
            <Card>
              <CardHeader>
                <CardTitle>Missões Ativas</CardTitle>
                <CardDescription>Missões disponíveis para os colaboradores agora.</CardDescription>
              </CardHeader>
              <CardContent>
                <MissionTable missions={m.activeMissions} isLoading={m.isLoading} status="ativa" companyId={m.companyId} isSubmitting={m.isSubmitting} formRef={m.formRef} onEdit={m.handleAction} onDelete={m.handleDelete} onOpenReview={() => m.setReviewSheetOpen(true)} cols={8} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agendadas">
            <Card>
              <CardHeader>
                <CardTitle>Missões Agendadas</CardTitle>
                <CardDescription>Missões que serão ativadas automaticamente na data de início.</CardDescription>
              </CardHeader>
              <CardContent>
                <MissionTable missions={m.scheduledMissions} isLoading={m.isLoading} status="agendada" companyId={m.companyId} isSubmitting={m.isSubmitting} formRef={m.formRef} onEdit={m.handleAction} onDelete={m.handleDelete} onOpenReview={() => m.setReviewSheetOpen(true)} cols={7} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historico">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Missões</CardTitle>
                <CardDescription>Missões encerradas e seus resultados.</CardDescription>
              </CardHeader>
              <CardContent>
                <MissionTable missions={m.pastMissions} isLoading={m.isLoading} status="encerrada" companyId={m.companyId} isSubmitting={m.isSubmitting} formRef={m.formRef} onEdit={m.handleAction} onDelete={m.handleDelete} onOpenReview={() => m.setReviewSheetOpen(true)} cols={7} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* AI Suggestions Dialog */}
        <AISuggestionsDialog
          open={m.aiDialogOpen}
          onOpenChange={(open) => { m.setAiDialogOpen(open); }}
          isSubmitting={m.isSubmitting}
          aiLoading={m.aiLoading}
          suggestions={m.aiSuggestions}
          onToggle={m.toggleSuggestion}
          onUpdateDate={m.updateSuggestionDate}
          onUpdateField={m.updateSuggestionField}
          onSave={m.handleSaveAISuggestions}
        />

        {/* Review Submissions Sheet */}
        <ReviewSubmissionsSheet
          open={m.reviewSheetOpen}
          onOpenChange={m.setReviewSheetOpen}
          submissions={m.pendingSubmissions}
          isReviewing={m.isReviewing}
          feedbackMap={m.feedbackMap}
          setFeedbackMap={m.setFeedbackMap}
          onReview={m.handleReview}
        />
      </main>
    </>
  );
}
