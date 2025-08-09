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

type ActionDialogProps = {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  actionText: string;
  onAction?: () => void;
  showCancel?: boolean;
};

export function ActionDialog({
  trigger,
  title,
  description,
  children,
  actionText,
  onAction,
  showCancel = true,
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
      <DialogContent className="sm:max-w-[425px]">
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
