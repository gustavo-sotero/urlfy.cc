/**
 * ═════════════════════════════════════════════════════════════════════
 * SEED TEST USERS FOR E2E TESTS
 * ═════════════════════════════════════════════════════════════════════
 * Creates deterministic test users for the GitHub allowlist admin model.
 *
 * Usage: bun run src/scripts/seed-test-users.ts
 *
 * Required guards (fail-fast if not met):
 *   NODE_ENV must be "test" or "development"
 *   ALLOW_TEST_SEEDING=1 must be set explicitly
 *
 * The script will also refuse to run when the DATABASE_URL looks like a
 * shared / production host (anything that does NOT contain "localhost",
 * "127.0.0.1", "::1", or "test" in the hostname).
 * ═════════════════════════════════════════════════════════════════════
 */

import { eq, or } from 'drizzle-orm';
import { db } from '../index';
import { account, twoFactor, user } from '../schema/auth';

// ─── safety guards ──────────────────────────────────────────────────────────

function assertSafeEnvironment(): void {
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv !== 'test' && nodeEnv !== 'development') {
    console.error(
      `❌ Refusing to seed: NODE_ENV is "${nodeEnv}". Only "test" or "development" are allowed.`
    );
    process.exit(1);
  }

  if (process.env.ALLOW_TEST_SEEDING !== '1') {
    console.error(
      '❌ Refusing to seed: ALLOW_TEST_SEEDING=1 is required to prevent accidental seeding.'
    );
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL ?? '';
  if (dbUrl) {
    let hostname = '';
    try {
      hostname = new URL(dbUrl).hostname.toLowerCase();
    } catch {
      // Unparseable URL — let the DB client surface the error later
    }

    const isSafeHost =
      !hostname ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.includes('test') ||
      hostname.endsWith('.local');

    if (!isSafeHost) {
      console.error(
        `❌ Refusing to seed: DATABASE_URL points to "${hostname}" which does not look like a local/test host.`
      );
      process.exit(1);
    }
  }
}

assertSafeEnvironment();

// ─── admin GitHub account ID ─────────────────────────────────────────────────
// Use a fixed fake ID so the seeded admin user is never linked to the real
// configured ADMIN_GITHUB_ACCOUNT_ID from production secrets.
const SEEDED_ADMIN_GITHUB_ACCOUNT_ID =
  'local-dev-test-admin-github-account-id-00000000';

type TestAccountSeed = {
  accountId: string;
  providerId: 'credential' | 'github';
  passwordProtected?: boolean;
};

type TestUserSeed = {
  id: string;
  email: string;
  password: string;
  name: string;
  role: 'user' | 'admin';
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  linksQuota: number;
  seedTwoFactor: boolean;
  accounts: TestAccountSeed[];
};

// Test user credentials (for E2E tests)
// Exactly one seeded user is the authorized admin, derived from a linked
// GitHub account whose accountId matches ADMIN_GITHUB_ACCOUNT_ID.
const TEST_USERS: readonly TestUserSeed[] = [
  {
    id: 'test-user-regular',
    email: 'test-user@urlfy.test',
    password: 'Password123!',
    name: 'Test User',
    role: 'user' as const,
    emailVerified: true,
    twoFactorEnabled: false,
    linksQuota: 100,
    seedTwoFactor: false,
    accounts: [
      {
        accountId: 'test-user-regular',
        providerId: 'credential',
        passwordProtected: true
      }
    ]
  },
  {
    id: 'test-admin-authorized',
    email: 'authorized-admin@urlfy.test',
    password: 'Admin123!',
    name: 'Authorized Admin',
    role: 'user' as const,
    emailVerified: true,
    twoFactorEnabled: false,
    linksQuota: 10000,
    seedTwoFactor: false,
    accounts: [
      {
        accountId: 'test-admin-authorized',
        providerId: 'credential',
        passwordProtected: true
      },
      {
        accountId: SEEDED_ADMIN_GITHUB_ACCOUNT_ID,
        providerId: 'github'
      }
    ]
  },
  {
    id: 'test-github-user-unauthorized',
    email: 'unauthorized-github@urlfy.test',
    password: 'Password123!',
    name: 'Unauthorized GitHub User',
    role: 'user' as const,
    emailVerified: true,
    twoFactorEnabled: false,
    linksQuota: 100,
    seedTwoFactor: false,
    accounts: [
      {
        accountId: 'test-github-user-unauthorized',
        providerId: 'credential',
        passwordProtected: true
      },
      {
        accountId: 'unauthorized-github-account-id-00000000',
        providerId: 'github'
      }
    ]
  },
  {
    id: 'test-legacy-role-admin',
    email: 'legacy-admin@urlfy.test',
    password: 'Admin123!',
    name: 'Legacy Role Admin',
    role: 'admin' as const,
    emailVerified: true,
    twoFactorEnabled: true,
    linksQuota: 10000,
    seedTwoFactor: true,
    accounts: [
      {
        accountId: 'test-legacy-role-admin',
        providerId: 'credential',
        passwordProtected: true
      },
      {
        accountId: 'legacy-admin-github-account-id-00000000',
        providerId: 'github'
      }
    ]
  }
] as const;

async function ensureUserProfile(testUser: TestUserSeed) {
  const existingUsers = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(or(eq(user.id, testUser.id), eq(user.email, testUser.email)));

  for (const existingUser of existingUsers) {
    if (existingUser.id !== testUser.id) {
      await db.delete(user).where(eq(user.id, existingUser.id));
    }
  }

  const [existingUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, testUser.id))
    .limit(1);

  const persistedUserData = {
    email: testUser.email,
    name: testUser.name,
    role: testUser.role,
    emailVerified: testUser.emailVerified,
    twoFactorEnabled: testUser.twoFactorEnabled,
    linksQuota: testUser.linksQuota,
    linksCount: 0,
    banned: false,
    bannedAt: null,
    bannedReason: null,
    deletedAt: null
  };

  if (existingUser) {
    await db
      .update(user)
      .set(persistedUserData)
      .where(eq(user.id, testUser.id));
    return 'updated';
  }

  await db.insert(user).values({
    id: testUser.id,
    ...persistedUserData
  });
  return 'created';
}

