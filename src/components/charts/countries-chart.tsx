// src/components/charts/countries-chart.tsx
"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7c7c",
];

interface Props {
  data: Array<{
    code?: string;
    country?: string;
    name?: string;
    countryName?: string;
    clicks: number;
  }>;
}

export function CountriesChart({ data }: Props) {
  // Take top 10 countries and normalize data structure
  const topCountries = data.slice(0, 10).map((item) => ({
    country: item.country || item.code || "",
    countryName:
      item.countryName || item.name || item.country || item.code || "Unknown",
    clicks: item.clicks,
  }));

  return (
    <div className="h-100">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={topCountries}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis dataKey="countryName" type="category" width={70} />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
            labelStyle={{ color: "hsl(var(--foreground))" }}
          />
          <Bar dataKey="clicks" radius={[0, 4, 4, 0]}>
            {topCountries.map((entry, index) => (
              <Cell
                key={`cell-${entry.country}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
