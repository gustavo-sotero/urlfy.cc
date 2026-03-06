/**
 * Unit tests for privacy utilities
 *
 * Verifies LGPD/GDPR compliance requirements:
 *  RF-18 — IP must be hashed with SHA-256 and weekly rotating salt
 *  Plan module 5.4 — "Hash SHA-256 do IP com salt rotativo semanal ({year}-W{week})"
 *
 * These functions are pure (only node:crypto), so no infrastructure is needed.
 */

import { describe, expect, it } from 'bun:test';
import { createHash } from 'node:crypto';
import {
  getSaltInfo,
  hashVisitor,
  validateHashForWeek
} from '../../src/server/lib/privacy';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Returns a Date set to a specific ISO year-week (Monday) */
function monday(year: number, isoWeek: number): Date {
  // Jan 4 is always in week 1 per ISO 8601
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  const target = new Date(week1Monday);
  target.setUTCDate(week1Monday.getUTCDate() + (isoWeek - 1) * 7);
  return target;
}

// ─── getSaltInfo ───────────────────────────────────────────────────────────────

describe('getSaltInfo', () => {
  it('returns salt in {year}-W{week} format', () => {
    const date = monday(2026, 10);
    const { salt } = getSaltInfo(date);
    expect(salt).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('returns week 10 for a date in ISO week 10 of 2026', () => {
    const date = monday(2026, 10);
    const { salt, year, week } = getSaltInfo(date);
    expect(year).toBe(2026);
    expect(week).toBe(10);
    expect(salt).toBe('2026-W10');
  });

  it('pads single-digit weeks with a leading zero', () => {
    const date = monday(2026, 3);
    const { salt } = getSaltInfo(date);
    expect(salt).toBe('2026-W03');
  });

  it('startDate is on a Monday', () => {
    const date = monday(2026, 15);
    const { startDate } = getSaltInfo(date);
    // Monday = 1 (getUTCDay returns 0 for Sunday)
    expect(startDate.getUTCDay()).toBe(1);
  });

  it('endDate is exactly 7 days after startDate', () => {
    const date = monday(2026, 15);
    const { startDate, endDate } = getSaltInfo(date);
    const diff = endDate.getTime() - startDate.getTime();
    expect(diff).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('uses current date when no argument is provided', () => {
    // Should not throw
    expect(() => getSaltInfo()).not.toThrow();
    const { salt } = getSaltInfo();
    expect(salt).toMatch(/^\d{4}-W\d{2}$/);
  });
});

// ─── hashVisitor ───────────────────────────────────────────────────────────────

describe('hashVisitor', () => {
  const LINK_ID = 'link-id-abc';
  const TEST_IP = '192.168.1.100';
  const TEST_DATE = monday(2026, 10);

  it('returns a 64-character hex SHA-256 string', () => {
    const hash = hashVisitor(TEST_IP, LINK_ID, TEST_DATE);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces deterministic output for the same IP, linkId, and week', () => {
    const hash1 = hashVisitor(TEST_IP, LINK_ID, TEST_DATE);
    const hash2 = hashVisitor(TEST_IP, LINK_ID, TEST_DATE);
    expect(hash1).toBe(hash2);
  });

  it('produces identical hashes for different dates within the same week', () => {
    const monday10 = monday(2026, 10);
    const tuesday10 = new Date(monday10);
    tuesday10.setUTCDate(monday10.getUTCDate() + 1);
    const friday10 = new Date(monday10);
    friday10.setUTCDate(monday10.getUTCDate() + 4);

    const h1 = hashVisitor(TEST_IP, LINK_ID, monday10);
    const h2 = hashVisitor(TEST_IP, LINK_ID, tuesday10);
    const h3 = hashVisitor(TEST_IP, LINK_ID, friday10);

    expect(h1).toBe(h2);
    expect(h2).toBe(h3);
  });

  it('produces different hashes for different weeks (salt rotates)', () => {
    const week10 = monday(2026, 10);
    const week11 = monday(2026, 11);

    const h1 = hashVisitor(TEST_IP, LINK_ID, week10);
    const h2 = hashVisitor(TEST_IP, LINK_ID, week11);

    expect(h1).not.toBe(h2);
  });

  it('produces different hashes for different IPs in the same week', () => {
    const h1 = hashVisitor('10.0.0.1', LINK_ID, TEST_DATE);
    const h2 = hashVisitor('10.0.0.2', LINK_ID, TEST_DATE);
    expect(h1).not.toBe(h2);
  });

  it('produces different hashes for the same IP across different links', () => {
    const h1 = hashVisitor(TEST_IP, 'link-aaa', TEST_DATE);
    const h2 = hashVisitor(TEST_IP, 'link-bbb', TEST_DATE);
    expect(h1).not.toBe(h2);
  });

  it('uses the correct hash formula: SHA-256({ip}:{linkId}:{salt})', () => {
    const { salt } = getSaltInfo(TEST_DATE);
    const expected = sha256(`${TEST_IP}:${LINK_ID}:${salt}`);
    const actual = hashVisitor(TEST_IP, LINK_ID, TEST_DATE);
    expect(actual).toBe(expected);
  });

  it('handles null IP with a deterministic anonymous hash', () => {
    const hash = hashVisitor(null, LINK_ID, TEST_DATE);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);

    // Same call produces same hash
    expect(hashVisitor(null, LINK_ID, TEST_DATE)).toBe(hash);
  });

  it('handles empty string IP the same way as null', () => {
    const hashNull = hashVisitor(null, LINK_ID, TEST_DATE);
    const hashEmpty = hashVisitor('', LINK_ID, TEST_DATE);
    expect(hashEmpty).toBe(hashNull);
  });

  it('anonymous hash uses anonymous:{linkId}:{salt} formula', () => {
    const { salt } = getSaltInfo(TEST_DATE);
    const expected = sha256(`anonymous:${LINK_ID}:${salt}`);
    expect(hashVisitor(null, LINK_ID, TEST_DATE)).toBe(expected);
  });

  it('the IP is never stored — hash is not reversible to the original IP', () => {
    const hash = hashVisitor(TEST_IP, LINK_ID, TEST_DATE);
    // SHA-256 is a one-way function; the hash must not contain the raw IP
    expect(hash).not.toContain(TEST_IP);
  });
});

// ─── validateHashForWeek ───────────────────────────────────────────────────────

describe('validateHashForWeek', () => {
  const LINK_ID = 'link-validate';
  const IP = '203.0.113.50';
  const DATE = monday(2026, 20);

  it('returns true when hash matches the expected hash for the given week', () => {
    const hash = hashVisitor(IP, LINK_ID, DATE);
    expect(validateHashForWeek(hash, IP, LINK_ID, DATE)).toBe(true);
  });

  it('returns false for a hash from a different week', () => {
    const previousWeek = monday(2026, 19);
    const oldHash = hashVisitor(IP, LINK_ID, previousWeek);
    expect(validateHashForWeek(oldHash, IP, LINK_ID, DATE)).toBe(false);
  });

  it('returns false for a tampered hash', () => {
    const hash = hashVisitor(IP, LINK_ID, DATE);
    const tampered = hash.replace(hash[0], hash[0] === 'a' ? 'b' : 'a');
    expect(validateHashForWeek(tampered, IP, LINK_ID, DATE)).toBe(false);
  });

  it('returns false when IP is different', () => {
    const hash = hashVisitor(IP, LINK_ID, DATE);
    expect(validateHashForWeek(hash, '1.2.3.4', LINK_ID, DATE)).toBe(false);
  });
});
