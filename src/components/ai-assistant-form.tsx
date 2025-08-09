'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { handleAlignContent } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';

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

export function AiAssistantForm({ companyId }: { companyId: string }) {
  const [state, formAction] = useFormState(handleAlignContent, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao refinar conteúdo',
        description: state.error,
      });
    }
  }, [state, toast]);

  return (
    <form ref={formRef} action={formAction}>
      <input type="hidden" name="companyId" value={companyId} />
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
                  <Label htmlFor="format-linkedin" className="font-normal">LinkedIn (com emojis e hashtags)</Label>
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

          <div className="grid w-full gap-1.5">
            <Label htmlFor="aligned-content">Conteúdo Refinado pela IA</Label>
            <Textarea
              id="aligned-content"
              name="aligned-content"
              placeholder="O resultado da IA aparecerá aqui..."
              readOnly
              value={state?.alignedContent || ''}
              rows={12}
              className="bg-muted focus-visible:ring-0"
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <SubmitButton />
        </CardFooter>
      </Card>
    </form>
  );
}
