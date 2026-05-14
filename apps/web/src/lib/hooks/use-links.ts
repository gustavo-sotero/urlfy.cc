'use client';

// src/lib/hooks/use-links.ts
/**
 * React Query hooks for link management
 */

import {
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import { ApiClientError } from '@/lib/api/error';
import type {
  CreateLinkInput,
  LinkResponse,
  ListLinksQuery,
  PaginatedResponse,
  UpdateLinkInput
} from '@/types/links.types';

// ═══════════════════════════════════════════════════════════════════
// QUERY KEYS
// ═══════════════════════════════════════════════════════════════════

export const linkKeys = {
  all: ['links'] as const,
  lists: () => [...linkKeys.all, 'list'] as const,
  list: (filters: ListLinksQuery) => [...linkKeys.lists(), filters] as const,
  details: () => [...linkKeys.all, 'detail'] as const,
  detail: (id: string) => [...linkKeys.details(), id] as const,
  stats: (id: string) => [...linkKeys.all, 'stats', id] as const,
  quota: () => ['quota'] as const,
  summary: () => [...linkKeys.all, 'summary'] as const
};

// ═══════════════════════════════════════════════════════════════════
// QUERIES
// ═══════════════════════════════════════════════════════════════════

export function useLinks(
  filters: ListLinksQuery = {},
  options?: Omit<
    UseQueryOptions<PaginatedResponse<LinkResponse>>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: linkKeys.list(filters),
    queryFn: () => api.getLinks(filters),
    staleTime: 30_000, // 30 s — fresh enough for list views without constant refetching
    refetchIntervalInBackground: false,
    ...options
  });
}

export function useLink(
  id: string,
  options?: Omit<UseQueryOptions<LinkResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: linkKeys.detail(id),
    queryFn: () => api.getLink(id),
    staleTime: 30_000, // 30 s — callers that need live counters should opt in to refetchInterval
    refetchIntervalInBackground: false,
    enabled: !!id,
    ...options
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
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: linkKeys.stats(id),
    queryFn: () => api.getLinkStats(id),
    staleTime: 10_000, // 10 seconds
    enabled: !!id,
    ...options
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
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: linkKeys.quota(),
    queryFn: () => api.getUserQuota(),
    staleTime: 60_000, // 1 minute
    ...options
  });
}

export function useDashboardSummary(
  options?: Omit<UseQueryOptions<api.DashboardSummary>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: linkKeys.summary(),
    queryFn: () => api.getDashboardSummary(),
    staleTime: 30_000, // 30 s — opt in to polling at call site if live totals are needed
    refetchIntervalInBackground: false,
    ...options
  });
}

// ═══════════════════════════════════════════════════════════════════
// MUTATIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Maps a link API error code to a translated user-facing description.
 * `t` is the `LinkForm` translation function obtained from useTranslations.
 */
function getLinkErrorDescription(
  error: Error,
  t: (key: string) => string
): string {
  if (!(error instanceof ApiClientError)) return t('errors.generic');
  const map: Record<string, string> = {
    INVALID_URL: t('errors.invalidUrl'),
    URL_TOO_LONG: t('errors.urlTooLong'),
    URL_BLOCKED: t('errors.urlBlocked'),
    SHORTENER_NOT_ALLOWED: t('errors.urlBlockedShortener'),
    RATE_LIMITED: t('errors.rateLimited'),
    ALIAS_TAKEN: t('errors.aliasTaken'),
    ALIAS_RESERVED: t('errors.aliasReserved'),
    QUOTA_EXCEEDED: t('errors.quotaExceeded')
  };
  return map[error.code] ?? t('errors.generic');
}

export function useCreateLink(
  options?: UseMutationOptions<LinkResponse, Error, CreateLinkInput> & {
    toastSuccess?: string;
    toastError?: string;
    showErrorToast?: boolean;
  }
) {
  const queryClient = useQueryClient();
  const t = useTranslations('LinkForm');
  const {
    onSuccess: userOnSuccess,
    onError: userOnError,
    toastSuccess,
    toastError,
    showErrorToast = true,
    ...restOptions
  } = options ?? {};

  return useMutation({
    mutationFn: (input: CreateLinkInput) => api.createLink(input),
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: linkKeys.lists() });
      queryClient.invalidateQueries({ queryKey: linkKeys.quota() });

      toast.success(toastSuccess ?? t('success.created'), {
        description: t('success.createdDescription', {
          shortCode: data.shortCode
        })
      });

      userOnSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      if (showErrorToast) {
        toast.error(toastError ?? t('errors.createFailed'), {
          description: getLinkErrorDescription(error, t)
        });
      }

      userOnError?.(error, variables, onMutateResult, context);
    },
    ...restOptions
  });
}

export function useUpdateLink(
  options?: UseMutationOptions<
    LinkResponse,
    Error,
    { id: string; data: UpdateLinkInput }
  > & {
    toastSuccess?: string;
    toastError?: string;
  }
) {
  const queryClient = useQueryClient();
  const t = useTranslations('LinkForm');
  const {
    onSuccess: userOnSuccess,
    onError: userOnError,
    toastSuccess,
    toastError,
    ...restOptions
  } = options ?? {};

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLinkInput }) =>
      api.updateLink(id, data),
    onSuccess: (data, variables, onMutateResult, context) => {
      // Update cache for this specific link
      queryClient.setQueryData(linkKeys.detail(data.id), data);
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: linkKeys.lists() });

      toast.success(toastSuccess ?? t('success.updated'));

      userOnSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      toast.error(toastError ?? t('errors.updateFailed'), {
        description: getLinkErrorDescription(error, t)
      });

      userOnError?.(error, variables, onMutateResult, context);
    },
    ...restOptions
  });
}

export function useDeleteLink(
  options?: UseMutationOptions<void, Error, string>
) {
  const queryClient = useQueryClient();
  const t = useTranslations('LinkForm');
  const {
    onSuccess: userOnSuccess,
    onError: userOnError,
    ...restOptions
  } = options ?? {};

  return useMutation({
    mutationFn: (id: string) => api.deleteLink(id),
    onSuccess: (data, id, onMutateResult, context) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: linkKeys.detail(id) });
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: linkKeys.lists() });
      queryClient.invalidateQueries({ queryKey: linkKeys.quota() });

      // Success toast is handled in the component to allow undo

      userOnSuccess?.(data, id, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      toast.error(t('errors.deleteFailed'), {
        description: getLinkErrorDescription(error, t)
      });

      userOnError?.(error, variables, onMutateResult, context);
    },
    ...restOptions
  });
}

export function useRestoreLink(
  options?: UseMutationOptions<LinkResponse, Error, string>
) {
  const queryClient = useQueryClient();
  const { onSuccess: userOnSuccess, ...restOptions } = options ?? {};

  return useMutation({
    mutationFn: (id: string) => api.restoreLink(id),
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(linkKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: linkKeys.lists() });

      userOnSuccess?.(data, variables, onMutateResult, context);
    },
    ...restOptions
  });
}

export function useDuplicateLink(
  options?: UseMutationOptions<LinkResponse, Error, string>
) {
  const queryClient = useQueryClient();
  const { onSuccess: userOnSuccess, ...restOptions } = options ?? {};

  return useMutation({
    mutationFn: (id: string) => api.duplicateLink(id),
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: linkKeys.lists() });
      queryClient.invalidateQueries({ queryKey: linkKeys.quota() });

      userOnSuccess?.(data, variables, onMutateResult, context);
    },
    ...restOptions
  });
}
