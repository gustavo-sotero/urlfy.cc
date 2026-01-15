// src/app/(admin)/admin/page.tsx

import { StatsCards } from '@/components/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAdminStats } from '@/lib/api-client';

async function fetchAdminStats() {
  try {
    return await getAdminStats();
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

export default async function AdminDashboard() {
  const stats = await fetchAdminStats();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      </div>

      <StatsCards stats={stats} />

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
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
