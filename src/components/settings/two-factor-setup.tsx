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
import qrcode from 'qrcode';
import { useCallback, useEffect, useState } from 'react';
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
// TYPES & SCHEMAS
// ═══════════════════════════════════════════════════════════════════

type SetupStep = 'password' | 'qr' | 'verify' | 'backup';

const passwordSchema = z.object({
  password: z.string().min(1, 'Senha é obrigatória')
});

type PasswordFormData = z.infer<typeof passwordSchema>;

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

  // Step state
  const [totpSecret, setTotpSecret] = useState<string>('');
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedBackup, setCopiedBackup] = useState(false);

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

      if (!result.data?.totpURI) {
        toast.error('Erro ao inicializar 2FA. Tente novamente.');
        return;
      }

      // Store backup codes returned by enable()
      if (result.data.backupCodes) {
        setBackupCodes(result.data.backupCodes);
      }

      // Extract secret from URI for manual entry
      const secret = extractSecretFromURI(result.data.totpURI);
      setTotpSecret(secret);

      // Generate QR Code
      const qrDataURL = await qrcode.toDataURL(result.data.totpURI, {
        errorCorrectionLevel: 'H',
        width: 256,
        margin: 2
      });
      setQrCodeDataURL(qrDataURL);

      setCurrentStep('qr');
    } catch (error) {
      console.error('2FA enable error:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Senha incorreta ou erro ao configurar 2FA'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // STEP 3: VERIFICATION
  // ═══════════════════════════════════════════════════════════════════

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) {
      toast.error('Digite o código de 6 dígitos');
      return;
    }

    setIsLoading(true);
    try {
      const result = await authClient.twoFactor.verifyTotp({
        code: verificationCode
      });

      if (!result.data) {
        toast.error('Código inválido. Tente novamente.');
        setVerificationCode('');
        return;
      }

      // Backup codes were already fetched in handlePasswordSubmit
      // Now just show them to the user
      if (backupCodes.length > 0) {
        setCurrentStep('backup');
      } else {
        // Success but no backup codes (shouldn't happen)
        toast.success('2FA ativado com sucesso!', {
          description:
            'Aguarde até 30 segundos para acessar áreas de admin devido ao cache de sessão.'
        });
        handleClose();
        onSuccess();
      }
    } catch (error) {
      console.error('2FA verify error:', error);
      toast.error(error instanceof Error ? error.message : 'Código inválido');
      setVerificationCode('');
    } finally {
      setIsLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // STEP 4: BACKUP CODES
  // ═══════════════════════════════════════════════════════════════════

  const handleCopyBackupCodes = async () => {
    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'));
      setCopiedBackup(true);
      toast.success('Códigos copiados para a área de transferência');
      setTimeout(() => setCopiedBackup(false), 2000);
    } catch {
      toast.error('Erro ao copiar códigos');
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
    toast.success('Códigos baixados');
  };

  const handleFinishSetup = () => {
    toast.success('2FA ativado com sucesso!', {
      description:
        'Aguarde até 30 segundos para acessar áreas de admin devido ao cache de sessão.'
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

  // Auto-verify when code is complete
  // Note: We avoid using useCallback here to prevent dependency issues
  // The effect intentionally only depends on verification state
  useEffect(() => {
    async function verifyCode() {
      if (verificationCode.length !== 6) {
        return;
      }

      setIsLoading(true);
      try {
        const result = await authClient.twoFactor.verifyTotp({
          code: verificationCode
        });

        if (!result.data) {
          toast.error('Código inválido. Tente novamente.');
          setVerificationCode('');
          return;
        }

        // Backup codes were already fetched in handlePasswordSubmit
        // Now just show them to the user
        if (backupCodes.length > 0) {
          setCurrentStep('backup');
        } else {
          // Success but no backup codes (shouldn't happen)
          toast.success('2FA ativado com sucesso!');
          handleClose();
          onSuccess();
        }
      } catch (error) {
        console.error('2FA verify error:', error);
        toast.error(error instanceof Error ? error.message : 'Código inválido');
        setVerificationCode('');
      } finally {
        setIsLoading(false);
      }
    }

    if (verificationCode.length === 6 && currentStep === 'verify') {
      void verifyCode();
    }
  }, [verificationCode, currentStep, backupCodes, onSuccess, handleClose]);

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="w-full sm:w-auto">
          <Shield className="mr-2 h-4 w-4" />
          Ativar Autenticação de Dois Fatores
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
              <DialogTitle>Ativar 2FA</DialogTitle>
              <DialogDescription>
                Para começar, confirme sua senha atual
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)}
              className="space-y-4"
            >
              <AccessibleFormField
                id="password"
                label="Senha"
                required
                error={passwordForm.formState.errors.password?.message}
              >
                <Input
                  id="password"
                  type="password"
                  placeholder="Digite sua senha"
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
                      Verificando...
                    </>
                  ) : (
                    'Continuar'
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
              <DialogTitle>Escaneie o QR Code</DialogTitle>
              <DialogDescription>
                Use um aplicativo autenticador como Google Authenticator ou
                Authy
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* QR Code */}
              <div className="flex justify-center bg-white p-4 rounded-lg">
                {qrCodeDataURL ? (
                  <Image
                    src={qrCodeDataURL}
                    alt="QR Code para configuração do 2FA"
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
                  <p className="text-sm font-medium">
                    Ou insira manualmente o código:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono">
                      {totpSecret}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(totpSecret);
                        toast.success('Código copiado');
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
                Próximo
              </Button>
            </div>
          </>
        )}

        {/* STEP 3: VERIFICATION */}
        {currentStep === 'verify' && (
          <>
            <DialogHeader>
              <DialogTitle>Verifique o Código</DialogTitle>
              <DialogDescription>
                Digite o código de 6 dígitos do seu aplicativo autenticador
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={verificationCode}
                  onChange={setVerificationCode}
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
                  <span>Verificando código...</span>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep('qr')}
                  className="flex-1"
                >
                  Voltar
                </Button>
                <Button
                  onClick={handleVerifyCode}
                  disabled={verificationCode.length !== 6 || isLoading}
                  className="flex-1"
                >
                  Verificar
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
                2FA Ativado!
              </DialogTitle>
              <DialogDescription>
                Guarde estes códigos de backup em um lugar seguro. Cada código
                pode ser usado apenas uma vez.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Backup Codes Grid */}
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-4">
                {backupCodes.map((code, index) => (
                  <code
                    key={index}
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
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadBackupCodes}
                  className="flex-1"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Baixar
                </Button>
              </div>

              <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 p-3">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ Estes códigos não serão exibidos novamente. Certifique-se de
                  salvá-los antes de continuar.
                </p>
              </div>

              <Button onClick={handleFinishSetup} className="w-full">
                Concluir
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
