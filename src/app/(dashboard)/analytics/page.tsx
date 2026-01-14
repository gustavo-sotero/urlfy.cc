// src/app/(dashboard)/analytics/page.tsx
"use client";

import { BarChart2, MousePointer, TrendingUp, Users } from "lucide-react";
import { useMemo, useState } from "react";
import {
  ChartSkeleton,
  StatsGridSkeleton,
} from "@/components/charts/analytics-skeleton";
import { ClicksChart } from "@/components/charts/clicks-chart";
import { CountriesChart } from "@/components/charts/countries-chart";
import { DevicesChart } from "@/components/charts/devices-chart";
import { ReferrersChart } from "@/components/charts/referrers-chart";
import { QueryError } from "@/components/query-error";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAnalyticsBreakdown,
  useAnalyticsSummary,
  useDailyStats,
} from "@/lib/hooks/use-analytics";
import { useLinks } from "@/lib/hooks/use-links";

export default function AnalyticsPage() {
  const [selectedLinkId, setSelectedLinkId] = useState<string>("");
  const [days, setDays] = useState("30");

  // Get user's links
  const { data: linksData, isLoading: linksLoading } = useLinks({
    perPage: 100,
  });

  // Fetch real analytics data
  const {
    data: dailyData,
    isLoading: dailyLoading,
    isError: dailyError,
    error: dailyErrorDetails,
    refetch: refetchDaily,
  } = useDailyStats(selectedLinkId || "all", Number.parseInt(days, 10), {
    enabled: !linksLoading,
  });

  const { data: summaryData, isLoading: summaryLoading } = useAnalyticsSummary(
    selectedLinkId || "all",
    {
      enabled: !linksLoading,
    },
  );

  const { data: breakdownData, isLoading: breakdownLoading } =
    useAnalyticsBreakdown(selectedLinkId || "all", {
      enabled: !linksLoading,
    });

  // Compute totals from daily data or use summary
  const totalClicks = useMemo(() => {
    if (summaryData?.totalClicks) return summaryData.totalClicks;
    if (!dailyData) return 0;
    return dailyData.reduce((acc, day) => acc + day.clicks, 0);
  }, [dailyData, summaryData]);

  const totalVisitors = useMemo(() => {
    if (summaryData?.uniqueVisitors) return summaryData.uniqueVisitors;
    if (!dailyData) return 0;
    return dailyData.reduce((acc, day) => acc + day.uniqueVisitors, 0);
  }, [dailyData, summaryData]);

  const isLoading = linksLoading || dailyLoading || summaryLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
          <p className="text-muted-foreground">
            Visão geral do desempenho dos seus links
          </p>
        </div>
        <StatsGridSkeleton />
        <div className="grid gap-4 md:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
    );
  }

  if (dailyError) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
          <p className="text-muted-foreground">
            Visão geral do desempenho dos seus links
          </p>
        </div>
        <QueryError
          error={dailyErrorDetails as Error}
          onRetry={() => refetchDaily()}
          title="Erro ao carregar analytics"
        />
      </div>
    );
  }

  // Prepare chart data with fallback to empty arrays
  const chartDailyData = dailyData || [];
  const chartCountriesData = breakdownData?.countries || [];
  const chartDevicesData = breakdownData?.devices || [];
  const chartReferrersData = breakdownData?.referrers || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
          <p className="text-muted-foreground">
            Visão geral do desempenho dos seus links
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedLinkId} onValueChange={setSelectedLinkId}>
            <SelectTrigger className="w-50">
              <SelectValue placeholder="Todos os links" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos os links</SelectItem>
              {linksData?.data.map((link) => (
                <SelectItem key={link.id} value={link.id}>
                  {link.shortCode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Cliques
            </CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalClicks.toLocaleString("pt-BR")}
            </div>
            <p className="text-xs text-muted-foreground">
              +12% em relação ao período anterior
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Visitantes Únicos
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalVisitors.toLocaleString("pt-BR")}
            </div>
            <p className="text-xs text-muted-foreground">
              +8% em relação ao período anterior
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Taxa de Conversão
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalClicks > 0
                ? ((totalVisitors / totalClicks) * 100).toFixed(1)
                : "0.0"}
              %
            </div>
            <p className="text-xs text-muted-foreground">
              Visitantes únicos / Total de cliques
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Links Ativos</CardTitle>
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {linksData?.data.filter((l) => l.isActive).length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              de {linksData?.meta.total || 0} links totais
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Cliques ao longo do tempo</CardTitle>
          </CardHeader>
          <CardContent>
            {chartDailyData.length > 0 ? (
              <ClicksChart data={chartDailyData} />
            ) : (
              <p className="py-8 text-center text-muted-foreground">
                Nenhum dado disponível para o período selecionado
              </p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Países</CardTitle>
            </CardHeader>
            <CardContent>
              {breakdownLoading ? (
                <ChartSkeleton />
              ) : chartCountriesData.length > 0 ? (
                <CountriesChart data={chartCountriesData} />
              ) : (
                <p className="py-8 text-center text-muted-foreground">
                  Nenhum dado disponível
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dispositivos</CardTitle>
            </CardHeader>
            <CardContent>
              {breakdownLoading ? (
                <ChartSkeleton />
              ) : chartDevicesData.length > 0 ? (
                <DevicesChart data={chartDevicesData} />
              ) : (
                <p className="py-8 text-center text-muted-foreground">
                  Nenhum dado disponível
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Referrers</CardTitle>
          </CardHeader>
          <CardContent>
            {breakdownLoading ? (
              <ChartSkeleton />
            ) : chartReferrersData.length > 0 ? (
              <ReferrersChart data={chartReferrersData} />
            ) : (
              <p className="py-8 text-center text-muted-foreground">
                Nenhum dado disponível
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
