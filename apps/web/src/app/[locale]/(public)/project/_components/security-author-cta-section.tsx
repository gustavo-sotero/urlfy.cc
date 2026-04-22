import { Code2, ExternalLink, Github, Rocket, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SecurityAuthorCtaSectionProps {
  t: (key: string) => string;
}

export function SecurityAuthorCtaSection({ t }: SecurityAuthorCtaSectionProps) {
  return (
    <>
      {/* Security & Compliance */}
      <section className="border-t bg-muted/30 py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-5xl space-y-8">
            <div className="space-y-4 text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {t('security.title')}
              </h2>
              <a
                href="https://github.com/gustavo-sotero/urlfy.cc/blob/main/docs/architecture/security.md"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                {t('security.docsLink')}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle>{t('security.protections.title')}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <ul className="space-y-2 text-muted-foreground">
                    <li>✅ {t('security.protections.rateLimit')}</li>
                    <li>✅ {t('security.protections.headers')}</li>
                    <li>✅ {t('security.protections.csrf')}</li>
                    <li>✅ {t('security.protections.sanitization')}</li>
                    <li>✅ {t('security.protections.blacklist')}</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle>{t('security.compliance.title')}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <ul className="space-y-2 text-muted-foreground">
                    <li>✅ {t('security.compliance.anonymization')}</li>
                    <li>✅ {t('security.compliance.consent')}</li>
                    <li>✅ {t('security.compliance.export')}</li>
                    <li>✅ {t('security.compliance.forgotten')}</li>
                    <li>✅ {t('security.compliance.retention')}</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Author Section */}
      <section className="border-t py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl space-y-8 text-center">
            <div className="space-y-4">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {t('author.title')}
              </h2>
              <div className="space-y-4">
                <p className="text-lg text-muted-foreground">
                  <strong className="text-foreground">
                    {t('author.name')}
                  </strong>{' '}
                  - {t('author.role')}
                </p>
                <p className="text-muted-foreground">
                  {t('author.description')}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-4">
              <Button asChild variant="default">
                <a
                  href="https://gustavo-sotero.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Rocket className="mr-2 h-4 w-4" />
                  {t('author.portfolio')}
                </a>
              </Button>
              <Button asChild variant="outline">
                <a
                  href="https://github.com/gustavo-sotero/urlfy.cc"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="mr-2 h-4 w-4" />
                  {t('author.github')}
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="border-t bg-muted/30 py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl space-y-6 text-center">
            <h2 className="text-3xl font-bold">{t('cta.title')}</h2>
            <p className="text-muted-foreground">{t('cta.description')}</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button asChild variant="default">
                <a
                  href="https://github.com/gustavo-sotero/urlfy.cc/blob/main/README.md"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="mr-2 h-4 w-4" />
                  {t('cta.repository')}
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href="/api/docs">
                  <Code2 className="mr-2 h-4 w-4" />
                  {t('cta.apiDocs')}
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
