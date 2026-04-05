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
import { Headset, Loader2, ImagePlus, X, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sendSupportToNotion } from '@/app/actions/feedback';
import { useAuth } from '@/contexts/auth-context';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

type SupportDialogProps = {
  pagina?: string;
};

export function SupportDialog({ pagina = 'Suporte' }: SupportDialogProps) {
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const tipoConta: 'Admin' | 'Colaborador' =
    user?.role === 'admin' || user?.role === 'master' ? 'Admin' : 'Colaborador';

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
    if (!titulo.trim()) {
      toast({ variant: 'destructive', title: 'Assunto obrigatório', description: 'Dê um título ao seu pedido de suporte.' });
      return;
    }
    if (!descricao.trim()) {
      toast({ variant: 'destructive', title: 'Descrição obrigatória', description: 'Descreva o que precisa de ajuda.' });
      return;
    }

    setSending(true);

    try {
      let imageUrl: string | undefined;

      if (imageFile && user) {
        try {
          const storageRef = ref(storage, `users/${user.uid}/support/${Date.now()}_${imageFile.name}`);
          await uploadBytes(storageRef, imageFile);
          imageUrl = await getDownloadURL(storageRef);
        } catch (uploadErr) {
          console.error('Image upload error:', uploadErr);
        }
      }

      const result = await sendSupportToNotion({
        titulo,
        descricao,
        tipoConta,
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
          setTimeout(() => {
            setSent(false);
            setTitulo('');
            setDescricao('');
            removeImage();
          }, 300);
        }, 1500);
      } else {
        toast({ variant: 'destructive', title: 'Erro ao enviar', description: result.error });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível enviar o pedido de suporte.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Headset className="h-4 w-4" />
          Pedir Suporte
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {sent ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="font-semibold text-lg">Pedido enviado!</p>
            <p className="text-sm text-muted-foreground">Vamos analisar e retornar o mais rápido possível.</p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Headset className="h-5 w-5" />
                Pedir Suporte
              </DialogTitle>
              <DialogDescription>
                Precisa de ajuda? Descreva sua dúvida ou problema e nossa equipe vai te ajudar.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="support-title" className="text-sm font-medium">
                  Assunto
                </Label>
                <input
                  id="support-title"
                  type="text"
                  placeholder="Ex: Não consigo conectar meu LinkedIn"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="support-desc" className="text-sm font-medium">
                  Descrição
                </Label>
                <Textarea
                  id="support-desc"
                  placeholder="Descreva o que está acontecendo ou o que precisa de ajuda..."
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
                disabled={sending || !titulo.trim() || !descricao.trim()}
                className="w-full"
              >
                {sending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Enviando...</>
                ) : (
                  'Enviar pedido'
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
