// src/components/shared/link-card-skeleton.tsx
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function buildSkeletonKeys(count: number): string[] {
  const keys: string[] = [];
  let seed = 'a';

  while (keys.length < count) {
    keys.push(`link-skeleton-${seed}`);
    seed += 'a';
  }

  return keys;
}

interface LinkCardSkeletonProps {
  ariaLabel?: string;
}

export function LinkCardSkeleton({
  ariaLabel = 'Loading link...'
}: LinkCardSkeletonProps) {
  return (
    <Card className="p-4" aria-busy="true" aria-label={ariaLabel}>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
    </Card>
  );
}

export function LinkListSkeleton({
  count = 5,
  ariaLabel = 'Loading links'
}: {
  count?: number;
  ariaLabel?: string;
}) {
  const keys = buildSkeletonKeys(count);

  return (
    <div className="space-y-4" role="status" aria-label={ariaLabel}>
      {keys.map((key) => (
        <LinkCardSkeleton key={key} />
      ))}
    </div>
  );
}
