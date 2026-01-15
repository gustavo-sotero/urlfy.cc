// src/components/layout/dashboard-skeleton.tsx
import { Skeleton } from '@/components/ui/skeleton';

export function DashboardSkeleton() {
  return (
    <div
      className="space-y-6"
      role="status"
      aria-busy="true"
      aria-label="Carregando dashboard"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={`dashboard-stat-${i}`} className="rounded-lg border p-6">
            <Skeleton className="mb-2 h-4 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>

      {/* Content Area */}
      <div className="space-y-4">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={`dashboard-content-${i}`} className="h-32 w-full" />
        ))}
      </div>
    </div>
  );
}