async function replaceAccounts(testUser: TestUserSeed, passwordHash: string) {
  await db.delete(account).where(eq(account.userId, testUser.id));

  await db.insert(account).values(
    testUser.accounts.map((entry, index) => ({
      id: `${entry.providerId}-account-${testUser.id}-${index}`,
      accountId: entry.accountId,
      providerId: entry.providerId,
      userId: testUser.id,
      password: entry.passwordProtected ? passwordHash : null
    }))
  );
}

async function replaceTwoFactor(testUser: TestUserSeed) {
  await db.delete(twoFactor).where(eq(twoFactor.userId, testUser.id));

  if (!testUser.seedTwoFactor) {
    return false;
  }

  await db.insert(twoFactor).values({
    id: `2fa-${testUser.id}`,
    userId: testUser.id,
    secret: 'JBSWY3DPEHPK3PXP',
    backupCodes: JSON.stringify([
      'BACKUP-CODE-1',
      'BACKUP-CODE-2',
      'BACKUP-CODE-3'
    ]),
    verified: true
  });

  return true;
}

async function seedTestUsers() {
  console.log('🌱 Seeding test users...\n');
  console.log(
    `Using ADMIN_GITHUB_ACCOUNT_ID=${SEEDED_ADMIN_GITHUB_ACCOUNT_ID}\n`
  );

  for (const testUser of TEST_USERS) {
    try {
      // Hash password using Bun's native password hashing
      const passwordHash = await Bun.password.hash(testUser.password, {
        algorithm: 'argon2id',
        memoryCost: 65536,
        timeCost: 3
      });

      const operation = await ensureUserProfile(testUser);
      await replaceAccounts(testUser, passwordHash);
      const createdTwoFactor = await replaceTwoFactor(testUser);

      console.log(
        `${operation === 'created' ? '✅ Created' : '♻️  Updated'} user: ${testUser.email}`
      );
      console.log(`   - Role: ${testUser.role}`);
      console.log(`   - 2FA Enabled: ${testUser.twoFactorEnabled}`);
      console.log(
        `   - GitHub Linked: ${testUser.accounts.some((entry) => entry.providerId === 'github')}`
      );
      console.log(
        `   - Authorized Admin: ${testUser.accounts.some(
          (entry) =>
            entry.providerId === 'github' &&
            entry.accountId === SEEDED_ADMIN_GITHUB_ACCOUNT_ID
        )}`
      );
      console.log(
        `   - 2FA Record: ${createdTwoFactor ? 'Created and verified' : 'Not seeded'}`
      );

      console.log('');
    } catch (error) {
      console.error(`❌ Error creating user ${testUser.email}:`, error);
      console.log('');
    }
  }

  console.log('✨ Test user seeding complete!\n');
  console.log('📋 Use these credentials for E2E tests:\n');
  console.log('Regular User:');
  console.log(`  EMAIL: ${TEST_USERS[0].email}`);
  console.log(`  PASSWORD: ${TEST_USERS[0].password}\n`);
  console.log('Authorized Admin (linked GitHub allowlist):');
  console.log(`  EMAIL: ${TEST_USERS[1].email}`);
  console.log(`  PASSWORD: ${TEST_USERS[1].password}`);
  console.log(`  GITHUB ACCOUNT ID: ${SEEDED_ADMIN_GITHUB_ACCOUNT_ID}\n`);
  console.log('Unauthorized GitHub-linked User:');
  console.log(`  EMAIL: ${TEST_USERS[2].email}`);
  console.log(`  PASSWORD: ${TEST_USERS[2].password}\n`);
  console.log('Legacy role=admin User (not authorized):');
  console.log(`  EMAIL: ${TEST_USERS[3].email}`);
  console.log(`  PASSWORD: ${TEST_USERS[3].password}\n`);
  console.log('Environment variables for E2E tests:');
  console.log('```bash');
  console.log(`export TEST_USER_EMAIL="${TEST_USERS[0].email}"`);
  console.log(`export TEST_USER_PASSWORD="${TEST_USERS[0].password}"`);
  console.log(`export TEST_ADMIN_EMAIL="${TEST_USERS[1].email}"`);
  console.log(`export TEST_ADMIN_PASSWORD="${TEST_USERS[1].password}"`);
  console.log(
    `export TEST_ADMIN_GITHUB_ACCOUNT_ID="${SEEDED_ADMIN_GITHUB_ACCOUNT_ID}"`
  );
  console.log(`export TEST_ADMIN_NO_2FA_EMAIL="${TEST_USERS[1].email}"`);
  console.log(`export TEST_ADMIN_NO_2FA_PASSWORD="${TEST_USERS[1].password}"`);
  console.log(`export TEST_UNAUTHORIZED_GITHUB_EMAIL="${TEST_USERS[2].email}"`);
  console.log(
    `export TEST_UNAUTHORIZED_GITHUB_PASSWORD="${TEST_USERS[2].password}"`
  );
  console.log(`export TEST_LEGACY_ROLE_ADMIN_EMAIL="${TEST_USERS[3].email}"`);
  console.log(
    `export TEST_LEGACY_ROLE_ADMIN_PASSWORD="${TEST_USERS[3].password}"`
  );
  console.log('```\n');

  process.exit(0);
}

// Handle errors
seedTestUsers().catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});
