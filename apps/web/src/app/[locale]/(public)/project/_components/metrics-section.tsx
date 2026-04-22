import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';

const METRIC_IDS = ['latencyP50', 'latencyP99', 'cacheHitRate'] as const;

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
            {METRIC_IDS.map((metricId) => (
              <Card key={metricId} className="text-center">
                <CardHeader>
                  <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    {t('metrics.contextLabel')}
                  </p>
                  <CardTitle className="text-4xl font-bold text-primary">
                    {t(`metrics.${metricId}.value`)}
                  </CardTitle>
                  <CardDescription>
                    {t(`metrics.${metricId}.label`)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {t(`metrics.${metricId}.description`)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
