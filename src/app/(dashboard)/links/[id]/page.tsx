// src/app/(dashboard)/links/[id]/page.tsx
'use client';

import { ArrowLeft, Edit, ExternalLink, Trash } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AnalyticsDashboardSkeleton } from '@/components/charts/analytics-skeleton';
import { ClicksChart } from '@/components/charts/clicks-chart';
import { CountriesChart } from '@/components/charts/countries-chart';
import { DevicesChart } from '@/components/charts/devices-chart';
import { ReferrersChart } from '@/components/charts/referrers-chart';
import { ErrorBoundary } from '@/components/error-boundary';
import { QueryError } from '@/components/query-error';
import { CopyButton } from '@/components/shared/copy-button';
import { QRCodeButton } from '@/components/shared/qr-code-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { useLinkAnalytics } from '@/lib/hooks/use-analytics';
import { useDeleteLink, useLink } from '@/lib/hooks/use-links';

export default function LinkDetailPage() {
  const params = useParams();
  const router = useRouter();
  const linkId = params.id as string;

  const { data: link, isLoading, isError, error, refetch } = useLink(linkId);
  const { daily, breakdown, summary } = useLinkAnalytics(linkId);
  const deleteLink = useDeleteLink();

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja deletar este link?')) return;

    try {
      await deleteLink.mutateAsync(linkId);
      router.push('/dashboard/links?deleted=true');
    } catch (error) {
      console.error('Failed to delete link:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <AnalyticsDashboardSkeleton />
      </div>
    );
  }

  if (isError || !link) {
    return (
      <QueryError
        error={error as Error}
        onRetry={() => refetch()}
        title="Erro ao carregar link"
      />
    );
  }

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link
                href="/dashboard/links"
                aria-label="Voltar para lista de links"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h2 className="text-3xl font-bold tracking-tight">
                Detalhes do Link
              </h2>
              <p className="text-muted-foreground">{link.shortCode}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <QRCodeButton code={link.shortCode} />
            <Button variant="outline" asChild>
              <Link href={`/dashboard/links/${linkId}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </Link>
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash className="mr-2 h-4 w-4" />
              Deletar
            </Button>
          </div>
        </div>

        {/* Link Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Informações do Link</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">
                Link Curto
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 font-mono text-sm">
                  {link.shortUrl}
                </code>
                <CopyButton text={link.shortUrl} />
                <Button variant="ghost" size="icon" asChild>
                  <a
                    href={link.shortUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Abrir link em nova aba"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">
                URL Original
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-muted px-3 py-2 font-mono text-sm">
                  {link.originalUrl}
                </code>
                <CopyButton text={link.originalUrl} />
              </div>
            </div>

            <div className="flex gap-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Status
                </div>
                <Badge variant={link.isActive ? 'default' : 'secondary'}>
                  {link.isActive ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>

              {link.expiresAt && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Expira em
                  </div>
                  <div className="text-sm">
                    {new Date(link.expiresAt).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              )}

              {link.maxClicks && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Limite de Cliques
                  </div>
                  <div className="text-sm">
                    {link.clicksCount} / {link.maxClicks}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Analytics Summary */}
        {summary.data && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total de Cliques</CardDescription>
                <CardTitle className="text-3xl">
                  {summary.data.totalClicks}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Visitantes Únicos</CardDescription>
                <CardTitle className="text-3xl">
                  {summary.data.uniqueVisitors}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Taxa de Conversão</CardDescription>
                <CardTitle className="text-3xl">
                  {summary.data.totalClicks > 0
                    ? (
                        (summary.data.uniqueVisitors /
                          summary.data.totalClicks) *
                        100
                      ).toFixed(1)
                    : '0.0'}
                  %
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Média de Cliques/Dia</CardDescription>
                <CardTitle className="text-3xl">
                  {summary.data.avgClicksPerDay}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
        )}

        {/* Charts */}
        <div className="space-y-6">
          {/* Clicks Chart */}
          {daily.data && (
            <Card>
              <CardHeader>
                <CardTitle>Cliques ao Longo do Tempo</CardTitle>
                <CardDescription>Últimos 30 dias</CardDescription>
              </CardHeader>
              <CardContent>
                <ClicksChart data={daily.data} />
              </CardContent>
            </Card>
          )}

          {/* Breakdown Charts */}
          {breakdown.data && (
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Países</CardTitle>
                  <CardDescription>Top países por cliques</CardDescription>
                </CardHeader>
                <CardContent>
                  <CountriesChart data={breakdown.data.countries} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Dispositivos</CardTitle>
                  <CardDescription>
                    Distribuição por tipo de dispositivo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DevicesChart data={breakdown.data.devices} />
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Fontes de Tráfego</CardTitle>
                  <CardDescription>De onde vêm seus visitantes</CardDescription>
                </CardHeader>
                <CardContent>
                  <ReferrersChart data={breakdown.data.referrers} />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
