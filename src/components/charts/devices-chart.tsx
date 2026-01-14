// src/components/charts/devices-chart.tsx
"use client";

import { useMemo } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const COLORS = {
  desktop: "hsl(var(--chart-1))",
  mobile: "hsl(var(--chart-2))",
  tablet: "hsl(var(--chart-3))",
};

interface Props {
  data: Array<{ type: string; clicks: number; percentage: number }>;
}

export function DevicesChart({ data }: Props) {
  // Memoize chart data transformation
  const chartData = useMemo(
    () =>
      data.map((item) => ({
        name:
          item.type === "desktop"
            ? "Desktop"
            : item.type === "mobile"
              ? "Mobile"
              : "Tablet",
        value: item.clicks,
        type: item.type,
      })),
    [data],
  );

  return (
    <div
      className="h-62.5"
      role="img"
      aria-label="Gráfico de distribuição por dispositivo"
    >
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
    </div>
  );
}
