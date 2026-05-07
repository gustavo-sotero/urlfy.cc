/**
 * ═════════════════════════════════════════════════════════════════════
 * AGGREGATION WORKER — SEMANTICS TESTS (Wave 5.34)
 * ═════════════════════════════════════════════════════════════════════
 * Verifies the strict-failure semantics of the aggregation pipeline:
 *
 * 1. Malformed JSON in linkIds payload → DLQ-worthy error (throws).
 * 2. linkIds not an array of strings → throws without processing any links.
 * 3. Partial link failure → throws so WorkerBase retries (no silent ACK).
 * 4. settledOrThrow helper → collects all rejections before re-throwing.
 * ═════════════════════════════════════════════════════════════════════
 */

import { describe, expect, test } from 'bun:test';

// ─── settledOrThrow — unit tests ─────────────────────────────────────────────
// Mirrors the helper defined inside aggregation-stream.worker.ts

async function settledOrThrow(
  label: string,
  promises: Promise<unknown>[]
): Promise<void> {
  if (promises.length === 0) return;
  const results = await Promise.allSettled(promises);
  const failures = results.filter(
    (r): r is PromiseRejectedResult => r.status === 'rejected'
  );
  if (failures.length > 0) {
    const reasons = failures.map((f) =>
      f.reason instanceof Error ? f.reason.message : String(f.reason)
    );
    throw new Error(
      `${label}: ${failures.length}/${promises.length} upserts failed — ${reasons.join('; ')}`
    );
  }
}

// ─── linkIds payload parsing — mirrors processMessage guard ──────────────────

function parseLinkIds(linkIdsStr: string | undefined): string[] {
  if (!linkIdsStr || linkIdsStr.trim() === '') return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(linkIdsStr);
  } catch (e) {
    throw new Error(`Malformed linkIds JSON in stream payload: ${String(e)}`);
  }

  if (!Array.isArray(parsed) || parsed.some((v) => typeof v !== 'string')) {
    throw new Error(
      `linkIds must be a JSON array of strings; got: ${typeof parsed}`
    );
  }

  return parsed as string[];
}

// ─── partial-failure aggregation — mirrors processMessage loop ────────────────

async function runAggregationWithConcurrency(
  linkIds: string[],
  aggregateFn: (linkId: string) => Promise<void>
): Promise<{ aggregatedCount: number; failedLinkIds: string[] }> {
  let aggregatedCount = 0;
  const failedLinkIds: string[] = [];

  for (const linkId of linkIds) {
    try {
      await aggregateFn(linkId);
      aggregatedCount++;
    } catch (_error) {
      failedLinkIds.push(linkId);
    }
  }

  if (failedLinkIds.length > 0) {
    throw new Error(
      `Aggregation partially failed for ${failedLinkIds.length} link(s): ${failedLinkIds.join(', ')}`
    );
  }

  return { aggregatedCount, failedLinkIds };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('aggregation worker — semantics (Wave 5.34)', () => {
  describe('settledOrThrow', () => {
    test('resolves when all promises succeed', async () => {
      await expect(
        settledOrThrow('country', [
          Promise.resolve(),
          Promise.resolve(),
          Promise.resolve()
        ])
      ).resolves.toBeUndefined();
    });

    test('throws when any promise rejects, collecting all failure reasons', async () => {
      const err1 = new Error('upsert-1 failed');
      const err2 = new Error('upsert-2 failed');

      await expect(
        settledOrThrow('device', [
          Promise.resolve(),
          Promise.reject(err1),
          Promise.reject(err2)
        ])
      ).rejects.toThrow('device: 2/3 upserts failed');
    });

    test('includes error messages in the thrown error', async () => {
      const err = new Error('connection timeout');

      let thrown: Error | null = null;
      try {
        await settledOrThrow('browser', [Promise.reject(err)]);
      } catch (e) {
        thrown = e as Error;
      }

      expect(thrown).not.toBeNull();
      expect(thrown?.message).toContain('connection timeout');
    });

    test('no-op when promises array is empty', async () => {
      await expect(settledOrThrow('empty', [])).resolves.toBeUndefined();
    });
  });

  describe('linkIds payload parsing', () => {
    test('empty linkIdsStr returns an empty array (process all links path)', () => {
      expect(parseLinkIds(undefined)).toEqual([]);
      expect(parseLinkIds('')).toEqual([]);
      expect(parseLinkIds('  ')).toEqual([]);
    });

    test('valid JSON array of strings returns the parsed array', () => {
      const result = parseLinkIds('["link-1","link-2","link-3"]');
      expect(result).toEqual(['link-1', 'link-2', 'link-3']);
    });

    test('malformed JSON throws — prevents unbounded full-table fallback', () => {
      expect(() => parseLinkIds('{not valid json')).toThrow(
        'Malformed linkIds JSON'
      );
    });

    test('valid JSON but not an array throws', () => {
      expect(() => parseLinkIds('"just-a-string"')).toThrow(
        'linkIds must be a JSON array of strings'
      );
    });

    test('array containing non-string values throws', () => {
      expect(() => parseLinkIds('[1, 2, 3]')).toThrow(
        'linkIds must be a JSON array of strings'
      );
    });

    test('mixed array (some strings, some non-strings) throws', () => {
      expect(() => parseLinkIds('["link-1", null, "link-2"]')).toThrow(
        'linkIds must be a JSON array of strings'
      );
    });
  });

  describe('partial failure handling', () => {
    test('all links succeed — no error thrown', async () => {
      const aggregateFn = async (_linkId: string) => {};

      await expect(
        runAggregationWithConcurrency(['link-A', 'link-B'], aggregateFn)
      ).resolves.toMatchObject({ aggregatedCount: 2, failedLinkIds: [] });
    });

    test('partial failure — throws to prevent silent ACK', async () => {
      const aggregateFn = async (linkId: string) => {
        if (linkId === 'link-bad') throw new Error('DB error for link-bad');
      };

      await expect(
        runAggregationWithConcurrency(['link-ok', 'link-bad'], aggregateFn)
      ).rejects.toThrow('Aggregation partially failed for 1 link(s): link-bad');
    });

    test('all links fail — throws with all failed link IDs', async () => {
      const aggregateFn = async (_linkId: string) => {
        throw new Error('DB unavailable');
      };

      await expect(
        runAggregationWithConcurrency(
          ['link-1', 'link-2', 'link-3'],
          aggregateFn
        )
      ).rejects.toThrow('Aggregation partially failed for 3 link(s)');
    });
  });
});
