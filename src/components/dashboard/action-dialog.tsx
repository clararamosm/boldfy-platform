// src/components/dashboard/action-dialog.tsx
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
  actionText?: string;
  onAction?: () => void;
  showCancel?: boolean;
  className?: string;
  secondaryAction?: React.ReactNode;
  formId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

// This component shows the pending state for form submissions.
// It must be a child of the <form> it is associated with.
const FormSubmitButton = ({ text, formId }: { text: string, formId: string }) => {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" form={formId} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {text}
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
  open,
  onOpenChange,
}: ActionDialogProps) {

  const renderFooterAction = () => {
    if (formId) {
      // The button needs to be associated with the form.
      // We pass the formId to the button's `form` attribute.
      // useFormStatus only works on children of the form, so we must use it inside the form.
      // This button is rendered in the footer, but the form is in the children.
      // We rely on the form having a submit button inside it that will show pending state.
      // So here we create a simple button that just triggers the form submission.
      return <Button type="submit" form={formId}>{actionText}</Button>;
    }
    // Fallback for non-form actions, which can close the dialog on click.
    return (
      <DialogClose asChild>
        <Button onClick={onAction}>{actionText}</Button>
      </DialogClose>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className={cn("sm:max-w-xl", className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        
        {/* If a formId is provided, wrap children in a form that submits to the footer button */}
        {formId ? (
            <div className="grid gap-4 py-4">
                {children}
            </div>
        ) : (
            <div className="grid gap-4 py-4">{children}</div>
        )}

        <DialogFooter>
          {showCancel && <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>}
          {secondaryAction}
          {onAction && !formId && <Button onClick={onAction}>{actionText}</Button>}
          {formId && <Button type="submit" form={formId}>{actionText}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
