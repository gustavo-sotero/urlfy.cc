// src/components/charts/devices-chart.tsx
'use client';

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
  const chartData = data.map((item) => ({
    name:
      item.type === 'desktop'
        ? 'Desktop'
        : item.type === 'mobile'
        ? 'Mobile'
        : 'Tablet',
    value: item.clicks
  }));

  return (
    <div className="h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) =>
              `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`
            }
            outerRadius={80}
            fill="hsl(var(--primary))"
            dataKey="value"
          >
            {chartData.map((_entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={
                  COLORS[data[index]?.type as keyof typeof COLORS] ??
                  COLORS.desktop
                }
              />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
