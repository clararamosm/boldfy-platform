'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Lightbulb, Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sendFeedbackToNotion } from '@/app/actions/feedback';
import { useAuth } from '@/contexts/auth-context';

type SuggestTrailDialogProps = {
  pagina: 'Trilhas Admin' | 'Trilhas Colaborador';
};

export function SuggestTrailDialog({ pagina }: SuggestTrailDialogProps) {
  const [open, setOpen] = useState(false);
  const [descricao, setDescricao] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSubmit = async () => {
    if (!descricao.trim()) {
      toast({ variant: 'destructive', title: 'Descrição obrigatória', description: 'Escreva sua sugestão de trilha.' });
      return;
    }

    setSending(true);

    try {
      const titulo = `📚 ${descricao.slice(0, 60)}${descricao.length > 60 ? '...' : ''}`;

      const result = await sendFeedbackToNotion({
        tipo: 'Sugestão de Trilha',
        titulo,
        descricao,
        pagina,
        userName: user?.name,
        userEmail: user?.email,
        companyId: user?.companyId,
      });

      if (result.success) {
        setSent(true);
        setTimeout(() => {
          setOpen(false);
          setTimeout(() => {
            setSent(false);
            setDescricao('');
          }, 300);
        }, 1500);
      } else {
        toast({ variant: 'destructive', title: 'Erro ao enviar', description: result.error });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível enviar a sugestão.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Lightbulb className="h-4 w-4" />
          Sugira novas trilhas
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {sent ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="font-semibold text-lg">Sugestão enviada!</p>
            <p className="text-sm text-muted-foreground">Obrigado por contribuir!</p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-500" />
                Sugira novas trilhas
              </DialogTitle>
              <DialogDescription>
                Que tipo de trilha você gostaria de ver? Temas, habilidades, formatos — tudo vale!
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="trail-suggestion" className="text-sm font-medium">Sua sugestão</Label>
                <Textarea
                  id="trail-suggestion"
                  placeholder="Ex: Uma trilha sobre como criar carrosséis no LinkedIn, ou sobre storytelling profissional..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={4}
                />
              </div>

              <Button
                onClick={handleSubmit}
                disabled={sending || !descricao.trim()}
                className="w-full"
              >
                {sending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Enviando...</>
                ) : (
                  'Enviar sugestão'
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
