'use client';

import { AlertCircle, Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth.client';

export function VerificationWarning() {
  const [isResending, setIsResending] = useState<boolean>(false);
  const [resendSuccess, setResendSuccess] = useState<boolean>(false);
  const [resendError, setResendError] = useState<string | null>(null);

  const t = useTranslations('Dashboard.verification');
  const { data: session } = authClient.useSession();

  const handleResendEmail = useCallback(async (): Promise<void> => {
    if (!session?.user?.email) {
      setResendError(t('errorEmail'));
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
        error instanceof Error ? error.message : t('errorResend');
      setResendError(errorMessage);
    } finally {
      setIsResending(false);
    }
  }, [session?.user?.email, t]);

  return (
    <Alert
      variant="default"
      className="mb-6 border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20"
    >
      <AlertCircle className="text-yellow-600 dark:text-yellow-500" />
      <AlertTitle className="text-yellow-900 dark:text-yellow-400">
        {t('title')}
      </AlertTitle>
      <AlertDescription className="text-yellow-800 dark:text-yellow-500">
        <div className="space-y-3">
          <p>{t('description')}</p>
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
                ? t('sending')
                : resendSuccess
                  ? t('sent')
                  : t('resend')}
            </Button>
            {resendSuccess && (
              <span className="text-xs text-green-700 dark:text-green-400">
                {t('checkInbox')}
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
