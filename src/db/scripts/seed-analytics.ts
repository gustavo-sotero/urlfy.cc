/**
 * ═══════════════════════════════════════════════════════════════════
 * SEED ANALYTICS DATA FOR DASHBOARD
 * ═══════════════════════════════════════════════════════════════════
 * Generates realistic analytics data for the last 30 days.
 *
 * Usage: bun run src/db/scripts/seed-analytics.ts
 * ═══════════════════════════════════════════════════════════════════
 */

import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { analyticsEvents, linkClicksDaily } from '@/db/schema/analytics';
import { user } from '@/db/schema/auth';
import { links } from '@/db/schema/links';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

const SEED_CONFIG = {
  /** Number of days to generate data for */
  DAYS_BACK: 30,
  /** Number of demo links to create */
  LINK_COUNT: 20,
  /** Average clicks per link per day (randomized ±50%) */
  AVG_CLICKS_PER_LINK_PER_DAY: 5,
  /** Demo user email */
  DEMO_USER_EMAIL: 'demo@urlfy.test',
  /** Demo user ID (stable for idempotency) */
  DEMO_USER_ID: 'seed-demo-user-analytics'
} as const;

// ═══════════════════════════════════════════════════════════════════
// REALISTIC DATA POOLS
// ═══════════════════════════════════════════════════════════════════

const GEO_DATA = [
  { country: 'BR', city: 'São Paulo' },
  { country: 'BR', city: 'Rio de Janeiro' },
  { country: 'US', city: 'New York' },
  { country: 'US', city: 'Los Angeles' },
  { country: 'PT', city: 'Lisboa' },
  { country: 'DE', city: 'Berlin' },
  { country: 'GB', city: 'London' },
  { country: 'FR', city: 'Paris' }
] as const;

const BROWSERS = ['Chrome', 'Safari', 'Firefox', 'Edge', 'Opera'] as const;
const OS_LIST = ['Windows', 'macOS', 'Linux', 'Android', 'iOS'] as const;
const DEVICE_TYPES = ['desktop', 'mobile', 'tablet'] as const;
const REFERRERS = [
  'https://twitter.com',
  'https://facebook.com',
  'https://linkedin.com',
  'https://google.com',
  null // Direct traffic
] as const;

// ═══════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════

/** Type for analytics event insert */
type AnalyticsEventInsert = typeof analyticsEvents.$inferInsert;

/** Type for link clicks daily insert */
type LinkClicksDailyInsert = typeof linkClicksDaily.$inferInsert;

// ═══════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate a random element from an array
 */
function randomFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a random integer between min and max (inclusive)
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a visitor hash (simulates LGPD-compliant IP hashing)
 */
function generateVisitorHash(): string {
  return (
    randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '').slice(0, 32)
  );
}

/**
 * Get dates for the last N days
 */
function getDateRange(daysBack: number): Date[] {
  const dates: Date[] = [];
  const now = new Date();

  for (let i = daysBack; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setUTCHours(0, 0, 0, 0);
    dates.push(date);
  }

  return dates;
}

/**
 * Format date as YYYY-MM-DD string
 */
function formatDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

// ═══════════════════════════════════════════════════════════════════
// SEEDER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Ensure demo user exists (upsert pattern)
 */
async function ensureDemoUser(): Promise<string> {
  const existingUsers = await db
    .select()
    .from(user)
    .where(eq(user.id, SEED_CONFIG.DEMO_USER_ID))
    .limit(1);

  if (existingUsers.length > 0) {
    console.log(`✅ Demo user already exists: ${existingUsers[0].email}`);
    return existingUsers[0].id;
  }

  await db.insert(user).values({
    id: SEED_CONFIG.DEMO_USER_ID,
    email: SEED_CONFIG.DEMO_USER_EMAIL,
    emailVerified: true,
    name: 'Demo User (Analytics)',
    role: 'user',
    createdAt: new Date(
      Date.now() - SEED_CONFIG.DAYS_BACK * 24 * 60 * 60 * 1000
    ),
    updatedAt: new Date()
  });

  console.log(`✅ Created demo user: ${SEED_CONFIG.DEMO_USER_EMAIL}`);
  return SEED_CONFIG.DEMO_USER_ID;
}

