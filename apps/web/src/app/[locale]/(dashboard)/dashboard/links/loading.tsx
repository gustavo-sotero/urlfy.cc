import { getTranslations } from 'next-intl/server';
import { LinkListSkeleton } from '@/components/shared/link-card-skeleton';

export default async function LinksLoading() {
  const tCommon = await getTranslations('Common');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="h-9 w-32 animate-pulse rounded bg-muted" />
          <div className="h-5 w-64 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-10 w-28 animate-pulse rounded bg-muted" />
      </div>
      <LinkListSkeleton count={5} ariaLabel={tCommon('loadingLinks')} />
    </div>
  );
}
