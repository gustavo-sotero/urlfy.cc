// src/lib/hooks/use-links.ts
/**
 * React Query hooks for link management
 */

import {
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import * as api from "@/lib/api-client";
import type {
  CreateLinkInput,
  LinkResponse,
  ListLinksQuery,
  PaginatedResponse,
  UpdateLinkInput,
} from "@/types/links.types";

// ═══════════════════════════════════════════════════════════════════
// QUERY KEYS
// ═══════════════════════════════════════════════════════════════════

export const linkKeys = {
  all: ["links"] as const,
  lists: () => [...linkKeys.all, "list"] as const,
  list: (filters: ListLinksQuery) => [...linkKeys.lists(), filters] as const,
  details: () => [...linkKeys.all, "detail"] as const,
  detail: (id: string) => [...linkKeys.details(), id] as const,
  stats: (id: string) => [...linkKeys.all, "stats", id] as const,
  quota: () => ["quota"] as const,
};

// ═══════════════════════════════════════════════════════════════════
// QUERIES
// ═══════════════════════════════════════════════════════════════════

export function useLinks(
  filters: ListLinksQuery = {},
  options?: Omit<
    UseQueryOptions<PaginatedResponse<LinkResponse>>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: linkKeys.list(filters),
    queryFn: () => api.getLinks(filters),
    staleTime: 30_000, // 30 seconds
    ...options,
  });
}

export function useLink(
  id: string,
  options?: Omit<UseQueryOptions<LinkResponse>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: linkKeys.detail(id),
    queryFn: () => api.getLink(id),
    staleTime: 60_000, // 1 minute
    enabled: !!id,
    ...options,
  });
}

export function useLinkStats(
  id: string,
  options?: Omit<
    UseQueryOptions<{
      clicks: number;
      uniqueVisitors: number;
      lastClickedAt: string | null;
    }>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: linkKeys.stats(id),
    queryFn: () => api.getLinkStats(id),
    staleTime: 10_000, // 10 seconds
    enabled: !!id,
    ...options,
  });
}

export function useUserQuota(
  options?: Omit<
    UseQueryOptions<{
      used: number;
      limit: number;
      remaining: number;
      percentUsed: number;
    }>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: linkKeys.quota(),
    queryFn: () => api.getUserQuota(),
    staleTime: 60_000, // 1 minute
    ...options,
  });
}

// ═══════════════════════════════════════════════════════════════════
// MUTATIONS
// ═══════════════════════════════════════════════════════════════════

export function useCreateLink(
  options?: UseMutationOptions<LinkResponse, Error, CreateLinkInput>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateLinkInput) => api.createLink(input),
    onSuccess: () => {
      // Invalidate lists to refetch
      queryClient.invalidateQueries({ queryKey: linkKeys.lists() });
      queryClient.invalidateQueries({ queryKey: linkKeys.quota() });
    },
    ...options,
  });
}

export function useUpdateLink(
  options?: UseMutationOptions<
    LinkResponse,
    Error,
    { id: string; data: UpdateLinkInput }
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLinkInput }) =>
      api.updateLink(id, data),
    onSuccess: (data) => {
      // Update cache for this specific link
      queryClient.setQueryData(linkKeys.detail(data.id), data);
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: linkKeys.lists() });
    },
    ...options,
  });
}

export function useDeleteLink(
  options?: UseMutationOptions<void, Error, string>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteLink(id),
    onSuccess: (_, id) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: linkKeys.detail(id) });
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: linkKeys.lists() });
      queryClient.invalidateQueries({ queryKey: linkKeys.quota() });
    },
    ...options,
  });
}

export function useRestoreLink(
  options?: UseMutationOptions<LinkResponse, Error, string>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.restoreLink(id),
    onSuccess: (data) => {
      queryClient.setQueryData(linkKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: linkKeys.lists() });
    },
    ...options,
  });
}

export function useDuplicateLink(
  options?: UseMutationOptions<LinkResponse, Error, string>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.duplicateLink(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: linkKeys.lists() });
      queryClient.invalidateQueries({ queryKey: linkKeys.quota() });
    },
    ...options,
  });
}
