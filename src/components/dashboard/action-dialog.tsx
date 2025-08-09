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
};

export function ActionDialog({
  trigger,
  title,
  description,
  children,
  actionText,
  onAction,
  showCancel = true,
  className
}: ActionDialogProps) {
    const [isOpen, setIsOpen] = React.useState(false);

    const handleAction = () => {
        if (onAction) {
            onAction();
        }
        setIsOpen(false);
    }

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
            <Button onClick={handleAction}>{actionText}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    