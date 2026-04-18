// src/components/charts/devices-chart.tsx
'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useIsMobile } from '@/lib/hooks/use-mobile';

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
  const isMobile = useIsMobile();

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
        percentage: item.percentage,
        type: item.type
      })),
    [data, deviceLabels]
  );

  return (
    <div
      className="space-y-4"
      role="img"
      aria-label={`${chartData.map((d) => `${d.name}: ${d.value}`).join(', ')}`}
    >
      {chartData.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          {t('charts.noData')}
        </div>
      ) : (
        <>
          <div className="h-56 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={isMobile ? 68 : 84}
                  innerRadius={isMobile ? 34 : 46}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={`cell-${entry.type}`}
                      fill={
                        COLORS[entry.type as keyof typeof COLORS] ??
                        COLORS.desktop
                      }
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [value ?? 0, t('charts.clicks')]}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            {chartData.map((entry) => (
              <div
                key={entry.type}
                className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{
                      backgroundColor:
                        COLORS[entry.type as keyof typeof COLORS] ??
                        COLORS.desktop
                    }}
                  />
                  <span className="text-sm font-medium">{entry.name}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {entry.value} • {entry.percentage.toFixed(1)}%
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
