/**
 * ═════════════════════════════════════════════════════════════════════
 * BACKUP CODES DISPLAY COMPONENT
 * ═════════════════════════════════════════════════════════════════════
 *
 * Displays backup codes for users who already have 2FA enabled.
 * Includes security verification and copy/download functionality.
 *
 * Module: Authentication & Identity (Module 2)
 * Spec: plan-twoFactorAuth.prompt.md
 * ═════════════════════════════════════════════════════════════════════
 */

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Copy, Download, Eye, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { AccessibleFormField } from '@/components/forms/accessible-form-field';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth.client';

// ═══════════════════════════════════════════════════════════════════
// TYPES & SCHEMAS
// ═══════════════════════════════════════════════════════════════════

function createPasswordSchema(passwordMsg: string, codeMsg: string) {
  return z.object({
    password: z.string().min(1, passwordMsg),
    totpCode: z.string().length(6, codeMsg)
  });
}

type PasswordFormData = z.infer<ReturnType<typeof createPasswordSchema>>;

interface BackupCodesProps {
  asDialog?: boolean;
}

type ViewState = 'password' | 'codes';

// ═══════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════

export function BackupCodes({ asDialog = true }: BackupCodesProps) {
  const t = useTranslations('TwoFactor.backupCodes');
  const [open, setOpen] = useState(false);
  const [viewState, setViewState] = useState<ViewState>('password');
  const [isLoading, setIsLoading] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const passwordSchema = createPasswordSchema(
    t('errors.passwordRequired'),
    t('errors.code6digits')
  );

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '', totpCode: '' }
  });

  // ═══════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════

  const handlePasswordSubmit = async (data: PasswordFormData) => {
    setIsLoading(true);
    try {
      // First verify TOTP code to ensure user has access to authenticator device
      const verifyResult = await authClient.twoFactor.verifyTotp({
        code: data.totpCode
      });

      if (!verifyResult.data) {
        toast.error(t('errors.invalidAuth'));
        return;
      }

      // Note: Better-Auth regenerates backup codes on each call
      // This is a security feature to prevent exposure of existing codes
      const result = await authClient.twoFactor.generateBackupCodes({
        password: data.password
      });

      if (result.data?.backupCodes) {
        setBackupCodes(result.data.backupCodes);
        setViewState('codes');
      } else {
        toast.error(t('errors.generateFailed'));
      }
    } catch (error) {
      console.error('Generate backup codes error:', error);
      toast.error(
        error instanceof Error ? error.message : t('errors.authFailed')
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'));
      setCopied(true);
      toast.success(t('success.codesCopied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('errors.copyError'));
    }
  };

  const handleDownload = () => {
    const blob = new Blob([backupCodes.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'urlfy-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(t('success.codesDownloaded'));
  };

  const handleClose = () => {
    setOpen(false);
    // Reset state after dialog closes
    setTimeout(() => {
      setViewState('password');
      setBackupCodes([]);
      setCopied(false);
      passwordForm.reset();
    }, 300);
  };

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  const content = (
    <>
      {/* PASSWORD VERIFICATION */}
      {viewState === 'password' && (
        <>
          <DialogHeader>
            <DialogTitle>{t('generateTitle')}</DialogTitle>
            <DialogDescription>{t('generateDescription')}</DialogDescription>
          </DialogHeader>

          <form
            onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)}
            className="space-y-4"
          >
            <AccessibleFormField
              id="password"
              label={t('passwordLabel')}
              required
              error={passwordForm.formState.errors.password?.message}
            >
              <Input
                id="password"
                type="password"
                placeholder={t('passwordPlaceholder')}
                {...passwordForm.register('password')}
                disabled={isLoading}
                autoComplete="current-password"
              />
            </AccessibleFormField>

            <AccessibleFormField
              id="totpCode"
              label={t('authCodeLabel')}
              required
              error={passwordForm.formState.errors.totpCode?.message}
            >
              <Input
                id="totpCode"
                type="text"
                placeholder="000000"
                maxLength={6}
                pattern="[0-9]{6}"
                {...passwordForm.register('totpCode')}
                disabled={isLoading}
                autoComplete="off"
                className="text-center font-mono text-lg tracking-wider"
              />
            </AccessibleFormField>

            <DialogFooter>
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('generating')}
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    {t('generateButton')}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </>
      )}

      {/* BACKUP CODES DISPLAY */}
      {viewState === 'codes' && (
        <>
          <DialogHeader>
            <DialogTitle>{t('codesTitle')}</DialogTitle>
            <DialogDescription>{t('codesDescription')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Codes Grid */}
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-4">
              {backupCodes.map((code) => (
                <code
                  key={code}
                  className="rounded bg-background px-2 py-1 text-center text-sm font-mono"
                >
                  {code}
                </code>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCopy} className="flex-1">
                {copied ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {t('copied')}
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    {t('copy')}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleDownload}
                className="flex-1"
              >
                <Download className="mr-2 h-4 w-4" />
                {t('download')}
              </Button>
            </div>

            <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 p-3">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {t('warning')}
              </p>
            </div>

            <Button
              onClick={handleClose}
              variant="secondary"
              className="w-full"
            >
              {t('close')}
            </Button>
          </div>
        </>
      )}
    </>
  );

  if (asDialog) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <Eye className="mr-2 h-4 w-4" />
            {t('generateNew')}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">{content}</DialogContent>
      </Dialog>
    );
  }

  return content;
}
