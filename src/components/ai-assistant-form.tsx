
'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { handleAlignContent } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2, ClipboardCopy, Check, Linkedin, ExternalLink, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { publishToLinkedIn, getLinkedInStatus } from '@/app/actions/linkedin';
import { Badge } from './ui/badge';
import Link from 'next/link';

const initialState = {
  alignedContent: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Refinando...
        </>
      ) : (
        <>
          <Sparkles className="mr-2 h-4 w-4" />
          Refinar Conteúdo
        </>
      )}
    </Button>
  );
}

export function AiAssistantForm({ companyId, userId = "user-123" }: { companyId: string, userId?: string }) {
  const [state, formAction] = useActionState(handleAlignContent, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [linkedinStatus, setLinkedinStatus] = useState<{
    connected: boolean;
    name?: string;
    tokenValid?: boolean;
  }>({ connected: false });

  useEffect(() => {
    if (userId && userId !== 'user-123') {
      getLinkedInStatus(userId).then(setLinkedinStatus);
    }
  }, [userId]);

  useEffect(() => {
    if (state?.error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao refinar conteúdo',
        description: state.error,
      });
    }
    if (state?.alignedContent) {
      setPublishedUrl(null);
    }
  }, [state, toast]);

  const handleCopy = () => {
    if (state?.alignedContent) {
      navigator.clipboard.writeText(state.alignedContent);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handlePublish = async () => {
    if (!state?.alignedContent) return;
    setIsPublishing(true);
    try {
      const result = await publishToLinkedIn(userId, state.alignedContent);
      if (result.error) {
        toast({ variant: 'destructive', title: 'Erro ao publicar', description: result.error });
        if (result.needsReconnect) {
          setLinkedinStatus(prev => ({ ...prev, connected: false }));
        }
      } else if (result.success) {
        setPublishedUrl(result.postUrl || null);
        toast({ title: 'Publicado no LinkedIn!', description: 'Seu conteúdo foi publicado com sucesso.' });
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível publicar no LinkedIn.' });
    }
    setIsPublishing(false);
  };

  return (
    <form ref={formRef} action={formAction}>
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="userId" value={userId} />
      <Card className="mx-auto max-w-3xl">
        <CardHeader>
          <CardTitle className="font-headline">Alinhe seu conteúdo com a marca</CardTitle>
          <CardDescription>
            Insira seu texto, escolha o formato e o tamanho, e nossa IA irá refiná-lo para garantir que ele esteja perfeitamente
            alinhado com o tom da marca e com sua voz pessoal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid w-full gap-1.5">
            <Label htmlFor="content">Seu Conteúdo</Label>
            <Textarea
              placeholder="Escreva sua ideia de post aqui..."
              id="content"
              name="content"
              rows={6}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label>Formato do Conteúdo</Label>
              <RadioGroup name="format" defaultValue="linkedin" className="gap-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="linkedin" id="format-linkedin" />
                  <Label htmlFor="format-linkedin" className="font-normal">LinkedIn</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="text-heavy" id="format-text-heavy" />
                  <Label htmlFor="format-text-heavy" className="font-normal">Texto Denso</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="hybrid" id="format-hybrid" />
                  <Label htmlFor="format-hybrid" className="font-normal">Híbrido</Label>
                </div>
              </RadioGroup>
            </div>
             <div className="space-y-3">
              <Label>Tamanho do Conteúdo</Label>
              <RadioGroup name="length" defaultValue="medium" className="gap-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="short" id="length-short" />
                  <Label htmlFor="length-short" className="font-normal">Curto</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="medium" id="length-medium" />
                  <Label htmlFor="length-medium" className="font-normal">Médio</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="long" id="length-long" />
                  <Label htmlFor="length-long" className="font-normal">Longo</Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <div className="flex justify-end">
            <SubmitButton />
          </div>

          <div className="grid w-full gap-1.5 relative">
            <Label htmlFor="aligned-content">Conteúdo Refinado pela IA</Label>
            <Textarea
              id="aligned-content"
              name="aligned-content"
              placeholder="O resultado da IA aparecerá aqui..."
              readOnly
              value={state?.alignedContent || ''}
              rows={12}
              className="bg-muted focus-visible:ring-0 pr-10"
            />
             {state?.alignedContent && (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-7 right-1 h-8 w-8 text-muted-foreground"
                    onClick={handleCopy}
                >
                    {isCopied ? <Check className="h-4 w-4 text-primary" /> : <ClipboardCopy className="h-4 w-4" />}
                    <span className="sr-only">Copiar texto</span>
                </Button>
            )}
          </div>

          {/* LinkedIn Publish Section */}
          {state?.alignedContent && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Linkedin className="h-5 w-5 text-[#0A66C2]" />
                  <span className="font-medium text-sm">Publicar no LinkedIn</span>
                </div>
                {linkedinStatus.connected ? (
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs">
                    {linkedinStatus.name || 'Conectado'}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">Não conectado</Badge>
                )}
              </div>

              {publishedUrl ? (
                <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/10 rounded-md p-3">
                  <Check className="h-4 w-4 flex-shrink-0" />
                  <span>Publicado com sucesso!</span>
                  <a href={publishedUrl} target="_blank" rel="noopener noreferrer"
                    className="ml-auto flex items-center gap-1 text-[#0A66C2] hover:underline font-medium">
                    Ver post <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ) : linkedinStatus.connected && linkedinStatus.tokenValid ? (
                <Button type="button" onClick={handlePublish} disabled={isPublishing}
                  className="w-full bg-[#0A66C2] hover:bg-[#004182] text-white">
                  {isPublishing ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publicando...</>
                  ) : (
                    <><Linkedin className="mr-2 h-4 w-4" /> Publicar no LinkedIn</>
                  )}
                </Button>
              ) : (
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>{linkedinStatus.connected
                    ? 'Seu token expirou. Reconecte nas configurações.'
                    : 'Conecte sua conta do LinkedIn para publicar diretamente.'}</p>
                  <Button type="button" variant="outline" size="sm" asChild>
                    <Link href="/colaborador/configuracoes">
                      <Settings className="mr-2 h-4 w-4" /> Ir para Configurações
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </form>
  );
}
