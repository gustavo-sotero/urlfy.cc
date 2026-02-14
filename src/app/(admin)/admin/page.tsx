// src/app/(admin)/admin/page.tsx
'use client';

import { StatsCards } from '@/components/admin';
import { AnalyticsErrorBoundary } from '@/components/admin/analytics-error-boundary';
import { GrowthChart } from '@/components/admin/charts/growth-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getAdminStats, getGrowthStats } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

export default function AdminDashboard() {
  const [growthRange, setGrowthRange] = useState<'7d' | '30d'>('7d');

  // Query for admin stats (adaptive polling: backs off on consecutive errors)
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError
  } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: getAdminStats,
    staleTime: 30_000,
    refetchInterval: (query) => {
      if (query.state.error) {
        // Double the interval on each consecutive failure, cap at 2 min
        const failures = query.state.errorUpdateCount ?? 1;
        return Math.min(30_000 * 2 ** failures, 120_000);
      }
      return 30_000;
    },
    refetchIntervalInBackground: false
  });

  // Query for growth stats (reactive to range change)
  const {
    data: growthStats,
    isLoading: growthLoading,
    error: growthError
  } = useQuery({
    queryKey: ['admin', 'growth', growthRange],
    queryFn: () => getGrowthStats(growthRange),
    staleTime: 60_000,
    refetchInterval: (query) => {
      if (query.state.error) {
        const failures = query.state.errorUpdateCount ?? 1;
        return Math.min(60_000 * 2 ** failures, 300_000);
      }
      return 60_000;
    },
    refetchIntervalInBackground: false
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      </div>

      {/* Global Stats */}
      {statsLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
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
              Erro ao carregar estatísticas. Tente novamente.
            </p>
          </CardContent>
        </Card>
      ) : stats ? (
        <StatsCards stats={stats} />
      ) : null}

      {/* Growth Analytics */}
      <AnalyticsErrorBoundary fallbackTitle="Crescimento da Plataforma">
        <Card>
          <CardHeader>
            <CardTitle>Crescimento da Plataforma</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs
              value={growthRange}
              onValueChange={(v) => setGrowthRange(v as '7d' | '30d')}
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
                    Erro ao carregar dados de crescimento
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

      {/* Performance Metrics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Performance</CardTitle>
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
