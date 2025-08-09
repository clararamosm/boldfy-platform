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
  actionText: string;
  onAction?: () => void; // Kept for non-form actions
  showCancel?: boolean;
  className?: string;
  secondaryAction?: React.ReactNode;
  formId?: string; // The ID of the form this dialog should trigger
  open?: boolean; // Control dialog visibility from parent
  onOpenChange?: (open: boolean) => void; // Control dialog visibility from parent
};

// This button is specifically for the primary action in the footer.
// It will show a pending state if its parent form is submitting.
const PrimaryActionButton = ({ text }: { text: string }) => {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
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

  // This wrapper allows the primary action button to be part of the form's context
  // even though it's rendered in the DialogFooter outside of the <form> element.
  // This is how `useFormStatus` gets the correct pending state.
  const renderFooterAction = () => {
    if (formId) {
      return (
        <form action={onAction as any}>
          <PrimaryActionButton text={actionText} />
        </form>
      );
    }
    // Fallback for non-form actions
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
        <div className="grid gap-4 py-4">{children}</div>
        <DialogFooter>
          {showCancel && <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>}
          {secondaryAction}
          {/* We now submit the form using its ID, which is the standard HTML5 way */}
          <Button type="submit" form={formId}>
              {actionText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
