// src/components/charts/clicks-chart.tsx
'use client';

import type { DailyStats } from '@/types/analytics.types';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

interface Props {
  data: DailyStats[];
}

export function ClicksChart({ data }: Props) {
  const chartData = data.map((item) => ({
    date: new Date(item.date).toLocaleDateString('pt-BR', {
      month: 'short',
      day: 'numeric'
    }),
    Cliques: item.clicks,
    'Visitantes Únicos': item.uniqueVisitors
  }));

  return (
    <div className="h-75">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            className="text-xs"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis
            className="text-xs"
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px'
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="Cliques"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="Visitantes Únicos"
            stroke="hsl(var(--chart-2))"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
