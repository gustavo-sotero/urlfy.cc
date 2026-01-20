/**
 * ═════════════════════════════════════════════════════════════════════
 * TWO-FACTOR VERIFICATION COMPONENT (LOGIN)
 * ═════════════════════════════════════════════════════════════════════
 *
 * Handles TOTP verification during login flow.
 * Supports both TOTP codes and backup codes.
 *
 * Module: Authentication & Identity (Module 2)
 * Spec: plan-twoFactorAuth.prompt.md
 * ═══════════════════════════════════════════════════════════════════
 */

'use client';

import { KeyRound, Loader2, Shield } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot
} from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

interface TwoFactorVerificationProps {
  onVerify: (code: string) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
  onBack?: () => void;
}

type InputMode = 'totp' | 'backup';

// ═══════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════

export function TwoFactorVerification({
  onVerify,
  isLoading = false,
  error = null,
  onBack
}: TwoFactorVerificationProps) {
  const [inputMode, setInputMode] = useState<InputMode>('totp');
  const [totpCode, setTotpCode] = useState('');
  const [backupCode, setBackupCode] = useState('');

  // ═══════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════

  const handleBackupSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!backupCode.trim()) {
      toast.error('Digite um código de backup');
      return;
    }
    await onVerify(backupCode.trim());
  };

  const handleToggleMode = () => {
    setInputMode((prev) => (prev === 'totp' ? 'backup' : 'totp'));
    setTotpCode('');
    setBackupCode('');
  };

  // Auto-submit TOTP when 6 digits entered
  const handleTotpChange = (value: string) => {
    setTotpCode(value);
    if (value.length === 6 && !isLoading) {
      void onVerify(value);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="rounded-full bg-primary/10 p-3">
            <Shield className="h-6 w-6 text-primary" />
          </div>
        </div>
        <h2 className="text-2xl font-semibold">Autenticação de Dois Fatores</h2>
        <p className="text-muted-foreground text-sm">
          {inputMode === 'totp'
            ? 'Digite o código de 6 dígitos do seu aplicativo autenticador'
            : 'Digite um dos seus códigos de backup'}
        </p>
      </div>

      {/* Input Forms */}
      <div className="space-y-4">
        {inputMode === 'totp' ? (
          /* TOTP Input */
          <div className="space-y-4">
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={totpCode}
                onChange={handleTotpChange}
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
          </div>
        ) : (
          /* Backup Code Input */
          <form onSubmit={handleBackupSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="backup-code">Código de Backup</Label>
              <Input
                id="backup-code"
                type="text"
                placeholder="xxxx-xxxx-xxxx"
                value={backupCode}
                onChange={(e) => setBackupCode(e.target.value)}
                disabled={isLoading}
                autoComplete="off"
                className="text-center font-mono"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !backupCode.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Verificar Código de Backup
                </>
              )}
            </Button>
          </form>
        )}

        {/* Error Display */}
        {error && (
          <div
            className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Toggle Mode */}
        <div className="text-center">
          <button
            type="button"
            onClick={handleToggleMode}
            disabled={isLoading}
            className="text-sm text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {inputMode === 'totp'
              ? 'Usar código de backup'
              : 'Usar aplicativo autenticador'}
          </button>
        </div>

        {/* Back Button */}
        {onBack && (
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={onBack}
              disabled={isLoading}
              className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Voltar ao login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
