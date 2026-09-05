/**
 * ═════════════════════════════════════════════════════════════════════
 * TWO-FACTOR AUTHENTICATION SETUP COMPONENT
 * ═════════════════════════════════════════════════════════════════════
 *
 * State machine for 2FA enrollment:
 * 1. Password Verification
 * 2. QR Code Display & Manual Secret
 * 3. Code Verification
 * 4. Backup Codes Display
 *
 * Module: Authentication & Identity (Module 2)
 * Spec: plan-twoFactorAuth.prompt.md
 * ═════════════════════════════════════════════════════════════════════
 */

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Copy, Download, Loader2, Shield } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import qrcode from 'qrcode';
import { useCallback, useState } from 'react';
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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot
} from '@/components/ui/input-otp';
import { authClient } from '@/lib/auth.client';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

type SetupStep = 'password' | 'qr' | 'verify' | 'backup';

type PasswordFormData = z.infer<ReturnType<typeof createPasswordSchema>>;

function createPasswordSchema(errorMsg: string) {
  return z.object({
    password: z.string().min(1, errorMsg)
  });
}

interface TwoFactorSetupProps {
  onSuccess: () => void;
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════

export function TwoFactorSetup({ onSuccess }: TwoFactorSetupProps) {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<SetupStep>('password');
  const [isLoading, setIsLoading] = useState(false);
  const t = useTranslations('TwoFactor.setup');

  // Step state
  const [totpSecret, setTotpSecret] = useState<string>('');
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedBackup, setCopiedBackup] = useState(false);

