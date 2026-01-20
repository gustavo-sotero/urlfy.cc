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
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { AccessibleFormField } from '@/components/forms/accessible-form-field';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
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

const passwordSchema = z.object({
  password: z.string().min(1, 'Senha é obrigatória'),
  totpCode: z.string().length(6, 'Código deve ter 6 dígitos')
});

type PasswordFormData = z.infer<typeof passwordSchema>;

interface BackupCodesProps {
  asDialog?: boolean;
}

type ViewState = 'password' | 'codes';

// ═══════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════

export function BackupCodes({ asDialog = true }: BackupCodesProps) {
  const [open, setOpen] = useState(false);
  const [viewState, setViewState] = useState<ViewState>('password');
  const [isLoading, setIsLoading] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

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
        toast.error('Código de autenticação inválido');
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
        toast.error('Não foi possível gerar novos códigos de backup');
      }
    } catch (error) {
      console.error('Generate backup codes error:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Código de autenticação ou senha incorretos'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'));
      setCopied(true);
      toast.success('Códigos copiados para a área de transferência');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar códigos');
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
    toast.success('Códigos baixados');
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
            <DialogTitle>Gerar Novos Códigos de Backup</DialogTitle>
            <DialogDescription>
              Por segurança, confirme sua senha e o código do autenticador.
              Novos códigos serão gerados e os antigos serão invalidados.
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

            <AccessibleFormField
              id="totpCode"
              label="Código do Autenticador"
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
                    Gerando...
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    Gerar Novos Códigos
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
            <DialogTitle>Códigos de Backup</DialogTitle>
            <DialogDescription>
              Guarde estes códigos em um lugar seguro. Cada código pode ser
              usado apenas uma vez para recuperar o acesso à sua conta.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Codes Grid */}
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
              <Button variant="outline" onClick={handleCopy} className="flex-1">
                {copied ? (
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
                onClick={handleDownload}
                className="flex-1"
              >
                <Download className="mr-2 h-4 w-4" />
                Baixar
              </Button>
            </div>

            <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 p-3">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                ⚠️ Seus códigos antigos foram invalidados. Salve estes novos
                códigos em um lugar seguro.
              </p>
            </div>

            <Button
              onClick={handleClose}
              variant="secondary"
              className="w-full"
            >
              Fechar
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
            Gerar Novos Códigos
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">{content}</DialogContent>
      </Dialog>
    );
  }

  return content;
}

/**
 * ═════════════════════════════════════════════════════════════════════
 * TWO-FACTOR DISABLE COMPONENT
 * ═══════════════════════════════════════════════════════════════════
 *
 * Allows users to disable 2FA with password confirmation.
 * Should be blocked for admin users per security requirements.
 * ═══════════════════════════════════════════════════════════════════
 */

interface DisableTwoFactorProps {
  isAdmin?: boolean;
  onSuccess: () => void;
}

export function DisableTwoFactor({
  isAdmin = false,
  onSuccess
}: DisableTwoFactorProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState('');

  const handleDisable = async () => {
    if (!password) {
      toast.error('Senha é obrigatória');
      return;
    }

    setIsLoading(true);
    try {
      await authClient.twoFactor.disable({
        password
      });

      toast.success('2FA desativado com sucesso');
      setOpen(false);
      setPassword('');
      onSuccess();
    } catch (error) {
      console.error('Disable 2FA error:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Erro ao desativar 2FA. Verifique sua senha.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="destructive"
          disabled={isAdmin}
          title={
            isAdmin
              ? 'Administradores devem manter 2FA ativado por segurança'
              : undefined
          }
        >
          Desativar 2FA
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Desativar Autenticação de Dois Fatores?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Isso tornará sua conta menos segura. Você precisará apenas da senha
            para fazer login.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <label htmlFor="disable-password" className="text-sm font-medium">
            Confirme sua senha
          </label>
          <Input
            id="disable-password"
            type="password"
            placeholder="Digite sua senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            autoComplete="current-password"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDisable}
            disabled={isLoading || !password}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Desativando...
              </>
            ) : (
              'Desativar 2FA'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
