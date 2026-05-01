import { BarChart3, Database, ExternalLink, Layers, Zap } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';

interface ArchitectureSectionProps {
  t: (key: string) => string;
}

export function ArchitectureSection({ t }: ArchitectureSectionProps) {
  return (
    <>
      <section
        id="architecture"
        className="scroll-mt-24 border-t bg-muted/30 py-20"
      >
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-5xl space-y-12">
            <div className="space-y-4 text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {t('architecture.title')}
              </h2>
              <p className="text-lg text-muted-foreground">
                {t('architecture.subtitle')}
              </p>
              <a
                href="https://github.com/gustavo-sotero/urlfy.cc/blob/main/README.md#key-design-decisions"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                {t('architecture.docsLink')}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Layers className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle>{t('architecture.frontend.title')}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <ul className="space-y-2">
                    <li>{t('architecture.frontend.appRouter')}</li>
                    <li>{t('architecture.frontend.middleware')}</li>
                    <li>{t('architecture.frontend.ui')}</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle>{t('architecture.api.title')}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <ul className="space-y-2">
                    <li>{t('architecture.api.typeSafe')}</li>
                    <li>{t('architecture.api.fast')}</li>
                    <li>
                      {t('architecture.api.openapi')} <code>/api/docs</code>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section id="infrastructure" className="scroll-mt-24 border-t py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-5xl space-y-12">
            <div className="space-y-4 text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {t('infrastructure.title')}
              </h2>
              <p className="text-lg text-muted-foreground">
                {t('infrastructure.subtitle')}
              </p>
              <a
                href="https://github.com/gustavo-sotero/urlfy.cc/blob/main/README.md#topology"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                {t('infrastructure.docsLink')}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Database className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>
                        {t('infrastructure.persistence.title')}
                      </CardTitle>
                      <CardDescription>
                        {t('infrastructure.persistence.subtitle')}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>{t('infrastructure.persistence.feature1')}</p>
                  <p>{t('infrastructure.persistence.feature2')}</p>
                  <p>{t('infrastructure.persistence.feature3')}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>{t('infrastructure.cache.title')}</CardTitle>
                      <CardDescription>
                        {t('infrastructure.cache.subtitle')}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>{t('infrastructure.cache.feature1')}</p>
                  <p>{t('infrastructure.cache.feature2')}</p>
                  <p>{t('infrastructure.cache.feature3')}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <BarChart3 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>
                        {t('infrastructure.observability.title')}
                      </CardTitle>
                      <CardDescription>
                        {t('infrastructure.observability.subtitle')}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>{t('infrastructure.observability.feature1')}</p>
                  <p>{t('infrastructure.observability.feature2')}</p>
                  <p>{t('infrastructure.observability.feature3')}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
