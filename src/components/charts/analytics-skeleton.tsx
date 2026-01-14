// src/components/charts/analytics-skeleton.tsx
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ChartSkeleton() {
  return (
    <Card className="p-6" aria-busy="true">
      <Skeleton className="h-75 w-full" />
    </Card>
  );
}

export function StatsGridSkeleton() {
  return (
    <div
      className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      role="status"
      aria-label="Carregando estatísticas"
    >
      {Array.from({ length: 4 }, (_, i) => (
        <Card key={`stats-${i}`} className="p-6">
          <Skeleton className="mb-2 h-4 w-20" />
          <Skeleton className="h-8 w-24" />
        </Card>
      ))}
    </div>
  );
}

export function AnalyticsDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <StatsGridSkeleton />
      <div className="grid gap-4 md:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    </div>
  );
}
