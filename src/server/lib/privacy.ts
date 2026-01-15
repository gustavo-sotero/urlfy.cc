// src/server/lib/privacy.ts

import { createHash } from 'node:crypto';
import { createLogger } from '@/server/lib/telemetry';

const logger = createLogger('privacy');

/**
 * Gerencia salt rotativo semanal para anonimização de IPs
 * Compliance LGPD/GDPR: IPs nunca são armazenados em texto
 *
 * Estratégia:
 * - Cada semana um novo salt baseado em ano + número da semana
 * - Mesma sessão em uma semana produz hash idêntico
 * - Semanas diferentes produzem hashes diferentes (impossível rastrear)
 */

export interface SaltInfo {
  salt: string;
  year: number;
  week: number;
  startDate: Date;
  endDate: Date;
}

/**
 * Calcula o número da semana ISO
 * Usada para salt rotation semanal
 */
function getWeekNumber(date: Date): number {
  // Cálculo ISO week (segunda-feira é dia 1)
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Retorna info do salt para uma data específica
 */
export function getSaltInfo(date: Date = new Date()): SaltInfo {
  const year = date.getFullYear();
  const week = getWeekNumber(date);

  // Calcula primeira segunda-feira da semana ISO
  const simple = new Date(date);
  const dayNum = simple.getDay() || 7;
  simple.setDate(simple.getDate() - dayNum + 1);

  const startDate = new Date(
    Date.UTC(simple.getUTCFullYear(), simple.getUTCMonth(), simple.getUTCDate())
  );

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 7);

  return {
    salt: `${year}-W${String(week).padStart(2, '0')}`,
    year,
    week,
    startDate,
    endDate
  };
}

/**
 * Hash do visitante com salt rotativo semanal
 *
 * Parâmetros:
 * - ip: IP do visitante (pode ser null para casos raros)
 * - linkId: ID do link (fornece escopo)
 * - date: Data para determinar o salt (default: agora)
 *
 * Resultado:
 * - Hash SHA-256 determinístico mas não reverso
 * - Impossível vincular hashes entre semanas
 * - Compliance: IP nunca é armazenado
 */
export function hashVisitor(
  ip: string | null,
  linkId: string,
  date: Date = new Date()
): string {
  // Fallback para visitors sem IP
  if (!ip || ip.trim() === '') {
    const { salt } = getSaltInfo(date);
    const uniqueId = `anonymous:${linkId}:${salt}`;
    return createHash('sha256').update(uniqueId).digest('hex');
  }

  const { salt } = getSaltInfo(date);
  const hashInput = `${ip}:${linkId}:${salt}`;

  return createHash('sha256').update(hashInput).digest('hex');
}

/**
 * Valida se um hash foi gerado nesta semana
 * Útil para debugging / compliance audits
 */
export function validateHashForWeek(
  hash: string,
  ip: string,
  linkId: string,
  date: Date = new Date()
): boolean {
  const expectedHash = hashVisitor(ip, linkId, date);
  return hash === expectedHash;
}

/**
 * Obtém todos os possíveis hashes para um IP em um período
 * Útil para anonimização retroativa
 *
 * Exemplo: Se um usuário solicitou exclusão, podemos encontrar
 * todos seus hashes neste período e deletar
 */
export function getHashesForPeriod(
  ip: string,
  linkId: string,
  startDate: Date,
  endDate: Date
): Array<{ hash: string; week: string; startDate: Date; endDate: Date }> {
  const hashes: Array<{
    hash: string;
    week: string;
    startDate: Date;
    endDate: Date;
  }> = [];

  // Itera por todas as semanas no período
  const currentDate = new Date(startDate);

  while (currentDate < endDate) {
    const saltInfo = getSaltInfo(currentDate);

    // Adiciona apenas uma vez por semana
    if (!hashes.some((h) => h.week === saltInfo.salt)) {
      hashes.push({
        hash: hashVisitor(ip, linkId, currentDate),
        week: saltInfo.salt,
        startDate: saltInfo.startDate,
        endDate: saltInfo.endDate
      });
    }

    // Próxima semana
    currentDate.setDate(currentDate.getDate() + 7);
  }

  return hashes;
}

/**
 * Função de teste: valida que implementação está correta
 */
export function validatePrivacyImplementation(): boolean {
  // Hash diferente para semanas diferentes
  const now = new Date();
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const hash1 = hashVisitor('192.168.1.1', 'link-id', now);
  const hash2 = hashVisitor('192.168.1.1', 'link-id', nextWeek);

  if (hash1 === hash2) {
    logger.error('[Privacy] CRITICAL: Hashes são iguais entre semanas!');
    return false;
  }

  // Mesmo IP + link + semana = hash idêntico
  const hash3 = hashVisitor('192.168.1.1', 'link-id', now);
  if (hash1 !== hash3) {
    logger.error(
      '[Privacy] CRITICAL: Hashes devem ser iguais para mesma semana!'
    );
    return false;
  }

  // IP diferente = hash diferente
  const hash4 = hashVisitor('192.168.1.2', 'link-id', now);
  if (hash1 === hash4) {
    logger.error(
      '[Privacy] CRITICAL: IPs diferentes produziram hash idêntico!'
    );
    return false;
  }

  // Link diferente = hash diferente
  const hash5 = hashVisitor('192.168.1.1', 'different-link', now);
  if (hash1 === hash5) {
    logger.error(
      '[Privacy] CRITICAL: Links diferentes produziram hash idêntico!'
    );
    return false;
  }

  logger.info('[Privacy] ✅ Privacy implementation validated successfully');
  return true;
}

// Valida implementação na inicialização
if (import.meta.main) {
  const isValid = validatePrivacyImplementation();
  process.exit(isValid ? 0 : 1);
}
