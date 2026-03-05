// src/components/admin/charts/growth-chart.tsx
'use client';

import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

interface GrowthData {
  date: string;
  clicks: number;
  newUsers: number;
}

interface GrowthChartProps {
  data: GrowthData[];
  height?: number;
}

export function GrowthChart({ data, height = 300 }: GrowthChartProps) {
  // Memoize chart data to prevent unnecessary recalculations
  const chartData = useMemo(
    () =>
      data.map((item) => ({
        date: new Date(item.date).toLocaleDateString('pt-BR', {
          month: 'short',
          day: 'numeric'
        }),
        Cliques: item.clicks,
        'Novos Usuários': item.newUsers
      })),
    [data]
  );

  // Calculate percentage changes
  const stats = useMemo(() => {
    if (data.length < 2) {
      return {
        clicksChange: 0,
        usersChange: 0,
        totalClicks: data[0]?.clicks || 0,
        totalUsers: data[0]?.newUsers || 0
      };
    }

    const recentPeriod = data.slice(-7);
    const previousPeriod = data.slice(-14, -7);

    const recentClicks = recentPeriod.reduce(
      (sum, item) => sum + item.clicks,
      0
    );
    const previousClicks = previousPeriod.reduce(
      (sum, item) => sum + item.clicks,
      0
    );
    const recentUsers = recentPeriod.reduce(
      (sum, item) => sum + item.newUsers,
      0
    );
    const previousUsers = previousPeriod.reduce(
      (sum, item) => sum + item.newUsers,
      0
    );

    const clicksChange =
      previousClicks > 0
        ? ((recentClicks - previousClicks) / previousClicks) * 100
        : 0;
    const usersChange =
      previousUsers > 0
        ? ((recentUsers - previousUsers) / previousUsers) * 100
        : 0;

    return {
      clicksChange: Math.round(clicksChange),
      usersChange: Math.round(usersChange),
      totalClicks: data.reduce((sum, item) => sum + item.clicks, 0),
      totalUsers: data.reduce((sum, item) => sum + item.newUsers, 0)
    };
  }, [data]);

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              Total de Cliques
            </p>
            {stats.clicksChange !== 0 && (
              <span
                className={`text-xs font-medium ${
                  stats.clicksChange > 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {stats.clicksChange > 0 ? '↑' : '↓'}{' '}
                {Math.abs(stats.clicksChange)}%
              </span>
            )}
          </div>
          <p className="mt-2 text-2xl font-bold">
            {stats.totalClicks.toLocaleString('pt-BR')}
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              Novos Usuários
            </p>
            {stats.usersChange !== 0 && (
              <span
                className={`text-xs font-medium ${
                  stats.usersChange > 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {stats.usersChange > 0 ? '↑' : '↓'}{' '}
                {Math.abs(stats.usersChange)}%
              </span>
            )}
          </div>
          <p className="mt-2 text-2xl font-bold">
            {stats.totalUsers.toLocaleString('pt-BR')}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div
        style={{ height }}
        role="img"
        aria-label="Gráfico de crescimento de cliques e usuários"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="hsl(var(--primary))"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="hsl(var(--primary))"
                  stopOpacity={0}
                />
              </linearGradient>
              <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="hsl(var(--chart-2))"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="hsl(var(--chart-2))"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
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
            <Area
              type="monotone"
              dataKey="Cliques"
              stroke="hsl(var(--primary))"
              fillOpacity={1}
              fill="url(#colorClicks)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="Novos Usuários"
              stroke="hsl(var(--chart-2))"
              fillOpacity={1}
              fill="url(#colorUsers)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
