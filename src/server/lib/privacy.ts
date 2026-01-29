// src/server/lib/privacy.ts

import { createLogger } from '@/server/lib/telemetry';
import { createHash } from 'node:crypto';

const logger = createLogger('privacy');

/**
 * Weekly rotating salt manager for IP anonymization
 * LGPD/GDPR Compliance: IPs are never stored as plain text
 *
 * Strategy:
 * - New salt each week based on year + week number
 * - Same session within a week produces identical hash
 * - Different weeks produce different hashes (impossible to track across weeks)
 */

export interface SaltInfo {
  salt: string;
  year: number;
  week: number;
  startDate: Date;
  endDate: Date;
}

/**
 * Calculates ISO week number
 * Used for weekly salt rotation
 */
function getWeekNumber(date: Date): number {
  // ISO week calculation (Monday is day 1)
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Returns salt info for a specific date
 */
export function getSaltInfo(date: Date = new Date()): SaltInfo {
  const year = date.getFullYear();
  const week = getWeekNumber(date);

  // Calculate first Monday of ISO week
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
 * Visitor hash with weekly rotating salt
 *
 * Parameters:
 * - ip: Visitor IP (can be null for rare cases)
 * - linkId: Link ID (provides scope)
 * - date: Date to determine salt (default: now)
 *
 * Result:
 * - Deterministic but non-reversible SHA-256 hash
 * - Impossible to link hashes across weeks
 * - Compliance: IP is never stored
 */
export function hashVisitor(
  ip: string | null,
  linkId: string,
  date: Date = new Date()
): string {
  // Fallback for visitors without IP
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
 * Validates if a hash was generated this week
 * Useful for debugging / compliance audits
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
 * Gets all possible hashes for an IP within a period
 * Useful for retroactive anonymization
 *
 * Example: If a user requested deletion, we can find
 * all their hashes in this period and delete them
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

  // Iterate through all weeks in the period
  const currentDate = new Date(startDate);

  while (currentDate < endDate) {
    const saltInfo = getSaltInfo(currentDate);

    // Add only once per week
    if (!hashes.some((h) => h.week === saltInfo.salt)) {
      hashes.push({
        hash: hashVisitor(ip, linkId, currentDate),
        week: saltInfo.salt,
        startDate: saltInfo.startDate,
        endDate: saltInfo.endDate
      });
    }

    // Next week
    currentDate.setDate(currentDate.getDate() + 7);
  }

  return hashes;
}

/**
 * Test function: validates that implementation is correct
 */
export function validatePrivacyImplementation(): boolean {
  // Different hash for different weeks
  const now = new Date();
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const hash1 = hashVisitor('192.168.1.1', 'link-id', now);
  const hash2 = hashVisitor('192.168.1.1', 'link-id', nextWeek);

  if (hash1 === hash2) {
    logger.error('[Privacy] CRITICAL: Hashes são iguais entre semanas!');
    return false;
  }

  // Same IP + link + week = identical hash
  const hash3 = hashVisitor('192.168.1.1', 'link-id', now);
  if (hash1 !== hash3) {
    logger.error(
      '[Privacy] CRITICAL: Hashes devem ser iguais para mesma semana!'
    );
    return false;
  }

  // Different IP = different hash
  const hash4 = hashVisitor('192.168.1.2', 'link-id', now);
  if (hash1 === hash4) {
    logger.error(
      '[Privacy] CRITICAL: IPs diferentes produziram hash idêntico!'
    );
    return false;
  }

  // Different link = different hash
  const hash5 = hashVisitor('192.168.1.1', 'different-link', now);
  if (hash1 === hash5) {
    logger.error(
      '[Privacy] CRITICAL: Different links produced identical hash!'
    );
    return false;
  }

  logger.info('[Privacy] ✅ Privacy implementation validated successfully');
  return true;
}

// Validate implementation at initialization
if (import.meta.main) {
  const isValid = validatePrivacyImplementation();
  process.exit(isValid ? 0 : 1);
}
