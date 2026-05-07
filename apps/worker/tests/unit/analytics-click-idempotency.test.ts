/**
 * ═════════════════════════════════════════════════════════════════════
 * ANALYTICS CLICK WORKER — IDEMPOTENCY LOGIC TESTS (Wave 5.33)
 * ═════════════════════════════════════════════════════════════════════
 * Validates the deduplication invariants of the click worker's
 * processMessage/processMessages paths.
 *
 * Key invariants (verified without importing the full worker):
 * 1. ON CONFLICT DO NOTHING + RETURNING tells us which rows were new.
 * 2. Only newly-inserted stream IDs increment the link click counter.
 * 3. Full-duplicate batches produce no counter updates.
 * 4. Partial-duplicate batches accumulate only the non-duplicate count.
 * ═════════════════════════════════════════════════════════════════════
 */

import { describe, expect, test } from 'bun:test';

// ─── Helper: mirrors the deduplication step in processMessages ──────────────

function buildClickCounts(
  messages: Array<{ id: string; linkId: string; timestamp: Date }>,
  insertedStreamIds: Set<string | null>
): Map<string, { count: number; lastClickedAt: Date }> {
  const linkClickCounts = new Map<
    string,
    { count: number; lastClickedAt: Date }
  >();

  for (const { id, linkId, timestamp } of messages) {
    // Mirror the exact deduplication guard in analytics-click.worker.ts
    if (!insertedStreamIds.has(id)) continue;

    const existing = linkClickCounts.get(linkId);
    if (existing) {
      existing.count++;
      if (timestamp > existing.lastClickedAt) {
        existing.lastClickedAt = timestamp;
      }
    } else {
      linkClickCounts.set(linkId, { count: 1, lastClickedAt: timestamp });
    }
  }

  return linkClickCounts;
}

// ─── Helper: mirrors the insertedStreamIds builder in processMessages ────────

function buildInsertedSet(
  returning: Array<{
    id: string;
    linkId: string;
    streamMessageId: string | null;
  }>
): Set<string | null> {
  return new Set(returning.map((r) => r.streamMessageId).filter(Boolean));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

const LINK_A = 'link-aaa';
const LINK_B = 'link-bbb';

describe('analytics-click worker — idempotency (Wave 5.33)', () => {
  describe('buildInsertedSet (mirrors .returning() result)', () => {
    test('newly inserted rows populate the set', () => {
      const returning = [
        { id: 'row-1', linkId: LINK_A, streamMessageId: 'msg-1' },
        { id: 'row-2', linkId: LINK_A, streamMessageId: 'msg-2' }
      ];

      const ids = buildInsertedSet(returning);

      expect(ids.has('msg-1')).toBe(true);
      expect(ids.has('msg-2')).toBe(true);
    });

    test('all-conflict batch results in an empty set', () => {
      // ON CONFLICT DO NOTHING with all duplicates -> empty RETURNING
      const returning: Array<{
        id: string;
        linkId: string;
        streamMessageId: string | null;
      }> = [];
      const ids = buildInsertedSet(returning);
      expect(ids.size).toBe(0);
    });

    test('null streamMessageId entries are excluded from the set', () => {
      const returning = [
        { id: 'row-1', linkId: LINK_A, streamMessageId: null },
        { id: 'row-2', linkId: LINK_A, streamMessageId: 'msg-ok' }
      ];

      const ids = buildInsertedSet(returning);

      expect(ids.has(null)).toBe(false);
      expect(ids.has('msg-ok')).toBe(true);
    });
  });

  describe('click count aggregation (mirrors processMessages step 3)', () => {
    test('all-new batch: each message increments its link counter once', () => {
      const now = new Date();
      const insertedStreamIds = new Set(['msg-A', 'msg-B', 'msg-C']);

      const messages = [
        { id: 'msg-A', linkId: LINK_A, timestamp: now },
        { id: 'msg-B', linkId: LINK_A, timestamp: now },
        { id: 'msg-C', linkId: LINK_B, timestamp: now }
      ];

      const counts = buildClickCounts(messages, insertedStreamIds);

      expect(counts.get(LINK_A)?.count).toBe(2);
      expect(counts.get(LINK_B)?.count).toBe(1);
    });

    test('partial-duplicate batch: duplicate messages do NOT increment the counter', () => {
      const now = new Date();
      // msg-A is new, msg-B is a duplicate (absent from insertedStreamIds)
      const insertedStreamIds = new Set(['msg-A']);

      const messages = [
        { id: 'msg-A', linkId: LINK_A, timestamp: now },
        { id: 'msg-B', linkId: LINK_A, timestamp: now } // duplicate
      ];

      const counts = buildClickCounts(messages, insertedStreamIds);

      // Only 1 click from msg-A; msg-B was a conflict
      expect(counts.get(LINK_A)?.count).toBe(1);
    });

    test('full-duplicate batch: empty insertedStreamIds -> no link click counts -> no DB update needed', () => {
      const now = new Date();
      // All messages are duplicates
      const insertedStreamIds = new Set<string>();

      const messages = [
        { id: 'msg-D', linkId: LINK_A, timestamp: now },
        { id: 'msg-E', linkId: LINK_A, timestamp: now }
      ];

      const counts = buildClickCounts(messages, insertedStreamIds);

      // Empty map -> zero DB updates required
      expect(counts.size).toBe(0);
    });

    test('lastClickedAt tracks the most recent timestamp across link events', () => {
      const t1 = new Date('2026-01-01T10:00:00Z');
      const t2 = new Date('2026-01-01T10:00:05Z'); // later

      const insertedStreamIds = new Set(['msg-X', 'msg-Y']);

      const messages = [
        { id: 'msg-X', linkId: LINK_A, timestamp: t1 },
        { id: 'msg-Y', linkId: LINK_A, timestamp: t2 }
      ];

      const counts = buildClickCounts(messages, insertedStreamIds);
      const linkA = counts.get(LINK_A);

      expect(linkA?.count).toBe(2);
      expect(linkA?.lastClickedAt).toEqual(t2); // most recent
    });
  });
});
