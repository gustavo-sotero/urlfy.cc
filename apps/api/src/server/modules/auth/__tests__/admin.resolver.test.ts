/**
 * ═════════════════════════════════════════════════════════════════════
 * ADMIN RESOLVER — Unit Tests
 * ═════════════════════════════════════════════════════════════════════
 * Pure unit tests for resolveIsAdminByGitHubAccount.
 * All external dependencies (env, db, telemetry) are mocked.
 *
 * Covers paths that cannot be tested without infrastructure:
 * - ADMIN_GITHUB_ACCOUNT_ID not configured (undefined)
 * - getEnv() throws (env not yet validated)
 * - db query throws (fail-closed behaviour)
 * - no linked account row
 * - mismatched accountId
 * - matching accountId (happy path)
 * - falsy userId inputs
 * ═════════════════════════════════════════════════════════════════════
 */

// process.env stubs must be set BEFORE imports (some modules read at load time)
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5432/test';
process.env.INTERNAL_API_SECRET =
  process.env.INTERNAL_API_SECRET ?? 'test-internal-api-secret-32chars';

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import * as realDataModule from '@urlfy/data';
import * as realTelemetryModule from '@/server/lib/telemetry';

// ─── Mutable mock state ──────────────────────────────────────────────────────

const CONFIGURED_ACCOUNT_ID = 'authorized-github-account-id-001';
const WRONG_ACCOUNT_ID = 'unauthorized-github-account-id-999';

let mockDbLimitResult: Array<{ accountId: string }> = [];
let mockGetEnvImpl: () => { ADMIN_GITHUB_ACCOUNT_ID?: string };
let mockDbThrows = false;

// ─── Chainable DB mock ────────────────────────────────────────────────────────

const mockDbLimit = mock(async () => {
  if (mockDbThrows) throw new Error('DB error');
  return mockDbLimitResult;
});
const mockDbWhere = mock(() => ({ limit: mockDbLimit }));
const mockDbFrom = mock(() => ({ where: mockDbWhere }));
const mockDbSelect = mock(() => ({ from: mockDbFrom }));

// ─── getEnv mock ─────────────────────────────────────────────────────────────

const mockGetEnv = mock(() => mockGetEnvImpl());

// ═══════════════════════════════════════════════════════════════════════════════

