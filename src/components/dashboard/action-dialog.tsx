'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '../ui/button';
import React from 'react';
import { cn } from '@/lib/utils';
import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';

type ActionDialogProps = {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  actionText: string;
  onAction?: () => void;
  showCancel?: boolean;
  className?: string;
  secondaryAction?: React.ReactNode;
  formId?: string;
};

const ActionButton = ({ formId, onAction, actionText }: Pick<ActionDialogProps, 'formId' | 'onAction' | 'actionText'>) => {
    const { pending } = useFormStatus();
    
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (!formId && onAction) {
            e.preventDefault();
            onAction();
        }
    }

    // if it's a form submission, the button's behavior is handled by the form.
    // The `pending` state from useFormStatus will apply.
    return (
        <Button form={formId} type={formId ? 'submit' : 'button'} onClick={onAction ? handleClick : undefined} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {actionText}
        </Button>
    )
}

export function ActionDialog({
  trigger,
  title,
  description,
  children,
  actionText,
  onAction,
  showCancel = true,
  className,
  secondaryAction,
  formId,
}: ActionDialogProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    
    // We need to wrap the ActionButton in a form context if formId is present.
    // This is because useFormStatus can only be used inside a <form>.
    // The dialog content itself might not be inside the form, so we create a small form here.
    const renderActionButton = () => {
      const button = <ActionButton formId={formId} onAction={onAction} actionText={actionText} />;
      
      // If a formId is provided, ActionButton expects to be inside a <form>
      // so that useFormStatus can work. Since the DialogFooter is outside the form
      // defined in the children, we can wrap the button in a dummy form if needed.
      if (formId) {
        return <form action={onAction as any}>{button}</form>
      }

      // If no formId, no form context is needed.
      return <DialogClose asChild>{button}</DialogClose>
    };

    const handleActionClick = () => {
        if(onAction) onAction();
        if(!formId) setIsOpen(false); // Only close if not a form action
    }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className={cn("sm:max-w-xl", className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="grid gap-4 py-4">{children}</div>
        <DialogFooter>
            {showCancel && <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>}
            {secondaryAction}
            <Button onClick={handleActionClick} form={formId} type={formId ? 'submit' : 'button'}>
              {actionText}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
