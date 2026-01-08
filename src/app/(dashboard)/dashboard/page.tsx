// src/app/(dashboard)/dashboard/page.tsx

import { Link as LinkIcon, MousePointer, TrendingUp } from "lucide-react";
import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Visão geral dos seus links e estatísticas
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Suspense fallback={<StatsCardSkeleton />}>
          <StatsCards />
        </Suspense>
      </div>

      {/* Recent Links */}
      <Card>
        <CardHeader>
          <CardTitle>Links Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Seus links mais recentes aparecerão aqui
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

async function StatsCards() {
  // TODO: Fetch real stats from API
  const stats = {
    totalLinks: 0,
    totalClicks: 0,
    clicksToday: 0,
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total de Links</CardTitle>
          <LinkIcon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalLinks}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Total de Cliques
          </CardTitle>
          <MousePointer className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalClicks}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Cliques Hoje</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.clicksToday}</div>
        </CardContent>
      </Card>
    </>
  );
}

function StatsCardSkeleton() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </>
  );
}