  const passwordSchema = createPasswordSchema(t('errors.passwordRequired'));
  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '' }
  });

  // ═══════════════════════════════════════════════════════════════════
  // STEP 1: PASSWORD VERIFICATION
  // ═══════════════════════════════════════════════════════════════════

  const handlePasswordSubmit = async (data: PasswordFormData) => {
    setIsLoading(true);
    try {
      const result = await authClient.twoFactor.enable({
        password: data.password
      });

      // better-auth >= 1.7 returns a discriminated union on `method`.
      // This flow only uses the TOTP enrollment path.
      const enableData =
        result.data?.method === 'totp' ? result.data : undefined;

      if (!enableData?.totpURI) {
        toast.error(t('errors.init'));
        return;
      }

      // Store backup codes returned by enable()
      if (enableData.backupCodes) {
        setBackupCodes(enableData.backupCodes);
      }

      // Extract secret from URI for manual entry
      const secret = extractSecretFromURI(enableData.totpURI);
      setTotpSecret(secret);

      // Generate QR Code
      const qrDataURL = await qrcode.toDataURL(enableData.totpURI, {
        errorCorrectionLevel: 'H',
        width: 256,
        margin: 2
      });
      setQrCodeDataURL(qrDataURL);

      setCurrentStep('qr');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('errors.password')
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // STEP 3: VERIFICATION (shared logic)
  // ═══════════════════════════════════════════════════════════════════

  const verifyTotpCode = async (code: string) => {
    if (code.length !== 6) {
      toast.error(t('errors.code6digits'));
      return;
    }

    setIsLoading(true);
    try {
      const result = await authClient.twoFactor.verifyTotp({
        code
      });

      if (!result.data) {
        toast.error(t('errors.invalidCode'));
        setVerificationCode('');
        return;
      }

      // Backup codes were already fetched in handlePasswordSubmit
      // Now just show them to the user
      if (backupCodes.length > 0) {
        setCurrentStep('backup');
      } else {
        // Success but no backup codes (shouldn't happen)
        toast.success(t('success.activated'), {
          description: t('success.adminNote')
        });
        handleClose();
        onSuccess();
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('errors.invalidCode')
      );
      setVerificationCode('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = () => verifyTotpCode(verificationCode);

  /**
   * Event-driven auto-verify: triggers verification immediately when
   * the user finishes typing the 6th digit, using the local `value`
   * parameter (not stale state) to avoid React batching issues.
   */
  const handleVerificationCodeChange = (value: string) => {
    setVerificationCode(value);
    if (value.length === 6 && currentStep === 'verify') {
      void verifyTotpCode(value);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // STEP 4: BACKUP CODES
  // ═══════════════════════════════════════════════════════════════════

  const handleCopyBackupCodes = async () => {
    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'));
      setCopiedBackup(true);
      toast.success(t('success.codesCopied'));
      setTimeout(() => setCopiedBackup(false), 2000);
    } catch {
      toast.error(t('errors.copyError'));
    }
  };

  const handleDownloadBackupCodes = () => {
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

  const handleFinishSetup = () => {
    toast.success(t('success.activated'), {
      description: t('success.adminNote')
    });
    handleClose();
    onSuccess();
  };

  // ═══════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════

  const handleClose = useCallback(() => {
    setOpen(false);
    // Reset state after animation
    setTimeout(() => {
      setCurrentStep('password');
      setTotpSecret('');
      setQrCodeDataURL('');
      setVerificationCode('');
      setBackupCodes([]);
      setCopiedBackup(false);
      passwordForm.reset();
    }, 300);
  }, [passwordForm]);

  const extractSecretFromURI = (uri: string): string => {
    try {
      const url = new URL(uri);
      return url.searchParams.get('secret') || '';
    } catch {
      return '';
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="w-full sm:w-auto">
          <Shield className="mr-2 h-4 w-4" />
          {t('enableButton')}
        </Button>
      </DialogTrigger>

      <DialogContent
        className="max-w-md"
        showCloseButton={currentStep === 'password'}
      >
        {/* STEP 1: PASSWORD VERIFICATION */}
        {currentStep === 'password' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('dialogTitle')}</DialogTitle>
              <DialogDescription>{t('dialogDescription')}</DialogDescription>
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

              <DialogFooter>
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('verifying')}
                    </>
                  ) : (
                    t('continue')
                  )}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}

        {/* STEP 2: QR CODE DISPLAY */}
        {currentStep === 'qr' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('scanQrCode')}</DialogTitle>
              <DialogDescription>{t('scanDescription')}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* QR Code */}
              <div className="flex justify-center bg-white p-4 rounded-lg">
                {qrCodeDataURL ? (
                  <Image
                    src={qrCodeDataURL}
                    alt={t('qrAlt')}
                    width={256}
                    height={256}
                    className="w-64 h-64"
                    unoptimized
                  />
                ) : (
                  <div className="w-64 h-64 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Manual Secret */}
              {totpSecret && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{t('manualCode')}</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono">
                      {totpSecret}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(totpSecret);
                        toast.success(t('codeCopied'));
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              <Button
                onClick={() => setCurrentStep('verify')}
                className="w-full"
              >
                {t('next')}
              </Button>
            </div>
          </>
        )}

        {/* STEP 3: VERIFICATION */}
        {currentStep === 'verify' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('verifyTitle')}</DialogTitle>
              <DialogDescription>{t('verifyDescription')}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={verificationCode}
                  onChange={handleVerificationCodeChange}
                  disabled={isLoading}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {isLoading && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t('verifyingCode')}</span>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep('qr')}
                  className="flex-1"
                >
                  {t('back')}
                </Button>
                <Button
                  onClick={handleVerifyCode}
                  disabled={verificationCode.length !== 6 || isLoading}
                  className="flex-1"
                >
                  {t('verify')}
                </Button>
              </div>
            </div>
          </>
        )}

        {/* STEP 4: BACKUP CODES */}
        {currentStep === 'backup' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                {t('activatedTitle')}
              </DialogTitle>
              <DialogDescription>{t('activatedDescription')}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Backup Codes Grid */}
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
                <Button
                  variant="outline"
                  onClick={handleCopyBackupCodes}
                  className="flex-1"
                >
                  {copiedBackup ? (
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
                  onClick={handleDownloadBackupCodes}
                  className="flex-1"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {t('download')}
                </Button>
              </div>

              <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 p-3">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  {t('warning')}
                </p>
              </div>

              <Button onClick={handleFinishSetup} className="w-full">
                {t('finish')}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
