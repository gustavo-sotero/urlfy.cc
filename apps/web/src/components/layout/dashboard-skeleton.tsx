// src/components/layout/dashboard-skeleton.tsx
import { Skeleton } from '@/components/ui/skeleton';

const DASHBOARD_STAT_SKELETON_KEYS = [
  'dashboard-stat-1',
  'dashboard-stat-2',
  'dashboard-stat-3',
  'dashboard-stat-4'
] as const;

const DASHBOARD_CONTENT_SKELETON_KEYS = [
  'dashboard-content-1',
  'dashboard-content-2',
  'dashboard-content-3'
] as const;

interface DashboardSkeletonProps {
  ariaLabel?: string;
}

export function DashboardSkeleton({
  ariaLabel = 'Loading dashboard'
}: DashboardSkeletonProps) {
  return (
    <div
      className="space-y-6"
      role="status"
      aria-busy="true"
      aria-label={ariaLabel}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {DASHBOARD_STAT_SKELETON_KEYS.map((key) => (
          <div key={key} className="rounded-lg border p-6">
            <Skeleton className="mb-2 h-4 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>

      {/* Content Area */}
      <div className="space-y-4">
        {DASHBOARD_CONTENT_SKELETON_KEYS.map((key) => (
          <Skeleton key={key} className="h-32 w-full" />
        ))}
      </div>
    </div>
  );
}
