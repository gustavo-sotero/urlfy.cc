#!/usr/bin/env bun

import { desc, sql } from 'drizzle-orm';
import { ALIAS_REGEX } from '../packages/contracts/src/alias-policy';
import { closeDatabase, db } from '../packages/data/src';
import { links } from '../packages/data/src/schema';

const DEFAULT_SAMPLE_LIMIT = 25;

function getSampleLimit(argv: string[]): number {
  const limitArg = argv.find((arg) => arg.startsWith('--limit='));

  if (!limitArg) {
    return DEFAULT_SAMPLE_LIMIT;
  }

  const parsed = Number.parseInt(limitArg.slice('--limit='.length), 10);

  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 200) {
    throw new Error('--limit must be an integer between 1 and 200');
  }

  return parsed;
}

async function main(): Promise<void> {
  const sampleLimit = getSampleLimit(process.argv.slice(2));
  const postgresRegex = ALIAS_REGEX.source;

  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(links)
      .where(sql`${links.shortCode} !~ ${postgresRegex}`);

    if (count === 0) {
      console.log(
        `OK: every persisted short_code matches ${ALIAS_REGEX.source}`
      );
      return;
    }

    const invalidRows = await db
      .select({
        id: links.id,
        shortCode: links.shortCode,
        isActive: links.isActive,
        deletedAt: links.deletedAt,
        createdAt: links.createdAt
      })
      .from(links)
      .where(sql`${links.shortCode} !~ ${postgresRegex}`)
      .orderBy(desc(links.createdAt))
      .limit(sampleLimit);

    console.error(
      [
        `FAIL: found ${count} persisted short_code value(s) outside the canonical alias policy ${ALIAS_REGEX.source}.`,
        'Sample rows:',
        ...invalidRows.map((row) => {
          const deletedState = row.deletedAt ? 'deleted' : 'live';
          const activeState = row.isActive ? 'active' : 'inactive';
          const createdAt = row.createdAt.toISOString();
          return `- ${row.shortCode} | id=${row.id} | ${activeState} | ${deletedState} | createdAt=${createdAt}`;
        }),
        'Run this check before tightening alias rules or after importing historical link data.'
      ].join('\n')
    );

    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}

main().catch(async (error) => {
  console.error(
    error instanceof Error ? error.message : 'Alias policy validation failed'
  );
  await closeDatabase().catch(() => undefined);
  process.exit(1);
});
