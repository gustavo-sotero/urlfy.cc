// src/components/charts/devices-chart.tsx
'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip
} from 'recharts';

const COLORS = {
  desktop: 'hsl(var(--chart-1))',
  mobile: 'hsl(var(--chart-2))',
  tablet: 'hsl(var(--chart-3))'
};

interface Props {
  data: Array<{ type: string; clicks: number; percentage: number }>;
}

export function DevicesChart({ data }: Props) {
  const t = useTranslations('Analytics');

  const deviceLabels = useMemo(
    () => ({
      desktop: t('devices.desktop'),
      mobile: t('devices.mobile'),
      tablet: t('devices.tablet')
    }),
    [t]
  );

  // Memoize chart data transformation
  const chartData = useMemo(
    () =>
      data.map((item) => ({
        name: deviceLabels[item.type as keyof typeof deviceLabels] ?? item.type,
        value: item.clicks,
        type: item.type
      })),
    [data, deviceLabels]
  );

  return (
    <div
      className="h-[220px] sm:h-[250px]"
      role="img"
      aria-label={`${chartData.map((d) => `${d.name}: ${d.value}`).join(', ')}`}
    >
      {chartData.length === 0 ? (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          {t('charts.noData')}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              outerRadius={70}
              fill="hsl(var(--primary))"
              dataKey="value"
            >
              {chartData.map((entry) => (
                <Cell
                  key={`cell-${entry.type}`}
                  fill={
                    COLORS[entry.type as keyof typeof COLORS] ?? COLORS.desktop
                  }
                />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
