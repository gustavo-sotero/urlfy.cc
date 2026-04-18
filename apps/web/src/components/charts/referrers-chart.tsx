// src/components/charts/referrers-chart.tsx
'use client';

import { useTranslations } from 'next-intl';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { useIsMobile } from '@/lib/hooks/use-mobile';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

interface Props {
  data: Array<{
    referrer?: string;
    domain?: string;
    clicks: number;
  }>;
}

export function ReferrersChart({ data }: Props) {
  const t = useTranslations('Analytics.charts');
  const isMobile = useIsMobile();

  const topReferrers = data.slice(0, isMobile ? 5 : 8).map((item) => ({
    referrer: item.referrer || item.domain || 'Direct',
    clicks: item.clicks
  }));

  if (topReferrers.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-muted-foreground sm:h-80">
        {t('noData')}
      </div>
    );
  }

  const truncate = (value: string, max = isMobile ? 10 : 14) =>
    value.length > max ? `${value.slice(0, max)}…` : value;

  return (
    <div className="h-72 sm:h-80" role="img" aria-label={t('topReferrers')}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={topReferrers}
          margin={{
            top: 5,
            right: isMobile ? 12 : 20,
            left: isMobile ? 0 : 10,
            bottom: isMobile ? 78 : 70
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="referrer"
            angle={-45}
            textAnchor="end"
            height={80}
            interval={0}
            tick={{ fontSize: 11 }}
            tickFormatter={(v: string) => truncate(v)}
            tickMargin={10}
          />
          <YAxis tick={{ fontSize: 11 }} width={isMobile ? 28 : 36} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px'
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
            formatter={(value) => [value ?? 0, t('clicks')]}
          />
          <Bar dataKey="clicks" radius={[4, 4, 0, 0]}>
            {topReferrers.map((entry, index) => (
              <Cell
                key={`cell-${entry.referrer}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
