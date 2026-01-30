import { Elysia } from 'elysia';
import { db } from '@/db';

export const databasePlugin = new Elysia({ name: 'database' }).decorate(
  'db',
  db
);
