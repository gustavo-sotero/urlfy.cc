import { getTranslations } from 'next-intl/server';
import { DashboardSkeleton } from '@/components/layout/dashboard-skeleton';

export default async function DashboardLoading() {
  const tCommon = await getTranslations('Common');

  return <DashboardSkeleton ariaLabel={tCommon('loadingDashboard')} />;
}