/**
 * Create demo links for the user
 */
async function createDemoLinks(userId: string): Promise<string[]> {
  const linkIds: string[] = [];

  // Check existing links
  const existingLinks = await db
    .select({ id: links.id })
    .from(links)
    .where(eq(links.userId, userId));

  if (existingLinks.length >= SEED_CONFIG.LINK_COUNT) {
    console.log(`✅ Demo links already exist: ${existingLinks.length} links`);
    return existingLinks.map((l: { id: string }) => l.id);
  }

  const linksToCreate = SEED_CONFIG.LINK_COUNT - existingLinks.length;

  for (let i = 0; i < linksToCreate; i++) {
    const linkId = randomUUID();
    const shortCode = `demo${i + 1 + existingLinks.length}${randomInt(100, 999)}`;

    await db.insert(links).values({
      id: linkId,
      userId,
      originalUrl: `https://example.com/demo-page-${i + 1}`,
      shortCode,
      redirectType: 302,
      clicksCount: 0, // Will be updated after events are created
      isActive: true,
      isBanned: false,
      createdAt: new Date(
        Date.now() - SEED_CONFIG.DAYS_BACK * 24 * 60 * 60 * 1000
      ),
      updatedAt: new Date()
    });

    linkIds.push(linkId);
  }

  console.log(`✅ Created ${linksToCreate} demo links`);
  return [...existingLinks.map((l: { id: string }) => l.id), ...linkIds];
}

/**
 * Generate analytics events for a single day
 */
function generateEventsForDay(
  linkIds: string[],
  date: Date
): AnalyticsEventInsert[] {
  const events: AnalyticsEventInsert[] = [];

  for (const linkId of linkIds) {
    // Randomize click count per link (±50% of average)
    const clickCount = randomInt(
      Math.floor(SEED_CONFIG.AVG_CLICKS_PER_LINK_PER_DAY * 0.5),
      Math.ceil(SEED_CONFIG.AVG_CLICKS_PER_LINK_PER_DAY * 1.5)
    );

    for (let i = 0; i < clickCount; i++) {
      const geo = randomFrom(GEO_DATA);
      const eventTime = new Date(date);
      eventTime.setHours(randomInt(0, 23), randomInt(0, 59), randomInt(0, 59));

      events.push({
        id: randomUUID(),
        linkId,
        visitorHash: generateVisitorHash(),
        country: geo.country,
        city: geo.city,
        browser: randomFrom(BROWSERS),
        os: randomFrom(OS_LIST),
        deviceType: randomFrom(DEVICE_TYPES),
        referrer: randomFrom(REFERRERS),
        isBot: Math.random() < 0.02, // 2% bot traffic
        createdAt: eventTime
      });
    }
  }

  return events;
}

/**
 * Aggregate events into daily stats
 */
function aggregateEventsToDaily(
  events: AnalyticsEventInsert[]
): Map<string, LinkClicksDailyInsert> {
  const dailyMap = new Map<string, LinkClicksDailyInsert>();
  const uniqueVisitorsPerDay = new Map<string, Set<string>>();

  for (const event of events) {
    if (!event.createdAt || !event.linkId) continue;

    const dateStr = formatDateString(new Date(event.createdAt));
    const key = `${event.linkId}:${dateStr}`;

    // Track unique visitors
    if (!uniqueVisitorsPerDay.has(key)) {
      uniqueVisitorsPerDay.set(key, new Set());
    }
    uniqueVisitorsPerDay.get(key)?.add(event.visitorHash);

    const existing = dailyMap.get(key);
    if (existing) {
      existing.clicks = (existing.clicks ?? 0) + 1;
    } else {
      dailyMap.set(key, {
        linkId: event.linkId,
        date: dateStr,
        clicks: 1,
        uniqueVisitors: 1 // Will be updated below
      });
    }
  }

  // Update unique visitor counts
  for (const [key, entry] of dailyMap) {
    const uniqueSet = uniqueVisitorsPerDay.get(key);
    if (uniqueSet) {
      entry.uniqueVisitors = uniqueSet.size;
    }
  }

  return dailyMap;
}

