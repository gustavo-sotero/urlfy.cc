import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  MailCheck
} from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import { buildPostVerificationLoginPath } from '@/lib/email-verification';

type EmailVerificationPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    error?: string | string[];
    verified?: string | string[];
  }>;
};

function getSingleValue(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Auth.emailVerificationResult');

  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    robots: {
      index: false,
      follow: false
    }
  };
}

export default async function EmailVerificationPage({
  params,
  searchParams
}: EmailVerificationPageProps) {
  const { locale } = await params;
  const query = await searchParams;
  const t = await getTranslations('Auth.emailVerificationResult');

  const error = getSingleValue(query.error);
  const verified = getSingleValue(query.verified);
  const hasError = Boolean(error);
  const isVerified = verified === '1' && !hasError;

  const title = hasError
    ? t('errorTitle')
    : isVerified
      ? t('successTitle')
      : t('pendingTitle');
  const description = hasError
    ? t('errorDescription')
    : isVerified
      ? t('successDescription')
      : t('pendingDescription');
  const hint = hasError
    ? t('errorHint')
    : isVerified
      ? t('successHint')
      : t('pendingHint');
  const badgeLabel = hasError
    ? t('errorBadge')
    : isVerified
      ? t('successBadge')
      : t('pendingBadge');
  const loginHref = buildPostVerificationLoginPath(locale);

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.12),transparent_55%)]" />
      <div className="container relative mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl items-center px-4 py-16">
        <Card className="w-full border-border/60 bg-background/95 shadow-2xl shadow-primary/5 backdrop-blur">
          <CardHeader className="space-y-6 pb-3 text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-border/70 bg-muted/70">
              {hasError ? (
                <AlertTriangle className="h-8 w-8 text-amber-600" />
              ) : isVerified ? (
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              ) : (
                <MailCheck className="h-8 w-8 text-primary" />
              )}
            </div>

            <div className="space-y-3">
              <span className="inline-flex items-center rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                {badgeLabel}
              </span>
              <CardTitle className="text-3xl tracking-tight sm:text-4xl">
                {title}
              </CardTitle>
              <CardDescription className="mx-auto max-w-2xl text-base leading-7 text-muted-foreground">
                {description}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pt-4">
            <div className="rounded-2xl border border-dashed border-border/80 bg-muted/50 px-5 py-4 text-sm leading-6 text-muted-foreground">
              {hint}
            </div>

            {error ? (
              <p className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {t('errorCodeLabel')}{' '}
                <span className="font-medium text-foreground">{error}</span>
              </p>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button asChild size="lg" className="min-w-52">
                <Link href={loginHref}>
                  {hasError ? t('retryCta') : t('continueCta')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>

              <Button asChild size="lg" variant="outline" className="min-w-52">
                <Link href="/">{t('homeCta')}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
