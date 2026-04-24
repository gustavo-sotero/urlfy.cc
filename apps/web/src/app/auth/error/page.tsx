import { AlertTriangle, ArrowRight, Home } from 'lucide-react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import type { JSX } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';

type AuthErrorPageProps = {
  searchParams: Promise<{
    code?: string | string[];
    error?: string | string[];
    message?: string | string[];
    state?: string | string[];
  }>;
};

function getSingleValue(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function getErrorDescription(errorCode?: string): string {
  switch (errorCode) {
    case 'state_not_found':
      return (
        'The OAuth callback arrived without the expected state value. ' +
        'Start the flow from the sign-in page instead of opening the callback URL directly.'
      );
    case 'state_security_mismatch':
      return (
        'The OAuth verification cookie was not returned on callback. ' +
        'Retry sign-in and make sure cookies are enabled for this site.'
      );
    default:
      return (
        'The authentication flow could not be completed. ' +
        'Please retry from the sign-in page.'
      );
  }
}

export const metadata: Metadata = {
  title: 'Authentication error - urlfy.cc',
  description: 'Authentication could not be completed.',
  robots: {
    index: false,
    follow: false
  }
};

export default async function AuthErrorPage({
  searchParams
}: AuthErrorPageProps): Promise<JSX.Element> {
  const query = await searchParams;
  const headersList = await headers();
  const acceptLanguage =
    headersList.get('accept-language')?.toLowerCase() || '';
  const loginHref = acceptLanguage.includes('pt')
    ? '/pt-br/login'
    : '/en/login';

  const errorCode =
    getSingleValue(query.state) ||
    getSingleValue(query.error) ||
    getSingleValue(query.code);
  const message = getSingleValue(query.message);
  const description = getErrorDescription(errorCode);

  return (
    <div className="relative overflow-hidden px-4 py-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--destructive)/0.10),transparent_55%)]" />

      <div className="container relative mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl items-center justify-center">
        <Card className="w-full border-border/60 bg-background/95 shadow-2xl shadow-destructive/5 backdrop-blur">
          <CardHeader className="space-y-6 pb-3 text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-border/70 bg-muted/70">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>

            <div className="space-y-3">
              <span className="inline-flex items-center rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Authentication Error / Erro de autenticação
              </span>
              <CardTitle className="text-3xl tracking-tight sm:text-4xl">
                Sign-in could not be completed
              </CardTitle>
              <CardDescription className="mx-auto max-w-2xl text-base leading-7 text-muted-foreground">
                {description}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pt-4">
            <div className="rounded-2xl border border-dashed border-border/80 bg-muted/50 px-5 py-4 text-sm leading-6 text-muted-foreground">
              Tente iniciar o login novamente pela interface da aplicação. A URL
              de callback OAuth não é um endpoint para acesso direto.
            </div>

            {errorCode ? (
              <p className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Error code / Código:{' '}
                <span className="font-medium text-foreground">{errorCode}</span>
              </p>
            ) : null}

            {message ? (
              <p className="text-center text-sm text-muted-foreground">
                {message}
              </p>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button asChild size="lg" className="min-w-52">
                <Link href={loginHref}>
                  Try again / Tentar novamente
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>

              <Button asChild size="lg" variant="outline" className="min-w-52">
                <Link href="/">
                  Back home / Voltar ao início
                  <Home className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
