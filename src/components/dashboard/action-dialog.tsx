'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '../ui/button';

type ActionDialogProps = {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  actionText: string;
  onAction?: () => void;
};

export function ActionDialog({
  trigger,
  title,
  description,
  children,
  actionText,
  onAction,
}: ActionDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="grid gap-4 py-4">{children}</div>
        <DialogFooter>
          <Button onClick={onAction}>{actionText}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
