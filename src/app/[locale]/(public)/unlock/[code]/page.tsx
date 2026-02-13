// src/app/(public)/unlock/[code]/page.tsx

import { Lock } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { UnlockForm } from '@/components/forms/unlock-form';
import { Card } from '@/components/ui/card';

interface Props {
  params: Promise<{ code: string }>;
}

export default async function UnlockPage({ params }: Props) {
  const { code } = await params;
  const t = await getTranslations('Unlock');

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md p-6">
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t('title')}</h1>
              <p className="text-sm text-muted-foreground">
                {t('description')}
              </p>
            </div>
          </div>

          <UnlockForm code={code} />
        </div>
      </Card>
    </main>
  );
}
