import { DashboardSkeleton } from '@/components/layout/dashboard-skeleton';
import { getTranslations } from 'next-intl/server';

export default async function DashboardLoading() {
  const tCommon = await getTranslations('Common');

  return <DashboardSkeleton ariaLabel={tCommon('loadingDashboard')} />;
}
