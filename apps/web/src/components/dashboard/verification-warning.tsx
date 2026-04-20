'use client';

import { AlertCircle, CheckCircle2, Mail } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Suspense, useCallback, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth.client';
import {
  buildEmailVerificationCallbackUrl,
  isPostSignupVerificationSent
} from '@/lib/email-verification';

interface VerificationWarningInnerProps {
  email: string;
}

function VerificationWarningInner({ email }: VerificationWarningInnerProps) {
  const [isResending, setIsResending] = useState<boolean>(false);
  const [resendSuccess, setResendSuccess] = useState<boolean>(false);
  const [resendError, setResendError] = useState<string | null>(null);

  const t = useTranslations('Dashboard.verification');
  const locale = useLocale();
  const { data: session } = authClient.useSession();
  const searchParams = useSearchParams();
  const isNewSignup = isPostSignupVerificationSent(searchParams);
  const emailAddress = session?.user?.email ?? email;

  const handleResendEmail = useCallback(async (): Promise<void> => {
    if (!emailAddress) {
      setResendError(t('errorEmail'));
      return;
    }

    setIsResending(true);
    setResendError(null);
    setResendSuccess(false);

    try {
      await authClient.sendVerificationEmail({
        email: emailAddress,
        callbackURL: buildEmailVerificationCallbackUrl(
          window.location.origin,
          locale
        )
      });
      setResendSuccess(true);
    } catch {
      setResendError(t('errorResend'));
    } finally {
      setIsResending(false);
    }
  }, [emailAddress, locale, t]);

  return (
    <div className="space-y-4">
      {isNewSignup ? (
        <Alert className="border-sky-500/40 bg-sky-50 dark:bg-sky-950/20">
          <CheckCircle2 className="text-sky-600 dark:text-sky-400" />
          <AlertTitle className="text-sky-900 dark:text-sky-300">
            {t('justSentTitle')}
          </AlertTitle>
          <AlertDescription className="text-sky-800 dark:text-sky-200">
            <div className="space-y-2">
              <p>
                {t('justSentDescription', {
                  email: emailAddress
                })}
              </p>
              <p className="text-xs text-sky-700 dark:text-sky-300">
                {t('justSentHelp')}
              </p>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <Alert
        variant="default"
        className="border-amber-500/40 bg-amber-50 dark:bg-amber-950/20"
      >
        <AlertCircle className="text-amber-600 dark:text-amber-400" />
        <AlertTitle className="text-amber-900 dark:text-amber-300">
          {t('title')}
        </AlertTitle>
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          <div className="space-y-3">
            <p>{t('description')}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleResendEmail}
                disabled={isResending || resendSuccess}
                className="border-amber-600/30 hover:border-amber-600/50 hover:bg-amber-100 dark:hover:bg-amber-900/30"
              >
                <Mail className="size-3.5" />
                {isResending
                  ? t('sending')
                  : resendSuccess
                    ? t('sent')
                    : t('resend')}
              </Button>
              {resendSuccess && (
                <span className="text-xs text-emerald-700 dark:text-emerald-400">
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
    </div>
  );
}

export function VerificationWarning({ email }: { email: string }) {
  return (
    <Suspense fallback={null}>
      <VerificationWarningInner email={email} />
    </Suspense>
  );
}
