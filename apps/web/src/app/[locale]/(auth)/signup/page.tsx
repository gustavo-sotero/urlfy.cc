/**
 * ═════════════════════════════════════════════════════════════════════
 * SIGNUP PAGE (Internationalized)
 * ═════════════════════════════════════════════════════════════════════
 * User registration with email/password or OAuth providers.
 * Fully internationalized with next-intl.
 * ═════════════════════════════════════════════════════════════════════
 */

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, UserPlus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AccessibleFormField } from '@/components/forms/accessible-form-field';
import { GitHubIcon } from '@/components/shared/github-icon';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Link, useRouter } from '@/i18n/routing';
import { authClient } from '@/lib/auth.client';
import {
  buildEmailVerificationCallbackUrl,
  buildLocalizedDashboardUrl,
  buildPostSignupDashboardPath
} from '@/lib/email-verification';

export default function SignupPage() {
  const t = useTranslations('Auth.signup');
  const tErrors = useTranslations('Auth.errors');
  const tOAuth = useTranslations('Auth.oauth');
  const locale = useLocale();

  // Define schema with translated messages
  const schema = z
    .object({
      name: z.string().min(2, tErrors('nameMin', { min: 2 })),
      email: z.string().email(tErrors('invalidEmail')),
      password: z.string().min(8, tErrors('passwordMin', { min: 8 })),
      confirmPassword: z.string(),
      acceptTerms: z.boolean().refine((val) => val === true, {
        message: tErrors('mustAcceptTerms')
      })
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: tErrors('passwordsNoMatch'),
      path: ['confirmPassword']
    });

  type FormData = z.infer<typeof schema>;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const buildEmailVerificationCallbackURL = (): string =>
    buildEmailVerificationCallbackUrl(window.location.origin, locale);

  const buildDashboardCallbackURL = (): string =>
    buildLocalizedDashboardUrl(window.location.origin, locale);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false
    }
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await authClient.signUp.email({
        email: data.email,
        password: data.password,
        name: data.name,
        callbackURL: buildEmailVerificationCallbackURL()
      });

      if (result.error) {
        setError(result.error.message || tErrors('signupFailed'));
        return;
      }

      router.push(buildPostSignupDashboardPath());
    } catch {
      setError(tErrors('tryAgain'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthSignup = async (provider: 'google' | 'github') => {
    setIsLoading(true);
    try {
      await authClient.signIn.social({
        provider,
        callbackURL: buildDashboardCallbackURL()
      });
    } catch {
      setError(tErrors('tryAgain'));
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* OAuth Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <Button
            variant="outline"
            onClick={() => handleOAuthSignup('google')}
            disabled={isLoading}
          >
            <GoogleIcon className="mr-2 h-4 w-4" />
            {tOAuth('google')}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleOAuthSignup('github')}
            disabled={isLoading}
          >
            <GitHubIcon className="mr-2 h-4 w-4" />
            {tOAuth('github')}
          </Button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              {tOAuth('createWith')}
            </span>
          </div>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <AccessibleFormField
            id="name"
            label={t('name')}
            required
            error={form.formState.errors.name?.message}
          >
            <Input
              id="name"
              type="text"
              placeholder={t('placeholders.name')}
              {...form.register('name')}
              disabled={isLoading}
              aria-invalid={!!form.formState.errors.name}
            />
          </AccessibleFormField>

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
            hint={t('passwordHint')}
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

          <AccessibleFormField
            id="confirmPassword"
            label={t('confirmPassword')}
            required
            error={form.formState.errors.confirmPassword?.message}
          >
            <Input
              id="confirmPassword"
              type="password"
              placeholder={t('placeholders.password')}
              {...form.register('confirmPassword')}
              disabled={isLoading}
              aria-invalid={!!form.formState.errors.confirmPassword}
            />
          </AccessibleFormField>

          <div className="flex items-start space-x-2">
            <Checkbox
              id="acceptTerms"
              checked={form.watch('acceptTerms')}
              onCheckedChange={(checked) =>
                form.setValue('acceptTerms', checked as boolean)
              }
              disabled={isLoading}
            />
            <div className="leading-none">
              <Label htmlFor="acceptTerms" className="text-sm font-normal">
                <span>
                  {t('acceptTerms')}{' '}
                  <Link href="/terms" className="text-primary underline">
                    {t('termsLink')}
                  </Link>{' '}
                  {t('and')}{' '}
                  <Link href="/privacy" className="text-primary underline">
                    {t('privacyLink')}
                  </Link>
                </span>
              </Label>
              {form.formState.errors.acceptTerms && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.acceptTerms.message}
                </p>
              )}
            </div>
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
                {t('creatingAccount')}
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                {t('signupButton')}
              </>
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          {t('hasAccount')}{' '}
          <Link href="/login" className="text-primary hover:underline">
            {t('signIn')}
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
