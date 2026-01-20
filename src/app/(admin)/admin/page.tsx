// src/app/(admin)/admin/page.tsx

import { headers } from 'next/headers';
import { StatsCards } from '@/components/admin';
import { AnalyticsErrorBoundary } from '@/components/admin/analytics-error-boundary';
import { GrowthChart } from '@/components/admin/charts/growth-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  convertHeadersForApiClient,
  getAdminStatsSSR,
  getGrowthStatsSSR
} from '@/lib/api-client';

// Force dynamic rendering for authenticated pages
export const dynamic = 'force-dynamic';

async function fetchAdminStats() {
  try {
    const requestHeaders = await headers();
    const headersObj = convertHeadersForApiClient(requestHeaders);

    return await getAdminStatsSSR(headersObj);
  } catch (error) {
    console.error('Failed to fetch admin stats:', error);
    // Return fallback data
    return {
      totalLinks: 0,
      totalClicks: 0,
      totalUsers: 0,
      activeLinksToday: 0,
      requestsPerSecond: 0
    };
  }
}

async function fetchGrowthStats(range: '7d' | '30d' = '7d') {
  try {
    const requestHeaders = await headers();
    const headersObj = convertHeadersForApiClient(requestHeaders);

    return await getGrowthStatsSSR(headersObj, range);
  } catch (error) {
    console.error('Failed to fetch growth stats:', error);
    // Return empty array as fallback
    return [];
  }
}

export default async function AdminDashboard() {
  const [stats, growthStats7d, growthStats30d] = await Promise.all([
    fetchAdminStats(),
    fetchGrowthStats('7d'),
    fetchGrowthStats('30d')
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      </div>

      {/* Global Stats */}
      <StatsCards stats={stats} />

      {/* Growth Analytics */}
      <AnalyticsErrorBoundary fallbackTitle="Crescimento da Plataforma">
        <Card>
          <CardHeader>
            <CardTitle>Crescimento da Plataforma</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="7d" className="space-y-4">
              <TabsList>
                <TabsTrigger value="7d">Últimos 7 dias</TabsTrigger>
                <TabsTrigger value="30d">Últimos 30 dias</TabsTrigger>
              </TabsList>
              <TabsContent value="7d">
                {growthStats7d.length > 0 ? (
                  <GrowthChart data={growthStats7d} />
                ) : (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    Nenhum dado disponível
                  </div>
                )}
              </TabsContent>
              <TabsContent value="30d">
                {growthStats30d.length > 0 ? (
                  <GrowthChart data={growthStats30d} />
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
                <span className="font-medium">{stats.requestsPerSecond}</span>
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
