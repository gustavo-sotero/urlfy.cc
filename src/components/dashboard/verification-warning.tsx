'use client';

import { AlertCircle, Mail } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth.client';

const ERROR_MESSAGES = {
  NO_EMAIL: 'Não foi possível obter o email do usuário.',
  GENERIC: 'Falha ao reenviar email. Tente novamente.'
} as const;

export function VerificationWarning() {
  const [isResending, setIsResending] = useState<boolean>(false);
  const [resendSuccess, setResendSuccess] = useState<boolean>(false);
  const [resendError, setResendError] = useState<string | null>(null);

  const { data: session } = authClient.useSession();

  const handleResendEmail = useCallback(async (): Promise<void> => {
    if (!session?.user?.email) {
      setResendError(ERROR_MESSAGES.NO_EMAIL);
      return;
    }

    setIsResending(true);
    setResendError(null);
    setResendSuccess(false);

    try {
      await authClient.sendVerificationEmail({
        email: session.user.email,
        callbackURL: `${window.location.origin}/dashboard`
      });
      setResendSuccess(true);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : ERROR_MESSAGES.GENERIC;
      setResendError(errorMessage);
    } finally {
      setIsResending(false);
    }
  }, [session?.user?.email]);

  return (
    <Alert
      variant="default"
      className="mb-6 border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20"
    >
      <AlertCircle className="text-yellow-600 dark:text-yellow-500" />
      <AlertTitle className="text-yellow-900 dark:text-yellow-400">
        Verificação de e-mail pendente
      </AlertTitle>
      <AlertDescription className="text-yellow-800 dark:text-yellow-500">
        <div className="space-y-3">
          <p>
            Por favor, verifique seu endereço de e-mail para ter acesso completo
            à plataforma. Você não poderá criar links até confirmar seu e-mail.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleResendEmail}
              disabled={isResending || resendSuccess}
              className="border-yellow-600/30 hover:border-yellow-600/50 hover:bg-yellow-100 dark:hover:bg-yellow-900/30"
            >
              <Mail className="size-3.5" />
              {isResending
                ? 'Enviando...'
                : resendSuccess
                  ? 'E-mail enviado!'
                  : 'Reenviar e-mail'}
            </Button>
            {resendSuccess && (
              <span className="text-xs text-green-700 dark:text-green-400">
                Verifique sua caixa de entrada e spam.
              </span>
            )}
            {resendError && (
              <span className="text-xs text-red-700 dark:text-red-400">
                {resendError}
              </span>
            )}
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}
