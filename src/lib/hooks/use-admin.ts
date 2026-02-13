// src/lib/hooks/use-admin.ts
/**
 * React Query hooks for admin operations
 */

import * as api from '@/lib/api-client';
import type { LinkResponse, PaginatedResponse } from '@/types/links.types';
import {
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query';
import { linkKeys } from './use-links';

// ═══════════════════════════════════════════════════════════════════
// QUERY KEYS
// ═══════════════════════════════════════════════════════════════════

export const adminKeys = {
  all: ['admin'] as const,
  stats: () => [...adminKeys.all, 'stats'] as const,
  queues: () => [...adminKeys.all, 'queues'] as const,
  links: (params?: { page?: number; limit?: number; search?: string }) =>
    [...adminKeys.all, 'links', params] as const,
  search: (query: string) => [...adminKeys.all, 'search', query] as const,
  auditLogs: (filters: api.AuditLogsQuery) =>
    [...adminKeys.all, 'audit', filters] as const,
  users: (filters: { page?: number; perPage?: number; search?: string }) =>
    [...adminKeys.all, 'users', filters] as const
};

// ═══════════════════════════════════════════════════════════════════
// QUERIES
// ═══════════════════════════════════════════════════════════════════

export function useAdminStats(
  options?: Omit<
    UseQueryOptions<{
      totalLinks: number;
      totalClicks: number;
      totalUsers: number;
      activeLinksToday: number;
      requestsPerSecond: number;
    }>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: adminKeys.stats(),
    queryFn: () => api.getAdminStats(),
    staleTime: 30_000, // 30 seconds
    ...options
  });
}

export function useQueueStats(autoRefresh = true) {
  return useQuery({
    queryKey: adminKeys.queues(),
    queryFn: () => api.getQueueStats(),
    staleTime: 5_000,
    refetchInterval: autoRefresh ? 5_000 : false
  });
}

export function useAdminLinks(
  params?: { page?: number; limit?: number; search?: string },
  options?: Omit<
    UseQueryOptions<PaginatedResponse<LinkResponse>>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: adminKeys.links(params),
    queryFn: () => api.listAdminLinks(params),
    staleTime: 30_000,
    ...options
  });
}

export function useSearchLinks(
  query: string,
  options?: Omit<UseQueryOptions<LinkResponse[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: adminKeys.search(query),
    queryFn: () => api.searchLinks(query),
    staleTime: 10_000, // 10 seconds
    enabled: query.length > 0,
    ...options
  });
}

// ═══════════════════════════════════════════════════════════════════
// MUTATIONS
// ═══════════════════════════════════════════════════════════════════

export function useBanLink(
  options?: UseMutationOptions<void, Error, { id: string; reason: string }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.banLink(id, reason),
    onSuccess: (_data, variables) => {
      // Invalidate lists and search results
      queryClient.invalidateQueries({ queryKey: linkKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: linkKeys.detail(variables.id)
      });
      queryClient.invalidateQueries({ queryKey: adminKeys.all });
    },
    ...options
  });
}

export function useUnbanLink(
  options?: UseMutationOptions<void, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.unbanLink(id),
    onSuccess: (_data, id) => {
      // Invalidate lists and search results
      queryClient.invalidateQueries({ queryKey: linkKeys.lists() });
      queryClient.invalidateQueries({ queryKey: linkKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: adminKeys.all });
    },
    ...options
  });
}

// ═══════════════════════════════════════════════════════════════════
// AUDIT LOGS
// ═══════════════════════════════════════════════════════════════════

export function useAuditLogs(
  filters: api.AuditLogsQuery = {},
  options?: Omit<
    UseQueryOptions<PaginatedResponse<api.AuditLogEntry>>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: adminKeys.auditLogs(filters),
    queryFn: () => api.getAuditLogs(filters),
    staleTime: 30_000, // 30 seconds
    ...options
  });
}

// ═══════════════════════════════════════════════════════════════════
// USERS MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

export function useUsers(
  filters: { page?: number; perPage?: number; search?: string } = {},
  options?: Omit<
    UseQueryOptions<PaginatedResponse<api.UserResponse>>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: adminKeys.users(filters),
    queryFn: () => api.getUsers(filters),
    staleTime: 30_000, // 30 seconds
    ...options
  });
}

export function useUpdateUserRole(
  options?: UseMutationOptions<
    api.UserResponse,
    Error,
    { userId: string; role: string }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.updateUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users({}) });
    },
    ...options
  });
}

export function useBanUser(
  options?: UseMutationOptions<api.UserResponse, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => api.banUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users({}) });
    },
    ...options
  });
}

export function useUnbanUser(
  options?: UseMutationOptions<api.UserResponse, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => api.unbanUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users({}) });
    },
    ...options
  });
}
