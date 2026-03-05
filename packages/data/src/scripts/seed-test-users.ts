/**
 * ═════════════════════════════════════════════════════════════════════
 * SEED TEST USERS FOR E2E TESTS
 * ═════════════════════════════════════════════════════════════════════
 * Creates test users with different roles and 2FA states for E2E testing.
 *
 * Usage: bun run src/db/scripts/seed-test-users.ts
 * ═════════════════════════════════════════════════════════════════════
 */

import { eq } from 'drizzle-orm';
import { db } from '../index';
import { account, twoFactor, user } from '../schema/auth';

// Test user credentials (for E2E tests)
const TEST_USERS = [
  {
    id: 'test-user-regular',
    email: 'test-user@urlfy.test',
    password: 'Password123!',
    name: 'Test User',
    role: 'user' as const,
    emailVerified: true,
    twoFactorEnabled: false,
    needsTwoFactor: false
  },
  {
    id: 'test-admin-no-2fa',
    email: 'admin-no-2fa@urlfy.test',
    password: 'Admin123!',
    name: 'Admin No 2FA',
    role: 'admin' as const,
    emailVerified: true,
    twoFactorEnabled: false,
    needsTwoFactor: false
  },
  {
    id: 'test-admin-with-2fa',
    email: 'admin-2fa@urlfy.test',
    password: 'Admin123!',
    name: 'Admin With 2FA',
    role: 'admin' as const,
    emailVerified: true,
    twoFactorEnabled: true,
    needsTwoFactor: true
  }
] as const;

async function seedTestUsers() {
  console.log('🌱 Seeding test users...\n');

  for (const testUser of TEST_USERS) {
    try {
      // Check if user already exists
      const existing = await db
        .select()
        .from(user)
        .where(eq(user.email, testUser.email))
        .limit(1);

      if (existing.length > 0) {
        console.log(`⏭️  User ${testUser.email} already exists, skipping...`);
        continue;
      }

      // Hash password using Bun's native password hashing
      const passwordHash = await Bun.password.hash(testUser.password, {
        algorithm: 'argon2id',
        memoryCost: 65536,
        timeCost: 3
      });

      // Insert user
      // Note: Better-Auth handles password hashing during actual authentication
      // For E2E tests, we create users directly without hashed passwords
      // since we'll use Better-Auth's sign-in flow which handles hashing
      const [createdUser] = await db
        .insert(user)
        .values({
          id: testUser.id,
          email: testUser.email,
          name: testUser.name,
          role: testUser.role,
          emailVerified: testUser.emailVerified,
          twoFactorEnabled: testUser.twoFactorEnabled,
          linksQuota: testUser.role === 'admin' ? 10000 : 100,
          linksCount: 0
        })
        .returning();

      // Create account record with password (Better-Auth requirement)
      await db.insert(account).values({
        id: `account-${testUser.id}`,
        accountId: testUser.id,
        providerId: 'credential', // Better-Auth uses 'credential' for email/password
        userId: createdUser.id,
        password: passwordHash
      });

      console.log(`✅ Created user: ${testUser.email}`);
      console.log(`   - Role: ${testUser.role}`);
      console.log(`   - 2FA Enabled: ${testUser.twoFactorEnabled}`);

      // Create 2FA record if needed
      if (testUser.needsTwoFactor) {
        await db.insert(twoFactor).values({
          id: `2fa-${testUser.id}`,
          userId: createdUser.id,
          secret: 'JBSWY3DPEHPK3PXP', // Test TOTP secret (for testing only)
          backupCodes: JSON.stringify([
            'BACKUP-CODE-1',
            'BACKUP-CODE-2',
            'BACKUP-CODE-3'
          ]),
          verified: true
        });

        console.log(`   - 2FA Record: Created and verified`);
      }

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
  console.log('Admin without 2FA:');
  console.log(`  EMAIL: ${TEST_USERS[1].email}`);
  console.log(`  PASSWORD: ${TEST_USERS[1].password}\n`);
  console.log('Admin with 2FA:');
  console.log(`  EMAIL: ${TEST_USERS[2].email}`);
  console.log(`  PASSWORD: ${TEST_USERS[2].password}\n`);
  console.log('Environment variables for E2E tests:');
  console.log('```bash');
  console.log(`export TEST_USER_EMAIL="${TEST_USERS[0].email}"`);
  console.log(`export TEST_USER_PASSWORD="${TEST_USERS[0].password}"`);
  console.log(`export TEST_ADMIN_NO_2FA_EMAIL="${TEST_USERS[1].email}"`);
  console.log(`export TEST_ADMIN_NO_2FA_PASSWORD="${TEST_USERS[1].password}"`);
  console.log(`export TEST_ADMIN_WITH_2FA_EMAIL="${TEST_USERS[2].email}"`);
  console.log(
    `export TEST_ADMIN_WITH_2FA_PASSWORD="${TEST_USERS[2].password}"`
  );
  console.log('```\n');

  process.exit(0);
}

// Handle errors
seedTestUsers().catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});
