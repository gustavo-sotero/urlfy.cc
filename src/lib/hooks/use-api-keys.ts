// src/lib/hooks/use-api-keys.ts
/**
 * React Query hooks for API key management
 */

import {
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query';
import * as api from '@/lib/api';

// ═══════════════════════════════════════════════════════════════════
// QUERY KEYS
// ═══════════════════════════════════════════════════════════════════

export const apiKeyKeys = {
  all: ['api-keys'] as const,
  lists: () => [...apiKeyKeys.all, 'list'] as const
};

// ═══════════════════════════════════════════════════════════════════
// QUERIES
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetch all API keys for the authenticated user
 */
export function useApiKeys(
  options?: Omit<
    UseQueryOptions<{ keys: api.ApiKeyPublic[]; total: number }>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: apiKeyKeys.lists(),
    queryFn: () => api.getApiKeys(),
    staleTime: 60_000, // 1 minute
    ...options
  });
}

// ═══════════════════════════════════════════════════════════════════
// MUTATIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a new API key
 * IMPORTANT: The mutation result contains the raw key - do not invalidate immediately!
 */
export function useCreateApiKey(
  options?: UseMutationOptions<api.ApiKeyCreated, Error, api.CreateApiKeyInput>
) {
  const queryClient = useQueryClient();
  const { onSuccess, onError, ...restOptions } = options ?? {};

  return useMutation({
    ...restOptions,
    mutationFn: (input: api.CreateApiKeyInput) => api.createApiKey(input),
    onSuccess: (data, variables, onMutateResult, context) => {
      // Invalidate the list to refetch keys
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.lists() });

      onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      onError?.(error, variables, onMutateResult, context);
    }
  });
}

/**
 * Revoke (delete) an API key
 */
export function useRevokeApiKey(
  options?: UseMutationOptions<{ message: string }, Error, string>
) {
  const queryClient = useQueryClient();
  const { onSuccess, onError, ...restOptions } = options ?? {};

  return useMutation({
    ...restOptions,
    mutationFn: (id: string) => api.revokeApiKey(id),
    onSuccess: (data, variables, onMutateResult, context) => {
      // Invalidate the list to refetch keys
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.lists() });

      onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      onError?.(error, variables, onMutateResult, context);
    }
  });
}
