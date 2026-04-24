/**
 * ═════════════════════════════════════════════════════════════════════
 * LOGIN PAGE (Internationalized)
 * ═════════════════════════════════════════════════════════════════════
 * User login with email/password or OAuth providers.
 * Supports 2FA verification.
 * Fully internationalized with next-intl.
 * ═════════════════════════════════════════════════════════════════════
 */

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Github, Loader2, Mail } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { TwoFactorVerification } from '@/components/auth/two-factor-verification';
import { AccessibleFormField } from '@/components/forms/accessible-form-field';
import { GoogleIcon } from '@/components/shared/google-icon';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Link, useRouter } from '@/i18n/routing';
import { authClient } from '@/lib/auth.client';
import { reportActionError } from '@/lib/browser-logger';
import {
  buildPostLoginCallbackPath,
  buildPostLoginCallbackUrl
} from '@/lib/email-verification';

function LoginForm() {
  const t = useTranslations('Auth.login');
  const tErrors = useTranslations('Auth.errors');
  const tOAuth = useTranslations('Auth.oauth');
  const locale = useLocale();

  // Define schema with translated messages
  const schema = z.object({
    email: z.string().email(tErrors('invalidEmail')),
    password: z.string().min(6, tErrors('passwordMin', { min: 6 }))
  });

  type FormData = z.infer<typeof schema>;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTwoFactorStep, setIsTwoFactorStep] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCallbackUrl = searchParams.get('callbackUrl');
  const callbackPath = buildPostLoginCallbackPath(locale, rawCallbackUrl);

  const buildOAuthCallbackURL = (): string =>
    buildPostLoginCallbackUrl(window.location.origin, locale, rawCallbackUrl);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      password: ''
    }
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await authClient.signIn.email({
        email: data.email,
        password: data.password
      });

      // Check if 2FA is required
      if (
        result.data &&
        'twoFactorRedirect' in result.data &&
        result.data.twoFactorRedirect
      ) {
        setIsTwoFactorStep(true);
        return;
      }

      if (result.error) {
        setError(result.error.message || tErrors('loginFailed'));
        return;
      }

      // Success - redirect
      router.push(callbackPath);
    } catch {
      setError(tErrors('tryAgain'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleTwoFactorVerify = async (code: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Use verifyTotp to complete the 2FA process
      const result = await authClient.twoFactor.verifyTotp({
        code,
        trustDevice: false
      });

      if (result.error) {
        setError(result.error.message || tErrors('twoFactorFailed'));
        return;
      }

      // Success - redirect
      router.push(callbackPath);
    } catch (err) {
      reportActionError(err, { step: '2fa-verification' });
      setError(tErrors('invalidCode'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setIsTwoFactorStep(false);
    setError(null);
    form.reset();
  };

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    setIsLoading(true);
    try {
      await authClient.signIn.social({
        provider,
        callbackURL: buildOAuthCallbackURL()
      });
    } catch {
      setError(tErrors('tryAgain'));
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      {!isTwoFactorStep ? (
        /* Regular Login Form */
        <>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{t('title')}</CardTitle>
            <CardDescription>{t('subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* OAuth Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                onClick={() => handleOAuthLogin('google')}
                disabled={isLoading}
              >
                <GoogleIcon className="mr-2 h-4 w-4" />
                {tOAuth('google')}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleOAuthLogin('github')}
                disabled={isLoading}
              >
                <Github className="mr-2 h-4 w-4" />
                {tOAuth('github')}
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  {tOAuth('continueWith')}
                </span>
              </div>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <AccessibleFormField
                id="email"
                label={t('email')}
                required
                error={form.formState.errors.email?.message}
              >
                <Input
                  id="email"
                  type="email"
                  placeholder={t('placeholders.email')}
                  {...form.register('email')}
                  disabled={isLoading}
                  aria-invalid={!!form.formState.errors.email}
                />
              </AccessibleFormField>

              <AccessibleFormField
                id="password"
                label={t('password')}
                required
                error={form.formState.errors.password?.message}
              >
                <Input
                  id="password"
                  type="password"
                  placeholder={t('placeholders.password')}
                  {...form.register('password')}
                  disabled={isLoading}
                  aria-invalid={!!form.formState.errors.password}
                />
              </AccessibleFormField>

              <div className="flex justify-end">
                <Link
                  href="/forgot-password"
                  className="text-sm text-primary hover:underline"
                >
                  {t('forgotPassword')}
                </Link>
              </div>

              {error && (
                <div
                  className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('signingIn')}
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    {t('signInWithEmail')}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center">
            <p className="text-sm text-muted-foreground">
              {t('noAccount')}{' '}
              <Link href="/signup" className="text-primary hover:underline">
                {t('createFreeAccount')}
              </Link>
            </p>
          </CardFooter>
        </>
      ) : (
        /* Two-Factor Verification */
        <CardContent className="pt-6">
          <TwoFactorVerification
            onVerify={handleTwoFactorVerify}
            isLoading={isLoading}
            error={error}
            onBack={handleBackToLogin}
          />
        </CardContent>
      )}
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
