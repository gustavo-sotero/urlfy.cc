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
import { Github, Loader2, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AccessibleFormField } from '@/components/forms/accessible-form-field';
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

export default function SignupPage() {
  const t = useTranslations('Auth.signup');
  const tErrors = useTranslations('Auth.errors');
  const tOAuth = useTranslations('Auth.oauth');

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
        name: data.name
      });

      if (result.error) {
        setError(result.error.message || tErrors('signupFailed'));
        return;
      }

      // Redirect to dashboard or email verification page
      router.push('/dashboard?welcome=true');
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
        callbackURL: '/dashboard?welcome=true'
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
            <svg
              className="mr-2 h-4 w-4"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {tOAuth('google')}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleOAuthSignup('github')}
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
