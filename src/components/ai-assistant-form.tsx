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
            Insira seu texto abaixo e nossa IA irá refiná-lo para garantir que ele esteja perfeitamente
            alinhado com o tom e a voz da nossa marca.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
          <div className="grid w-full gap-1.5">
            <Label htmlFor="aligned-content">Conteúdo Refinado pela IA</Label>
            <Textarea
              id="aligned-content"
              name="aligned-content"
              placeholder="O resultado da IA aparecerá aqui..."
              readOnly
              value={state?.alignedContent || ''}
              rows={8}
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
