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
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();
  const { user, firebaseUser } = useAuth();

  const handleSubmit = async () => {
    if (!titulo.trim()) {
      toast({ variant: 'destructive', title: 'Título obrigatório', description: 'Dê um título curto à sua sugestão.' });
      return;
    }
    if (!descricao.trim()) {
      toast({ variant: 'destructive', title: 'Descrição obrigatória', description: 'Escreva sua sugestão de trilha.' });
      return;
    }

    setSending(true);

    try {
      const idToken = await firebaseUser?.getIdToken();
      if (!idToken) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Sessão expirada. Faça login novamente.' });
        setSending(false);
        return;
      }

      const result = await sendFeedbackToNotion({
        idToken,
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
            setTitulo('');
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
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="trail-title" className="text-sm font-medium">Título</Label>
                <input
                  id="trail-title"
                  type="text"
                  placeholder="Ex: Trilha de carrosséis no LinkedIn"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="trail-suggestion" className="text-sm font-medium">Descrição</Label>
                <Textarea
                  id="trail-suggestion"
                  placeholder="Descreva o que você gostaria de aprender, quais habilidades, formatos..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={3}
                />
              </div>

              <Button
                onClick={handleSubmit}
                disabled={sending || !titulo.trim() || !descricao.trim()}
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
