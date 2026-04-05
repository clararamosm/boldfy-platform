
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
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Skeleton } from './ui/skeleton';
import { useRouter } from 'next/navigation';

const initialState = {
  alignedContent: null,
  error: null,
};

// ─── Loading messages for the generate button ──────────────────────
const LOADING_MESSAGES = [
  'Lendo seu contexto de marca...',
  'Entendendo o posicionamento da empresa...',
  'Analisando seu tom de voz...',
  'Criando uma legenda alinhada...',
  'Aplicando as melhores práticas...',
  'Finalizando os ajustes...',
];

function SubmitButton() {
  const { pending } = useFormStatus();
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    if (!pending) {
      setMsgIdx(0);
      return;
    }
    const interval = setInterval(() => {
      setMsgIdx(prev => (prev + 1) % LOADING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [pending]);

  return (
    <Button type="submit" disabled={pending} className="w-full relative overflow-hidden">
      {pending ? (
        <span className="flex items-center gap-2 animate-fade-in" key={msgIdx}>
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <span className="truncate">{LOADING_MESSAGES[msgIdx]}</span>
        </span>
      ) : (
        <>
          <Sparkles className="mr-2 h-4 w-4" />
          Gerar Legenda
        </>
      )}
    </Button>
  );
}

// ─── User profile info type ─────────────────────────────────────
type UserProfile = {
  name?: string;
  avatarUrl?: string;
  headline?: string; // cargo / position from personal branding
};

function LinkedInMockup({ content, onUseLegenda, userProfile }: { content: string; onUseLegenda: () => void; userProfile?: UserProfile }) {
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

  const userName = userProfile?.name || '';
  const userInitials = userName
    ? userName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '';

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-muted-foreground mb-2">Preview do Post</div>

      {/* LinkedIn Post Mockup */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-4 pb-2">
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12 border-2 border-muted">
              {userProfile?.avatarUrl ? (
                <AvatarImage src={userProfile.avatarUrl} alt={userName} />
              ) : null}
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-700 text-white text-sm font-bold">
                {userInitials || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              {userName ? (
                <p className="font-semibold text-sm text-foreground">{userName}</p>
              ) : (
                <Skeleton className="h-4 w-32" />
              )}
              {userProfile?.headline ? (
                <p className="text-xs text-muted-foreground truncate">{userProfile.headline}</p>
              ) : (
                <Skeleton className="h-3 w-48 mt-1" />
              )}
              <p className="text-xs text-muted-foreground mt-0.5">Agora · 🌐</p>
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

// ─── Pulsing border wrapper ─────────────────────────────────────
function PulsingCard({ isPulsing, children }: { isPulsing: boolean; children: React.ReactNode }) {
  if (!isPulsing) {
    return <Card>{children}</Card>;
  }
  return (
    <div className="relative rounded-xl">
      {/* Animated border glow */}
      <div className="absolute -inset-[2px] rounded-xl bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 opacity-75 animate-pulse blur-[2px]" />
      <Card className="relative bg-background">
        {children}
      </Card>
    </div>
  );
}

export function AiAssistantForm({
  companyId,
  userId = "user-123",
  externalContent,
  userProfile,
}: {
  companyId: string;
  userId?: string;
  externalContent?: string;
  userProfile?: UserProfile;
}) {
  const [state, formAction] = useActionState(handleAlignContent, initialState);
  const { toast } = useToast();
  const tokenRef = useRef('');
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  // Track state changes with a counter to detect repeated identical results
  const stateVersionRef = useRef(0);

  // Fill textarea when external content changes (e.g. hot topic selected)
  useEffect(() => {
    if (externalContent && textareaRef.current) {
      textareaRef.current.value = externalContent;
      textareaRef.current.focus();
    }
  }, [externalContent]);

  // Pre-fetch token on mount (will be refreshed on submit)
  useEffect(() => {
    getAuthToken().then(t => { tokenRef.current = t; }).catch(() => {});
  }, []);

  // Handle state changes from server action
  useEffect(() => {
    // Skip initial render
    if (!state?.error && !state?.alignedContent) return;

    stateVersionRef.current += 1;

    if (state?.error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar legenda',
        description: state.error,
      });
    }
    setIsGenerating(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const handleUseLegenda = () => {
    if (state?.alignedContent) {
      const params = new URLSearchParams({ caption: state.alignedContent });
      router.push(`/colaborador/calendario/novo?${params.toString()}`);
    }
  };

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        setIsGenerating(true);
        // Always get a fresh token before submitting
        try {
          const freshToken = await getAuthToken();
          tokenRef.current = freshToken;
          formData.set('idToken', freshToken);
        } catch {
          toast({
            variant: 'destructive',
            title: 'Erro de autenticação',
            description: 'Faça login novamente para continuar.',
          });
          setIsGenerating(false);
          return;
        }
        formAction(formData);
      }}
    >
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="idToken" value="" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* LEFT SIDE — Input */}
        <PulsingCard isPulsing={isGenerating}>
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
        </PulsingCard>

        {/* RIGHT SIDE — Preview */}
        <div className="lg:sticky lg:top-6">
          {state?.alignedContent ? (
            <LinkedInMockup
              content={state.alignedContent}
              onUseLegenda={handleUseLegenda}
              userProfile={userProfile}
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