/**
 * Update link click counts based on generated events
 */
async function updateLinkClickCounts(
  linkClickMap: Map<string, number>
): Promise<void> {
  for (const [linkId, clickCount] of linkClickMap) {
    await db
      .update(links)
      .set({
        clicksCount: sql`${links.clicksCount} + ${clickCount}`,
        lastClickedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(links.id, linkId));
  }

  console.log(`✅ Updated click counts for ${linkClickMap.size} links`);
}

// ═══════════════════════════════════════════════════════════════════
// MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Main seeder function
 */
async function seedAnalytics(): Promise<void> {
  console.log('🌱 Seeding analytics data...\n');
  const startTime = performance.now();

  try {
    // Step 1: Ensure demo user
    const userId = await ensureDemoUser();

    // Step 2: Create demo links
    const linkIds = await createDemoLinks(userId);

    // Step 3: Generate events for each day
    const dates = getDateRange(SEED_CONFIG.DAYS_BACK);
    const allEvents: AnalyticsEventInsert[] = [];
    const linkClickTotals = new Map<string, number>();

    console.log(`\n📊 Generating events for ${dates.length} days...`);

    for (const date of dates) {
      const dayEvents = generateEventsForDay(linkIds, date);
      allEvents.push(...dayEvents);

      // Track totals per link
      for (const event of dayEvents) {
        if (event.linkId) {
          linkClickTotals.set(
            event.linkId,
            (linkClickTotals.get(event.linkId) ?? 0) + 1
          );
        }
      }
    }

    console.log(`   Generated ${allEvents.length} events total`);

    // Step 4: Batch insert events (chunks of 500)
    console.log('\n💾 Inserting analytics events...');
    const BATCH_SIZE = 500;

    for (let i = 0; i < allEvents.length; i += BATCH_SIZE) {
      const batch = allEvents.slice(i, i + BATCH_SIZE);
      await db.insert(analyticsEvents).values(batch);
      process.stdout.write(
        `   Inserted ${Math.min(i + BATCH_SIZE, allEvents.length)}/${allEvents.length}\r`
      );
    }
    console.log(`\n   ✅ Inserted ${allEvents.length} events`);

    // Step 5: Aggregate and insert daily stats
    console.log('\n📈 Aggregating daily stats...');
    const dailyAggregates = aggregateEventsToDaily(allEvents);

    // Clear existing daily data for demo links to avoid duplicates
    await db.delete(linkClicksDaily).where(
      sql`${linkClicksDaily.linkId} IN (${sql.join(
        linkIds.map((id) => sql`${id}`),
        sql`, `
      )})`
    );

    const dailyValues = Array.from(dailyAggregates.values());
    for (let i = 0; i < dailyValues.length; i += BATCH_SIZE) {
      const batch = dailyValues.slice(i, i + BATCH_SIZE);
      await db.insert(linkClicksDaily).values(batch);
    }
    console.log(`   ✅ Inserted ${dailyValues.length} daily aggregates`);

    // Step 6: Update link click counts
    console.log('\n🔢 Updating link click counts...');
    await updateLinkClickCounts(linkClickTotals);

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Analytics seeding complete in ${elapsed}s`);
    console.log(`   - Users: 1`);
    console.log(`   - Links: ${linkIds.length}`);
    console.log(`   - Events: ${allEvents.length}`);
    console.log(`   - Daily Aggregates: ${dailyValues.length}`);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

// Execute if run directly
seedAnalytics()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
