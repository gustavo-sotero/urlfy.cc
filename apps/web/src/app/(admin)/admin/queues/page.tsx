/**
 * Admin Queues Dashboard
 * Real-time monitoring of Redis Streams
 */

'use client';

import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import type { StreamStats } from '@/lib/api';
import { useQueueStats } from '@/lib/hooks';

export default function AdminQueuesPage() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { data, isLoading, error, refetch, isFetching } =
    useQueueStats(autoRefresh);

  const getHealthStatus = (stats: StreamStats) => {
    if (stats.degraded) {
      return {
        label: 'Degradado',
        variant: 'destructive' as const,
        icon: AlertCircle
      };
    }

    const pending = stats.pending ?? 0;

    if (pending > 100) {
      return {
        label: 'Alta Carga',
        variant: 'destructive' as const,
        icon: AlertCircle
      };
    }

    if (pending > 10) {
      return {
        label: 'Ativo',
        variant: 'default' as const,
        icon: AlertCircle
      };
    }

    return {
      label: 'Saudável',
      variant: 'secondary' as const,
      icon: CheckCircle2
    };
  };

  const handleRefresh = () => {
    refetch();
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh((prev) => !prev);
  };

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center min-h-100">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-100 gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-lg font-medium">
          Falha ao carregar estatísticas das filas
        </p>
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <Button onClick={handleRefresh}>Tentar novamente</Button>
      </div>
    );
  }

  const streams = data ? Object.values(data.data) : [];
  const isDegraded = data?.degraded === true;
  const totalLength = streams.reduce((sum, s) => sum + s.length, 0);
  const totalPending = streams.reduce((sum, s) => sum + (s.pending ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Monitoramento de Filas
          </h1>
          <p className="text-muted-foreground mt-1">
            Saúde e estatísticas em tempo real dos Redis Streams
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={toggleAutoRefresh}>
            {autoRefresh ? 'Desativar' : 'Ativar'} atualização automática
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`}
            />
            Atualizar
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium">
              Erro ao carregar dados mais recentes
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {error.message}
            </p>
          </div>
        </div>
      )}

      {isDegraded && (
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
              Estatísticas parciais por indisponibilidade do Redis
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Alguns streams retornaram valores de fallback. Os números exibidos
              podem estar incompletos até a recuperação da dependência.
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Total de Mensagens
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalLength.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Em {streams.length} streams{isDegraded ? ' (parcial)' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalPending.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Mensagens em processamento{isDegraded ? ' (parcial)' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Grupos de Consumidores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {streams.reduce((sum, s) => sum + s.groups, 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Grupos consumidores ativos{isDegraded ? ' (parcial)' : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Streams Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhes dos Streams</CardTitle>
          <CardDescription>
            Estatísticas detalhadas de cada Redis Stream
            {isDegraded ? ' com sinalização explícita de degradação' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stream</TableHead>
                <TableHead className="text-right">Tamanho</TableHead>
                <TableHead className="text-right">Grupos</TableHead>
                <TableHead className="text-right">Pendentes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden xl:table-cell">
                  Último ID
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {streams.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    Nenhum stream encontrado
                  </TableCell>
                </TableRow>
              ) : (
                streams.map((stream) => {
                  const health = getHealthStatus(stream);
                  const StatusIcon = health.icon;

                  return (
                    <TableRow key={stream.name}>
                      <TableCell className="font-medium">
                        {stream.name}
                      </TableCell>
                      <TableCell className="text-right">
                        {stream.length.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {stream.groups}
                      </TableCell>
                      <TableCell className="text-right">
                        {(stream.pending ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={health.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {health.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell font-mono text-xs text-muted-foreground">
                        {stream.lastGeneratedId || 'N/D'}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Auto-refresh indicator */}
      {autoRefresh && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          Atualizando automaticamente a cada 15 segundos
        </div>
      )}
    </div>
  );
}
