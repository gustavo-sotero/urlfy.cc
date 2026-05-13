'use client';

import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { StatsCards } from '@/components/admin';
import { AnalyticsErrorBoundary } from '@/components/admin/analytics-error-boundary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type AdminStats, getAdminStats, getGrowthStats } from '@/lib/api';

const GrowthChart = dynamic(
  () =>
    import('@/components/admin/charts/growth-chart').then((m) => ({
      default: m.GrowthChart
    })),
  { ssr: false, loading: () => <Skeleton className="h-75 w-full" /> }
);

const STATS_SKELETON_KEYS = ['stat-1', 'stat-2', 'stat-3', 'stat-4'] as const;
const ADMIN_STATS_KEY = ['admin', 'stats'] as const;

function adminGrowthKey(range: '7d' | '30d') {
  return ['admin', 'growth', range] as const;
}

export function AdminDashboardPageClient() {
  const [growthRange, setGrowthRange] = useState<'7d' | '30d'>('7d');

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError
  } = useQuery<AdminStats, Error>({
    queryKey: ADMIN_STATS_KEY,
    queryFn: () => getAdminStats(),
    staleTime: 30_000,
    refetchInterval: false,
    refetchIntervalInBackground: false
  });

  const {
    data: growthStats,
    isLoading: growthLoading,
    error: growthError
  } = useQuery({
    queryKey: adminGrowthKey(growthRange),
    queryFn: () => getGrowthStats(growthRange),
    staleTime: 60_000,
    refetchInterval: false,
    refetchIntervalInBackground: false
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Painel Administrativo</h1>
      </div>

      {statsLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {STATS_SKELETON_KEYS.map((key) => (
            <Card key={key}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : statsError ? (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">
              Falha ao carregar estatísticas. Tente novamente.
            </p>
          </CardContent>
        </Card>
      ) : stats ? (
        <StatsCards stats={stats} />
      ) : null}

      <AnalyticsErrorBoundary fallbackTitle="Crescimento da Plataforma">
        <Card>
          <CardHeader>
            <CardTitle>Crescimento da Plataforma</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs
              value={growthRange}
              onValueChange={(value) => setGrowthRange(value as '7d' | '30d')}
              className="space-y-4"
            >
              <TabsList>
                <TabsTrigger value="7d">Últimos 7 dias</TabsTrigger>
                <TabsTrigger value="30d">Últimos 30 dias</TabsTrigger>
              </TabsList>
              <TabsContent value={growthRange}>
                {growthLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-75 w-full" />
                  </div>
                ) : growthError ? (
                  <div className="text-center text-sm text-destructive py-8">
                    Falha ao carregar dados de crescimento
                  </div>
                ) : growthStats && growthStats.length > 0 ? (
                  <GrowthChart data={growthStats} />
                ) : (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    Nenhum dado disponível
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </AnalyticsErrorBoundary>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Desempenho</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Requisições/segundo
                </span>
                {statsLoading ? (
                  <Skeleton className="h-5 w-12" />
                ) : (
                  <span className="font-medium">
                    {stats?.requestsPerSecond ?? 0}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <a
                href="/admin/links"
                className="block rounded-md border p-3 text-sm hover:bg-muted"
              >
                Gerenciar Links →
              </a>
              <a
                href="/admin/users"
                className="block rounded-md border p-3 text-sm hover:bg-muted"
              >
                Gerenciar Usuários →
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
