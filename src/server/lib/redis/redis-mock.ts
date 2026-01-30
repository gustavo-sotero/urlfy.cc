import type { RedisClient } from 'bun';
import type { InMemoryValue, ZSetEntry } from './types';

const inMemoryStore = new Map<string, InMemoryValue>();
const inMemoryZSets = new Map<string, ZSetEntry[]>();

function isExpired(entry?: InMemoryValue): boolean {
  if (!entry?.expiresAt) return false;
  return Date.now() > entry.expiresAt;
}

function getStoreValue(key: string): string | null {
  const entry = inMemoryStore.get(key);
  if (!entry) return null;
  if (isExpired(entry)) {
    inMemoryStore.delete(key);
    return null;
  }
  return entry.value;
}

function setStoreValue(key: string, value: string, ttlSeconds?: number): void {
  const expiresAt =
    typeof ttlSeconds === 'number' ? Date.now() + ttlSeconds * 1000 : undefined;
  inMemoryStore.set(key, { value, expiresAt });
}

function deleteStoreKeys(keys: string[]): number {
  let count = 0;
  for (const key of keys) {
    if (inMemoryStore.delete(key)) count++;
    if (inMemoryZSets.delete(key)) count++;
  }
  return count;
}

function matchPattern(pattern: string, key: string): boolean {
  const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
  return regex.test(key);
}

function getZSet(key: string): ZSetEntry[] {
  return inMemoryZSets.get(key) ?? [];
}

function setZSet(key: string, entries: ZSetEntry[]): void {
  inMemoryZSets.set(key, entries);
}

export function createInMemoryRedisClient(): RedisClient {
  const client = {
    get: async (key: string) => getStoreValue(key),
    set: async (key: string, value: string) => {
      setStoreValue(key, value);
      return 'OK';
    },
    setex: async (key: string, ttl: number, value: string) => {
      setStoreValue(key, value, ttl);
      return 'OK';
    },
    del: async (...keys: string[]) => deleteStoreKeys(keys),
    keys: async (pattern: string) =>
      Array.from(inMemoryStore.keys()).filter((key) =>
        matchPattern(pattern, key)
      ),
    ttl: async (key: string) => {
      const entry = inMemoryStore.get(key);
      if (!entry) return -2;
      if (!entry.expiresAt) return -1;
      const remainingMs = entry.expiresAt - Date.now();
      return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : -2;
    },
    pttl: async (key: string) => {
      const entry = inMemoryStore.get(key);
      if (!entry) return -2;
      if (!entry.expiresAt) return -1;
      const remainingMs = entry.expiresAt - Date.now();
      return remainingMs > 0 ? remainingMs : -2;
    },
    incr: async (key: string) => {
      const current = Number.parseInt(getStoreValue(key) ?? '0', 10);
      const next = current + 1;
      setStoreValue(key, String(next));
      return next;
    },
    expire: async (key: string, ttl: number) => {
      const entry = inMemoryStore.get(key);
      if (!entry) return 0;
      setStoreValue(key, entry.value, ttl);
      return 1;
    },
    pexpire: async (key: string, ttlMs: number) => {
      const entry = inMemoryStore.get(key);
      if (!entry) return 0;
      inMemoryStore.set(key, {
        value: entry.value,
        expiresAt: Date.now() + ttlMs
      });
      return 1;
    },
    zcount: async (key: string, min: number, max: number) => {
      const entries = getZSet(key).filter(
        (entry) => entry.score >= min && entry.score <= max
      );
      return entries.length;
    },
    send: async (command: string, args: string[]) => {
      const cmd = command.toUpperCase();

      switch (cmd) {
        case 'PING':
          return 'PONG';
        case 'EXISTS':
          return getStoreValue(args[0]) !== null ? 1 : 0;
        case 'INFO':
          if (args[0]?.toLowerCase() === 'memory') {
            return '# Memory\r\nused_memory_human:1.5M\r\n';
          }
          return '# Stats\r\nkeyspace_hits:0\r\nkeyspace_misses:0\r\n';
        case 'DBSIZE':
          return inMemoryStore.size;
        case 'FLUSHALL':
          inMemoryStore.clear();
          inMemoryZSets.clear();
          return 'OK';
        case 'ZREMRANGEBYSCORE': {
          const [key, min, max] = args;
          const minVal = Number.parseFloat(min);
          const maxVal = Number.parseFloat(max);
          const entries = getZSet(key).filter(
            (entry) => entry.score < minVal || entry.score > maxVal
          );
          setZSet(key, entries);
          return 1;
        }
        case 'ZCARD': {
          const entries = getZSet(args[0]);
          return entries.length;
        }
        case 'ZADD': {
          const [key, score, member] = args;
          const entries = getZSet(key);
          entries.push({ score: Number(score), member });
          setZSet(key, entries);
          return 1;
        }
        case 'EXPIRE': {
          const [key, ttl] = args;
          const entry = inMemoryStore.get(key);
          if (!entry) return 0;
          setStoreValue(key, entry.value, Number(ttl));
          return 1;
        }
        case 'ZCOUNT': {
          const [key, min, max] = args;
          const minVal = Number(min);
          const maxVal = Number(max);
          const entries = getZSet(key).filter(
            (entry) => entry.score >= minVal && entry.score <= maxVal
          );
          return entries.length;
        }
        case 'INCR': {
          return client.incr(args[0]);
        }
        case 'PEXPIRE': {
          return client.pexpire(args[0], Number(args[1]));
        }
        default:
          return null;
      }
    },
    pipeline: () => ({
      del: async (...keys: string[]) => deleteStoreKeys(keys),
      exec: async () => []
    }),
    close: () => {}
  } as unknown as RedisClient;

  return client;
}
