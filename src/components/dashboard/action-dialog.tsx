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
  formId?: string; // Add formId prop
};

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
  formId, // Destructure formId
}: ActionDialogProps) {
    const [isOpen, setIsOpen] = React.useState(false);

    const handleAction = () => {
        if (onAction) {
            onAction();
        }
        // Don't automatically close if it's a form submission, 
        // let the parent component handle closing on success.
        if (!formId) {
             setIsOpen(false);
        }
    }
    
    const actionButton = (
      <Button onClick={handleAction} form={formId} type={formId ? 'submit' : 'button'}>
        {actionText}
      </Button>
    );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild onClick={() => setIsOpen(true)}>{trigger}</DialogTrigger>
      <DialogContent className={cn("sm:max-w-xl", className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="grid gap-4 py-4">{children}</div>
        <DialogFooter>
            {showCancel && <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>}
            {secondaryAction}
            {onAction ? (
              actionButton
            ) : (
                <DialogClose asChild>
                  {actionButton}
                </DialogClose>
            )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
