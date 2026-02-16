import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';

interface MetricsSectionProps {
  t: (key: string) => string;
}

export function MetricsSection({ t }: MetricsSectionProps) {
  return (
    <section className="border-t py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-5xl space-y-12">
          <div className="space-y-4 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t('metrics.title')}
            </h2>
            <p className="text-lg text-muted-foreground">
              {t('metrics.subtitle')}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card className="text-center">
              <CardHeader>
                <CardTitle className="text-4xl font-bold text-primary">
                  {t('metrics.latency.value')}
                </CardTitle>
                <CardDescription>{t('metrics.latency.label')}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t('metrics.latency.description')}
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <CardTitle className="text-4xl font-bold text-primary">
                  {t('metrics.throughput.value')}
                </CardTitle>
                <CardDescription>
                  {t('metrics.throughput.label')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t('metrics.throughput.description')}
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <CardTitle className="text-4xl font-bold text-primary">
                  {t('metrics.availability.value')}
                </CardTitle>
                <CardDescription>
                  {t('metrics.availability.label')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t('metrics.availability.description')}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
