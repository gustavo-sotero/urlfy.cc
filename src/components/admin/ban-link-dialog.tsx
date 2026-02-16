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
      console.error('Failed to ban link:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ban Link</AlertDialogTitle>
          <AlertDialogDescription>
            You are about to ban the link{' '}
            <span className="font-mono font-semibold">{link?.shortCode}</span>.
            This action will block all access to this link.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-4">
          <Label htmlFor="ban-reason">Ban reason *</Label>
          <Textarea
            id="ban-reason"
            placeholder="e.g. Spam, phishing, malicious content..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            className="resize-none"
            required
            aria-required="true"
          />
          <p className="text-xs text-muted-foreground">
            This reason will be recorded in the audit logs.
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={!reason.trim() || isSubmitting}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isSubmitting ? 'Banning...' : 'Ban Link'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
