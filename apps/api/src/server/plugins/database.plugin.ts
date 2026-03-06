import { db } from '@urlfy/data';
import { Elysia } from 'elysia';

export const databasePlugin = new Elysia({ name: 'database' }).decorate(
  'db',
  db
);
