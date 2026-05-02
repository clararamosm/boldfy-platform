
'use client';

import { useEffect, useRef, useState } from 'react';
import { getAuthToken } from '@/lib/auth-client';
import { generateHooks, generateWithHook } from '@/app/actions';
import { completeOnboardingItem } from '@/hooks/use-onboarding';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2, ClipboardCopy, Check, ThumbsUp, MessageSquare, Repeat2, Send, ArrowRight, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLocale } from '@/lib/i18n/context';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Skeleton } from './ui/skeleton';
import { useRouter } from 'next/navigation';

// ─── Loading messages ──────────────────────
const HOOK_LOADING_MESSAGES = [
  'Lendo seu contexto de marca...',
  'Analisando seu tom de voz...',
  'Criando opções de hook...',
];

const POST_LOADING_MESSAGES = [
  'Desenvolvendo o post com seu hook...',
  'Aplicando as melhores práticas...',
  'Criando uma legenda alinhada...',
  'Finalizando os ajustes...',
];

// ─── User profile info type ─────────────────────────────────────
type UserProfile = {
  name?: string;
  avatarUrl?: string;
  headline?: string;
};

// ─── Step type ──────────────────────────────────────────────────
type Step = 'input' | 'hooks' | 'result';

function LinkedInMockup({ content, onUseLegenda, userProfile }: { content: string; onUseLegenda: () => void; userProfile?: UserProfile }) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const isLong = content.length > 300;
  const [expanded, setExpanded] = useState(false);
  const displayText = isLong && !expanded ? content.slice(0, 280) + '...' : content;

  const userName = userProfile?.name || '';
  const userInitials = userName
    ? userName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '';

  return (
    <div className="space-y-4">
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

// ─── Hook Selection Card ─────────────────────────────────────
function HookCard({ hook, index, onSelect, disabled }: { hook: string; index: number; onSelect: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className="text-left w-full p-4 rounded-lg border-2 border-muted bg-card hover:border-primary/50 hover:bg-accent/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
    >
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          {index + 1}
        </span>
        <p className="text-sm whitespace-pre-line leading-relaxed text-foreground">
          {hook}
        </p>
      </div>
    </button>
  );
}

// ─── Loading Button ─────────────────────────────────────
function LoadingButton({ loading, messages, onClick, label, icon: Icon }: {
  loading: boolean;
  messages: string[];
  onClick?: () => void;
  label: string;
  icon: React.ElementType;
}) {
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    if (!loading) {
      setMsgIdx(0);
      return;
    }
    const interval = setInterval(() => {
      setMsgIdx(prev => (prev + 1) % messages.length);
    }, 1500);
    return () => clearInterval(interval);
  }, [loading, messages]);

  return (
    <div className="relative">
      {loading && (
        <div className="absolute -inset-[2px] rounded-lg bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 opacity-75 animate-pulse blur-[2px]" />
      )}
      <Button
        type={onClick ? 'button' : 'submit'}
        onClick={onClick}
        disabled={loading}
        className="w-full relative overflow-hidden"
      >
        {loading ? (
          <span className="flex items-center gap-2 animate-fade-in" key={msgIdx}>
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            <span className="truncate">{messages[msgIdx]}</span>
          </span>
        ) : (
          <>
            <Icon className="mr-2 h-4 w-4" />
            {label}
          </>
        )}
      </Button>
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
  const { toast } = useToast();
  const locale = useLocale();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  // Flow state
  const [step, setStep] = useState<Step>('input');
  const [hooks, setHooks] = useState<string[]>([]);
  const [selectedHook, setSelectedHook] = useState<string | null>(null);
  const [finalContent, setFinalContent] = useState<string | null>(null);

  // Loading states
  const [isGeneratingHooks, setIsGeneratingHooks] = useState(false);
  const [isGeneratingPost, setIsGeneratingPost] = useState(false);

  // Form values (persisted across steps)
  const [content, setContent] = useState('');
  const [format, setFormat] = useState('linkedin');
  const [length, setLength] = useState('medium');

  // Fill textarea when external content changes (e.g. hot topic selected)
  useEffect(() => {
    if (externalContent) {
      setContent(externalContent);
      if (textareaRef.current) {
        textareaRef.current.value = externalContent;
        textareaRef.current.focus();
      }
    }
  }, [externalContent]);

  // ─── Step 1: Generate Hooks ───────────────────────────────
  const handleGenerateHooks = async () => {
    const currentContent = textareaRef.current?.value || content;
    if (!currentContent.trim()) {
      toast({ variant: 'destructive', title: 'Escreva sua ideia', description: 'O campo de ideia não pode estar vazio.' });
      return;
    }

    setContent(currentContent);
    setSelectedHook(null);
    setFinalContent(null);
    setHooks([]);
    setIsGeneratingHooks(true);

    try {
      const token = await getAuthToken();
      const result = await generateHooks({
        idToken: token,
        content: currentContent,
        companyId,
        userId,
        format: format as 'linkedin' | 'text-heavy' | 'hybrid',
        length: length as 'short' | 'medium' | 'long',
        locale,
      });

      if (result.error) {
        toast({ variant: 'destructive', title: 'Erro ao gerar hooks', description: result.error });
        return;
      }

      if (result.hooks && result.hooks.length > 0) {
        setHooks(result.hooks);
        setStep('hooks');
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erro de autenticação', description: 'Faça login novamente para continuar.' });
    } finally {
      setIsGeneratingHooks(false);
    }
  };

  // ─── Step 2: Generate Full Post with Selected Hook ─────────
  const handleSelectHook = async (hook: string) => {
    setSelectedHook(hook);
    setIsGeneratingPost(true);

    try {
      const token = await getAuthToken();
      const result = await generateWithHook({
        idToken: token,
        content,
        selectedHook: hook,
        companyId,
        userId,
        format: format as 'linkedin' | 'text-heavy' | 'hybrid',
        length: length as 'short' | 'medium' | 'long',
        locale,
      });

      if (result.error) {
        toast({ variant: 'destructive', title: 'Erro ao gerar post', description: result.error });
        setIsGeneratingPost(false);
        return;
      }

      if (result.alignedContent) {
        setFinalContent(result.alignedContent);
        setStep('result');
        // Auto-complete onboarding item: "Usar uma ideia de conteúdo"
        completeOnboardingItem(userId, 'use-content-idea');
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erro de autenticação', description: 'Faça login novamente para continuar.' });
    } finally {
      setIsGeneratingPost(false);
    }
  };

  // ─── Navigation ───────────────────────────────────────────
  const handleRegenerateHooks = async () => {
    setHooks([]);
    setIsGeneratingHooks(true);

    try {
      const token = await getAuthToken();
      const result = await generateHooks({
        idToken: token,
        content,
        companyId,
        userId,
        format: format as 'linkedin' | 'text-heavy' | 'hybrid',
        length: length as 'short' | 'medium' | 'long',
        locale,
      });

      if (result.error) {
        toast({ variant: 'destructive', title: 'Erro ao gerar hooks', description: result.error });
        return;
      }

      if (result.hooks && result.hooks.length > 0) {
        setHooks(result.hooks);
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Tente novamente.' });
    } finally {
      setIsGeneratingHooks(false);
    }
  };

  const handleUseLegenda = () => {
    if (finalContent) {
      const params = new URLSearchParams({ caption: finalContent });
      router.push(`/colaborador/calendario/novo?${params.toString()}`);
    }
  };

  const isEditorDisabled = isGeneratingHooks || isGeneratingPost;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* LEFT SIDE — Editor always visible + hooks/result below */}
      <div className="space-y-4">
        {/* Editor Card — always visible */}
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-lg">Crie sua legenda</CardTitle>
            <CardDescription>
              Escreva sua ideia e nossa IA irá sugerir hooks para você escolher antes de gerar o post completo.
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
                defaultValue={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={isEditorDisabled}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2.5">
                <Label className="text-xs font-medium">Formato</Label>
                <RadioGroup value={format} onValueChange={setFormat} className="gap-1.5" disabled={isEditorDisabled}>
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
                <RadioGroup value={length} onValueChange={setLength} className="gap-1.5" disabled={isEditorDisabled}>
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

            <LoadingButton
              loading={isGeneratingHooks}
              messages={HOOK_LOADING_MESSAGES}
              onClick={handleGenerateHooks}
              label="Gerar Legenda"
              icon={Sparkles}
            />

            {/* Selected hook indicator — shown after post is generated */}
            {step === 'result' && selectedHook && (
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-xs text-muted-foreground mb-1">Hook selecionado:</p>
                <p className="text-sm whitespace-pre-line">{selectedHook}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hook Selection — appears below editor */}
        {step === 'hooks' && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-headline text-base">Escolha seu hook</CardTitle>
              <CardDescription>
                Selecione a abertura que mais combina com você. O post será gerado a partir dela.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isGeneratingHooks ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="p-4 rounded-lg border-2 border-muted">
                      <div className="flex items-start gap-3">
                        <Skeleton className="w-7 h-7 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-3/4" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {hooks.map((hook, idx) => (
                    <HookCard
                      key={idx}
                      hook={hook}
                      index={idx}
                      onSelect={() => handleSelectHook(hook)}
                      disabled={isGeneratingPost}
                    />
                  ))}

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRegenerateHooks}
                    disabled={isGeneratingPost}
                    className="w-full text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw className="mr-2 h-3.5 w-3.5" />
                    Gerar outros hooks
                  </Button>
                </>
              )}

              {isGeneratingPost && (
                <div className="mt-2">
                  <LoadingButton
                    loading={true}
                    messages={POST_LOADING_MESSAGES}
                    label=""
                    icon={Loader2}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* RIGHT SIDE — Preview */}
      <div className="lg:sticky lg:top-6">
        {finalContent ? (
          <LinkedInMockup
            content={finalContent}
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
                {step === 'hooks'
                  ? 'Selecione um hook para gerar o post completo'
                  : 'Gere uma legenda para ver como ficará no LinkedIn'
                }
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
