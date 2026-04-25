// src/components/admin/ban-link-dialog.tsx
'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { reportActionError } from '@/lib/browser-logger';
import type { LinkResponse } from '@/types/links.types';

interface BanLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  link: LinkResponse | null;
  onConfirm: (reason: string) => Promise<void>;
}

export function BanLinkDialog({
  open,
  onOpenChange,
  link,
  onConfirm
}: BanLinkDialogProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!reason.trim()) return;

    setIsSubmitting(true);
    try {
      await onConfirm(reason);
      setReason('');
      onOpenChange(false);
    } catch (error) {
      reportActionError(error, {
        action: 'admin-ban-link',
        linkId: link?.id ?? null
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Banir Link</AlertDialogTitle>
          <AlertDialogDescription>
            Você está prestes a banir o link{' '}
            <span className="font-mono font-semibold">{link?.shortCode}</span>.
            Esta ação bloqueará todo acesso a este link.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-4">
          <Label htmlFor="ban-reason">Motivo do banimento *</Label>
          <Textarea
            id="ban-reason"
            placeholder="Ex: Spam, phishing, conteúdo malicioso..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            className="resize-none"
            required
            aria-required="true"
          />
          <p className="text-xs text-muted-foreground">
            Este motivo será registrado nos logs de auditoria.
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={!reason.trim() || isSubmitting}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isSubmitting ? 'Banindo...' : 'Banir Link'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
