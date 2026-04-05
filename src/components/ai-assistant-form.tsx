
'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { getAuthToken } from '@/lib/auth-client';
import { handleAlignContent } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2, ClipboardCopy, Check, ThumbsUp, MessageSquare, Repeat2, Send, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Avatar, AvatarFallback } from './ui/avatar';
import { useRouter } from 'next/navigation';

const initialState = {
  alignedContent: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Gerando legenda...
        </>
      ) : (
        <>
          <Sparkles className="mr-2 h-4 w-4" />
          Gerar Legenda
        </>
      )}
    </Button>
  );
}

function LinkedInMockup({ content, onUseLegenda }: { content: string; onUseLegenda: () => void }) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Truncate for "ver mais" effect
  const isLong = content.length > 300;
  const [expanded, setExpanded] = useState(false);
  const displayText = isLong && !expanded ? content.slice(0, 280) + '...' : content;

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-muted-foreground mb-2">Preview do Post</div>

      {/* LinkedIn Post Mockup */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-4 pb-2">
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12 border-2 border-muted">
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-700 text-white text-sm font-bold">
                VC
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground">Seu Nome</p>
              <p className="text-xs text-muted-foreground truncate">Sua headline profissional</p>
              <p className="text-xs text-muted-foreground">Agora · 🌐</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 pb-3">
          <p className="text-sm whitespace-pre-line leading-relaxed text-foreground">
            {displayText}
          </p>
          {isLong && !expanded && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="text-sm text-muted-foreground hover:text-foreground hover:underline mt-1"
            >
              ...ver mais
            </button>
          )}
        </div>

        {/* Image placeholder area */}
        <div className="bg-muted/50 border-y h-12 flex items-center justify-center">
          <p className="text-xs text-muted-foreground">Mídia será adicionada no editor</p>
        </div>

        {/* Reactions bar */}
        <div className="px-4 py-2 border-b flex items-center gap-1">
          <div className="flex -space-x-1">
            <span className="text-xs">👍</span>
            <span className="text-xs">❤️</span>
            <span className="text-xs">💡</span>
          </div>
          <span className="text-xs text-muted-foreground ml-1">Você e outras pessoas</span>
        </div>

        {/* Action buttons */}
        <div className="px-2 py-1 flex justify-between">
          {[
            { icon: ThumbsUp, label: 'Gostei' },
            { icon: MessageSquare, label: 'Comentar' },
            { icon: Repeat2, label: 'Repostar' },
            { icon: Send, label: 'Enviar' },
          ].map(({ icon: Icon, label }) => (
            <button
              key={label}
              type="button"
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-muted-foreground text-xs hover:bg-muted/50 transition-colors"
              disabled
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="flex-1"
        >
          {isCopied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <ClipboardCopy className="mr-1.5 h-3.5 w-3.5" />}
          {isCopied ? 'Copiado!' : 'Copiar legenda'}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onUseLegenda}
          className="flex-1 bg-[#0A66C2] hover:bg-[#004182] text-white"
        >
          Usar legenda
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function AiAssistantForm({ companyId, userId = "user-123", externalContent }: { companyId: string, userId?: string, externalContent?: string }) {
  const [state, formAction] = useActionState(handleAlignContent, initialState);
  const { toast } = useToast();
  const [cachedToken, setCachedToken] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  // Fill textarea when external content changes (e.g. hot topic selected)
  useEffect(() => {
    if (externalContent && textareaRef.current) {
      textareaRef.current.value = externalContent;
      textareaRef.current.focus();
    }
  }, [externalContent]);

  useEffect(() => {
    getAuthToken().then(setCachedToken).catch(() => {});
  }, []);

  useEffect(() => {
    if (state?.error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar legenda',
        description: state.error,
      });
    }
  }, [state, toast]);

  const handleUseLegenda = () => {
    if (state?.alignedContent) {
      // Encode caption and navigate to calendar editor
      const params = new URLSearchParams({ caption: state.alignedContent });
      router.push(`/colaborador/calendario/novo?${params.toString()}`);
    }
  };

  return (
    <form ref={formRef} action={formAction}>
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="idToken" value={cachedToken} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* LEFT SIDE — Input */}
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-lg">Crie sua legenda</CardTitle>
            <CardDescription>
              Escreva sua ideia e nossa IA irá transformá-la em uma legenda alinhada com o tom da marca e sua voz pessoal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid w-full gap-1.5">
              <Label htmlFor="content">Sua ideia</Label>
              <Textarea
                ref={textareaRef}
                placeholder="Escreva sua ideia de post aqui..."
                id="content"
                name="content"
                rows={5}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2.5">
                <Label className="text-xs font-medium">Formato</Label>
                <RadioGroup name="format" defaultValue="linkedin" className="gap-1.5">
                  {[
                    { value: 'linkedin', label: 'LinkedIn' },
                    { value: 'text-heavy', label: 'Texto Denso' },
                    { value: 'hybrid', label: 'Híbrido' },
                  ].map(({ value, label }) => (
                    <div key={value} className="flex items-center space-x-2">
                      <RadioGroupItem value={value} id={`format-${value}`} />
                      <Label htmlFor={`format-${value}`} className="font-normal text-sm">{label}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
              <div className="space-y-2.5">
                <Label className="text-xs font-medium">Tamanho</Label>
                <RadioGroup name="length" defaultValue="medium" className="gap-1.5">
                  {[
                    { value: 'short', label: 'Curto' },
                    { value: 'medium', label: 'Médio' },
                    { value: 'long', label: 'Longo' },
                  ].map(({ value, label }) => (
                    <div key={value} className="flex items-center space-x-2">
                      <RadioGroupItem value={value} id={`length-${value}`} />
                      <Label htmlFor={`length-${value}`} className="font-normal text-sm">{label}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </div>

            <SubmitButton />
          </CardContent>
        </Card>

        {/* RIGHT SIDE — Preview */}
        <div className="lg:sticky lg:top-6">
          {state?.alignedContent ? (
            <LinkedInMockup
              content={state.alignedContent}
              onUseLegenda={handleUseLegenda}
            />
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <Sparkles className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="font-medium text-muted-foreground">Preview do seu post</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Gere uma legenda para ver como ficará no LinkedIn
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </form>
  );
}
