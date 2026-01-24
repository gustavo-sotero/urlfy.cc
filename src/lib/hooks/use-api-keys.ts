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
import { toast } from 'sonner';
import * as api from '@/lib/api-client';

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

  return useMutation({
    mutationFn: (input: api.CreateApiKeyInput) => api.createApiKey(input),
    onSuccess: () => {
      // Invalidate the list to refetch keys
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.lists() });

      // Success toast
      toast.success('Chave de API criada com sucesso!', {
        description: 'Copie a chave agora - ela não será exibida novamente.'
      });
    },
    onError: (error) => {
      // Error toast
      toast.error('Erro ao criar chave de API', {
        description: error.message || 'Tente novamente mais tarde'
      });
    },
    ...options
  });
}

/**
 * Revoke (delete) an API key
 */
export function useRevokeApiKey(
  options?: UseMutationOptions<{ message: string }, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.revokeApiKey(id),
    onSuccess: () => {
      // Invalidate the list to refetch keys
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.lists() });

      // Success toast
      toast.success('Chave de API revogada com sucesso!');
    },
    onError: (error) => {
      // Error toast
      toast.error('Erro ao revogar chave de API', {
        description: error.message || 'Tente novamente mais tarde'
      });
    },
    ...options
  });
}
