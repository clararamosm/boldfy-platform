'use client';

import { useState, useRef } from 'react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Bug, Loader2, ImagePlus, X, CheckCircle2, Lightbulb, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sendFeedbackToNotion } from '@/app/actions/feedback';
import { useAuth } from '@/contexts/auth-context';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

type FeedbackType = 'Bug' | 'Feedback';

type FeedbackDialogProps = {
  pagina?: string;
};

export function FeedbackDialog({ pagina = 'Sidebar' }: FeedbackDialogProps) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<FeedbackType>('Feedback');
  const [descricao, setDescricao] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Imagem muito grande', description: 'Máximo 5MB.' });
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!descricao.trim()) {
      toast({ variant: 'destructive', title: 'Descrição obrigatória', description: 'Escreva uma descrição do feedback ou bug.' });
      return;
    }

    setSending(true);

    try {
      let imageUrl: string | undefined;

      // Upload image to Firebase Storage if exists
      if (imageFile && user) {
        const storageRef = ref(storage, `feedback/${user.uid}/${Date.now()}_${imageFile.name}`);
        await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(storageRef);
      }

      // Generate a short title from description
      const titulo = tipo === 'Bug'
        ? `🐛 ${descricao.slice(0, 60)}${descricao.length > 60 ? '...' : ''}`
        : `💡 ${descricao.slice(0, 60)}${descricao.length > 60 ? '...' : ''}`;

      const result = await sendFeedbackToNotion({
        tipo,
        titulo,
        descricao,
        pagina,
        userName: user?.name,
        userEmail: user?.email,
        companyId: user?.companyId,
        imageUrl,
      });

      if (result.success) {
        setSent(true);
        setTimeout(() => {
          setOpen(false);
          // Reset after close animation
          setTimeout(() => {
            setSent(false);
            setDescricao('');
            setTipo('Feedback');
            removeImage();
          }, 300);
        }, 1500);
      } else {
        toast({ variant: 'destructive', title: 'Erro ao enviar', description: result.error });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível enviar o feedback.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="h-8 w-8 rounded-full border border-border bg-background hover:bg-muted flex items-center justify-center transition-colors"
          title="Reportar bug ou dar feedback"
        >
          <Bug className="h-4 w-4 text-muted-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {sent ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="font-semibold text-lg">Enviado com sucesso!</p>
            <p className="text-sm text-muted-foreground">Obrigado pelo seu feedback.</p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bug className="h-5 w-5" />
                Feedback & Bugs
              </DialogTitle>
              <DialogDescription>
                Encontrou um problema ou tem uma sugestão? Nos conte!
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              {/* Type selector */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tipo</Label>
                <RadioGroup
                  value={tipo}
                  onValueChange={(v) => setTipo(v as FeedbackType)}
                  className="flex gap-3"
                >
                  <label
                    htmlFor="tipo-feedback"
                    className={`flex-1 flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors
                      ${tipo === 'Feedback' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
                  >
                    <RadioGroupItem value="Feedback" id="tipo-feedback" />
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium">Feedback</span>
                  </label>
                  <label
                    htmlFor="tipo-bug"
                    className={`flex-1 flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors
                      ${tipo === 'Bug' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
                  >
                    <RadioGroupItem value="Bug" id="tipo-bug" />
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium">Bug</span>
                  </label>
                </RadioGroup>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="feedback-desc" className="text-sm font-medium">
                  {tipo === 'Bug' ? 'Descreva o bug' : 'Sua sugestão'}
                </Label>
                <Textarea
                  id="feedback-desc"
                  placeholder={tipo === 'Bug'
                    ? 'O que aconteceu? O que você esperava que acontecesse?'
                    : 'O que podemos melhorar? Tem alguma ideia?'
                  }
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={4}
                />
              </div>

              {/* Image upload */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Screenshot (opcional)</Label>
                {imagePreview ? (
                  <div className="relative rounded-lg border overflow-hidden">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full max-h-40 object-cover"
                    />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed rounded-lg p-4 flex items-center justify-center gap-2 text-muted-foreground hover:bg-muted/30 transition-colors"
                  >
                    <ImagePlus className="h-4 w-4" />
                    <span className="text-sm">Anexar imagem</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </div>

              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={sending || !descricao.trim()}
                className="w-full"
              >
                {sending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Enviando...</>
                ) : (
                  'Enviar'
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
