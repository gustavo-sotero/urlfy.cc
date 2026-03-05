import { Elysia } from 'elysia';
import { db } from '@urlfy/data';

// @ts-ignore: TS2742 - drizzle-orm bun-sql internal type reference (harmless for Eden Treaty)
export const databasePlugin = new Elysia({ name: 'database' }).decorate(
  'db',
  db
);
