import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { headers } from 'next/headers';
import { SkipLink } from '@/components/layout/skip-link';
import { CspNonceProvider } from '@/components/providers/csp-nonce-provider';
import { RootProviders } from '@/lib/providers';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin']
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin']
});

export const metadata: Metadata = {
  title: 'urlfy.cc - URL Shortener',
  description: 'Fast and reliable URL shortening service with analytics'
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get CSP nonce from headers (set by Elysia middleware or Next.js middleware)
  const headersList = await headers();
  const nonce = headersList.get('x-csp-nonce') ?? '';

  // Detect locale from URL path for html lang attribute
  const url =
    headersList.get('x-url') || headersList.get('x-invoke-path') || '';
  const lang = url.includes('/pt-br') ? 'pt-BR' : 'en';
  const skipLinkLabel =
    lang === 'pt-BR' ? 'Pular para o conteúdo principal' : 'Skip to content';

  return (
    <html lang={lang} className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SkipLink label={skipLinkLabel} />
        <CspNonceProvider nonce={nonce}>
          <RootProviders nonce={nonce}>
            <div>{children}</div>
          </RootProviders>
        </CspNonceProvider>
      </body>
    </html>
  );
}
