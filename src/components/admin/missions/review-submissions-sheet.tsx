// src/components/admin/missions/review-submissions-sheet.tsx
'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { CheckCircle2, XCircle, Eye } from 'lucide-react';
import type { Submission } from './use-admin-missions';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissions: Submission[];
  isReviewing: boolean;
  feedbackMap: Record<string, string>;
  setFeedbackMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onReview: (submissionId: string, action: 'approve' | 'reject') => void;
};

export function ReviewSubmissionsSheet({
  open, onOpenChange, submissions, isReviewing,
  feedbackMap, setFeedbackMap, onReview,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Comprovações Pendentes</SheetTitle>
          <SheetDescription>
            Revise as comprovações enviadas pelos colaboradores.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 mt-6">
          {submissions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma comprovação pendente.
            </p>
          ) : (
            submissions.map((sub) => (
              <Card key={sub.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{sub.missionName}</CardTitle>
                  <CardDescription className="text-xs">Enviado por: {sub.userName}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {sub.proofUrl && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Comprovação:</Label>
                      {sub.proofFileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                        <img src={sub.proofUrl} alt="Comprovação" className="rounded-md border max-h-48 w-full object-contain" />
                      ) : (
                        <a href={sub.proofUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {sub.proofFileName || 'Ver arquivo'}
                        </a>
                      )}
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs">Feedback (opcional, para rejeicao):</Label>
                    <Textarea
                      placeholder="Motivo da rejeicao..."
                      className="h-16 text-xs"
                      value={feedbackMap[sub.id] || ''}
                      onChange={(e) => setFeedbackMap((prev) => ({ ...prev, [sub.id]: e.target.value }))}
                      disabled={isReviewing}
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2 pt-0">
                  <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => onReview(sub.id, 'reject')} disabled={isReviewing}>
                    <XCircle className="h-3 w-3 mr-1" /> Rejeitar
                  </Button>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => onReview(sub.id, 'approve')} disabled={isReviewing}>
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Aprovar
                  </Button>
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
