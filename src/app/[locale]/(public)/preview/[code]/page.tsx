// src/app/(public)/preview/[code]/page.tsx

import { BarChart2, Calendar, ExternalLink, Lock } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/routing';

interface Props {
  params: Promise<{ code: string }>;
}

const API_BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function getLinkPreview(code: string) {
  try {
    const response = await fetch(
      `${API_BASE}/api/links/by-code/${code}/preview`,
      {
        cache: 'no-store'
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.success ? data.data : null;
  } catch {
    return null;
  }
}

export default async function PreviewPage({ params }: Props) {
  const { code } = await params;
  const link = await getLinkPreview(code);

  if (!link) {
    notFound();
  }

  const t = await getTranslations('Preview');
  const locale = await getLocale();
  const intlLocale = locale === 'pt-br' ? 'pt-BR' : locale;

  return (
    <main className="container mx-auto min-h-screen p-4 py-12">
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {t('title')}
              {link.isPasswordProtected && (
                <Lock className="h-5 w-5 text-muted-foreground" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Short URL */}
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {t('shortUrl')}
              </p>
              <p className="text-lg font-mono">urlfy.cc/{link.shortCode}</p>
            </div>

            {/* Original URL */}
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {t('destination')}
              </p>
              <p className="break-all text-lg">{link.originalUrl}</p>
            </div>

            {/* Meta Information */}
            {link.metaTitle && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('metaTitle')}
                </p>
                <p className="text-lg">{link.metaTitle}</p>
              </div>
            )}

            {link.metaDescription && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('metaDescription')}
                </p>
                <p className="text-sm">{link.metaDescription}</p>
              </div>
            )}

            {/* Stats */}
            <div className="flex gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <BarChart2 className="h-4 w-4" />
                <span>{t('clicks', { count: link.clicksCount })}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>
                  {t('createdAt', {
                    date: new Date(link.createdAt).toLocaleDateString(
                      intlLocale
                    )
                  })}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button asChild className="flex-1">
                <Link href={`/${link.shortCode}`}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t('accessLink')}
                </Link>
              </Button>
            </div>

            {link.isPasswordProtected && (
              <p className="text-sm text-muted-foreground">
                {t('passwordProtectedWarning')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
