/**
 * Admin Queues Dashboard
 * Real-time monitoring of Redis Streams
 */

'use client';

import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
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
import { apiClient } from '@/lib/api-client';

interface StreamStats {
  name: string;
  length: number;
  groups: number;
  consumers?: number;
  pending?: number;
  lastGeneratedId?: string;
}

type QueuesData = Record<string, StreamStats>;

export default function AdminQueuesPage() {
  const [data, setData] = useState<QueuesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchQueueStats = useCallback(async () => {
    try {
      setError(null);
      const response = await apiClient.get('/api/admin/queues');

      if (response.success) {
        setData(response.data);
      } else {
        setError(response.error?.message || 'Failed to load queue stats');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array since it only uses setState
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchQueueStats();
    }, 5000); // Auto-refresh every 5s

    return () => clearInterval(interval);
  }, [autoRefresh, fetchQueueStats]);

  const getHealthStatus = (stats: StreamStats) => {
    const pending = stats.pending ?? 0;

    if (pending > 100) {
      return {
        label: 'High Load',
        variant: 'destructive' as const,
        icon: AlertCircle
      };
    }

    if (pending > 10) {
      return {
        label: 'Active',
        variant: 'default' as const,
        icon: AlertCircle
      };
    }

    return {
      label: 'Healthy',
      variant: 'secondary' as const,
      icon: CheckCircle2
    };
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchQueueStats();
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };

  if (loading && !data) {
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
        <p className="text-lg font-medium">Failed to load queue stats</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button onClick={handleRefresh}>Try Again</Button>
      </div>
    );
  }

  const streams = data ? Object.values(data) : [];
  const totalLength = streams.reduce((sum, s) => sum + s.length, 0);
  const totalPending = streams.reduce((sum, s) => sum + (s.pending ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Queue Monitoring
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time Redis Streams health and statistics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={toggleAutoRefresh}>
            {autoRefresh ? 'Disable' : 'Enable'} Auto-Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium">Error loading latest data</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Total Messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalLength.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {streams.length} streams
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalPending.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Messages being processed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Consumer Groups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {streams.reduce((sum, s) => sum + s.groups, 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Active consumer groups
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Streams Table */}
      <Card>
        <CardHeader>
          <CardTitle>Stream Details</CardTitle>
          <CardDescription>
            Detailed statistics for each Redis Stream
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stream</TableHead>
                <TableHead className="text-right">Length</TableHead>
                <TableHead className="text-right">Groups</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden xl:table-cell">Last ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {streams.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    No streams found
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
                        {stream.lastGeneratedId || 'N/A'}
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
          Auto-refreshing every 5 seconds
        </div>
      )}
    </div>
  );
}