describe('resolveIsAdminByGitHubAccount (unit)', () => {
  beforeEach(() => {
    // Reset mock state to defaults
    mockDbLimitResult = [{ accountId: CONFIGURED_ACCOUNT_ID }];
    mockGetEnvImpl = () => ({ ADMIN_GITHUB_ACCOUNT_ID: CONFIGURED_ACCOUNT_ID });
    mockDbThrows = false;

    // Reset call counts
    mockDbLimit.mockReset();
    mockDbWhere.mockReset();
    mockDbFrom.mockReset();
    mockDbSelect.mockReset();
    mockGetEnv.mockReset();

    // Re-attach implementations after reset
    mockDbLimit.mockImplementation(async () => {
      if (mockDbThrows) throw new Error('DB error');
      return mockDbLimitResult;
    });
    mockDbWhere.mockImplementation(() => ({ limit: mockDbLimit }));
    mockDbFrom.mockImplementation(() => ({ where: mockDbWhere }));
    mockDbSelect.mockImplementation(() => ({ from: mockDbFrom }));
    mockGetEnv.mockImplementation(() => mockGetEnvImpl());

    // Register module mocks (Bun re-evaluates the dependency graph)
    mock.module('@/lib/env', () => ({
      getEnv: mockGetEnv
    }));

    mock.module('@urlfy/data', () => ({
      ...realDataModule,
      db: new Proxy(realDataModule.db, {
        get(target, prop, receiver) {
          if (prop === 'select') {
            return mockDbSelect;
          }

          return Reflect.get(target, prop, receiver);
        }
      })
    }));

    mock.module('@/server/lib/telemetry', () => ({
      ...realTelemetryModule,
      createLogger: () => ({
        debug: mock(() => undefined),
        warn: mock(() => undefined),
        error: mock(() => undefined)
      })
    }));
  });

  afterEach(() => {
    mock.restore();
  });

  // ═══════════════════════════════════════════════════════════════════
  // Early-return guards (no DB call)
  // ═══════════════════════════════════════════════════════════════════

  describe('falsy userId guard', () => {
    test('returns false for null userId', async () => {
      const { resolveIsAdminByGitHubAccount } = await import(
        '../../../services/admin.resolver'
      );
      expect(await resolveIsAdminByGitHubAccount(null)).toBe(false);
      expect(mockDbSelect).not.toHaveBeenCalled();
    });

    test('returns false for undefined userId', async () => {
      const { resolveIsAdminByGitHubAccount } = await import(
        '../../../services/admin.resolver'
      );
      expect(await resolveIsAdminByGitHubAccount(undefined)).toBe(false);
      expect(mockDbSelect).not.toHaveBeenCalled();
    });

    test('returns false for empty string userId', async () => {
      const { resolveIsAdminByGitHubAccount } = await import(
        '../../../services/admin.resolver'
      );
      expect(await resolveIsAdminByGitHubAccount('')).toBe(false);
      expect(mockDbSelect).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Env configuration guards (no DB call)
  // ═══════════════════════════════════════════════════════════════════

  describe('env configuration guard', () => {
    test('returns false when ADMIN_GITHUB_ACCOUNT_ID is undefined', async () => {
      mockGetEnvImpl = () => ({ ADMIN_GITHUB_ACCOUNT_ID: undefined });

      const { resolveIsAdminByGitHubAccount } = await import(
        '../../../services/admin.resolver'
      );
      expect(await resolveIsAdminByGitHubAccount('user-1')).toBe(false);
      expect(mockDbSelect).not.toHaveBeenCalled();
    });

    test('returns false when ADMIN_GITHUB_ACCOUNT_ID is empty string', async () => {
      mockGetEnvImpl = () => ({
        ADMIN_GITHUB_ACCOUNT_ID: '' as unknown as undefined
      });

      const { resolveIsAdminByGitHubAccount } = await import(
        '../../../services/admin.resolver'
      );
      expect(await resolveIsAdminByGitHubAccount('user-1')).toBe(false);
      expect(mockDbSelect).not.toHaveBeenCalled();
    });

    test('returns false when getEnv() throws (env not yet validated)', async () => {
      mockGetEnv.mockImplementation(() => {
        throw new Error('Environment not validated. Call validateEnv() first.');
      });

      const { resolveIsAdminByGitHubAccount } = await import(
        '../../../services/admin.resolver'
      );
      expect(await resolveIsAdminByGitHubAccount('user-1')).toBe(false);
      expect(mockDbSelect).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // DB result cases
  // ═══════════════════════════════════════════════════════════════════

  describe('GitHub account lookup', () => {
    test('returns true when linked GitHub accountId matches configured value', async () => {
      mockDbLimitResult = [{ accountId: CONFIGURED_ACCOUNT_ID }];

      const { resolveIsAdminByGitHubAccount } = await import(
        '../../../services/admin.resolver'
      );
      expect(await resolveIsAdminByGitHubAccount('user-1')).toBe(true);
    });

    test('returns false when linked GitHub accountId does not match', async () => {
      mockDbLimitResult = [{ accountId: WRONG_ACCOUNT_ID }];

      const { resolveIsAdminByGitHubAccount } = await import(
        '../../../services/admin.resolver'
      );
      expect(await resolveIsAdminByGitHubAccount('user-1')).toBe(false);
    });

    test('returns false when user has no linked GitHub account (empty result)', async () => {
      mockDbLimitResult = [];

      const { resolveIsAdminByGitHubAccount } = await import(
        '../../../services/admin.resolver'
      );
      expect(await resolveIsAdminByGitHubAccount('user-1')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Fail-closed behaviour
  // ═══════════════════════════════════════════════════════════════════

  describe('fail-closed on infrastructure error', () => {
    test('returns false when db query throws', async () => {
      mockDbThrows = true;

      const { resolveIsAdminByGitHubAccount } = await import(
        '../../../services/admin.resolver'
      );
      expect(await resolveIsAdminByGitHubAccount('user-1')).toBe(false);
    });
  });
});
