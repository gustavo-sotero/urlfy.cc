// src/server/lib/idempotency.ts

import { redis } from './redis';
import { createLogger } from './telemetry';

const logger = createLogger('idempotency');
const TTL = 86400; // 24 horas

/**
 * Verifica se uma idempotency key já foi processada
 * @param key - Chave de idempotência
 * @returns ID do recurso criado anteriormente ou null
 */
export async function checkIdempotency(key: string): Promise<string | null> {
  try {
    return await redis.get(`idempotency:${key}`);
  } catch (error) {
    logger.warn('Redis unavailable for idempotency check', {
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

/**
 * Armazena resultado de operação idempotente
 * @param key - Chave de idempotência
 * @param resourceId - ID do recurso criado
 */
export async function setIdempotency(
  key: string,
  resourceId: string
): Promise<void> {
  try {
    await redis.set(`idempotency:${key}`, resourceId, 'EX', TTL);
  } catch (error) {
    logger.warn('Failed to set idempotency key', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Valida formato de idempotency key
 * Deve ser um UUID ou string de 16-64 caracteres alfanuméricos
 * @param key - Chave a validar
 * @returns true se válida
 */
export function validateIdempotencyKey(key: string): boolean {
  // UUID format ou string alfanumérica de 16-64 chars
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const alphanumericRegex = /^[a-zA-Z0-9_-]{16,64}$/;

  return uuidRegex.test(key) || alphanumericRegex.test(key);
}
