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

  // Take top 8 referrers and normalize data structure
  const topReferrers = data.slice(0, 8).map((item) => ({
    referrer: item.referrer || item.domain || 'Direct',
    clicks: item.clicks
  }));

  if (topReferrers.length === 0) {
    return (
      <div className="flex h-75 items-center justify-center text-muted-foreground">
        {t('noData')}
      </div>
    );
  }

  return (
    <div className="h-75" role="img" aria-label={t('topReferrers')}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={topReferrers}
          margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="referrer"
            angle={-45}
            textAnchor="end"
            height={80}
            interval={0}
          />
          <YAxis />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px'
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
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
