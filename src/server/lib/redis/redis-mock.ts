import type { RedisClient } from 'bun';
import type { InMemoryValue, ZSetEntry } from './types';

const inMemoryStore = new Map<string, InMemoryValue>();
const inMemoryZSets = new Map<string, ZSetEntry[]>();
const inMemorySets = new Map<string, Set<string>>();
const scriptStore = new Map<string, string>();

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
    if (inMemorySets.delete(key)) count++;
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
          inMemorySets.clear();
          scriptStore.clear();
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
        case 'SADD': {
          const [key, ...members] = args;
          let set = inMemorySets.get(key);
          if (!set) {
            set = new Set<string>();
            inMemorySets.set(key, set);
          }
          let added = 0;
          for (const m of members) {
            if (!set.has(m)) {
              set.add(m);
              added++;
            }
          }
          return added;
        }
        case 'SMEMBERS': {
          const set = inMemorySets.get(args[0]);
          return set ? Array.from(set) : [];
        }
        case 'SREM': {
          const [key, ...members] = args;
          const set = inMemorySets.get(key);
          if (!set) return 0;
          let removed = 0;
          for (const m of members) {
            if (set.delete(m)) removed++;
          }
          return removed;
        }
        case 'SCRIPT': {
          // SCRIPT LOAD <script> — simulate returning a SHA hash
          if (args[0]?.toUpperCase() === 'LOAD') {
            const script = args[1] ?? '';
            // Store script and return deterministic SHA
            const sha = `mock_sha_${Buffer.from(script).toString('base64').slice(0, 16)}`;
            scriptStore.set(sha, script);
            return sha;
          }
          return null;
        }
        case 'EVAL':
        case 'EVALSHA': {
          // EVAL/EVALSHA <script_or_sha> <numkeys> <keys...> <args...>
          const scriptOrSha = args[0];
          const numKeys = Number.parseInt(args[1], 10);
          const keys = args.slice(2, 2 + numKeys);
          const scriptArgs = args.slice(2 + numKeys);

          // For EVALSHA, verify script exists
          if (cmd === 'EVALSHA' && !scriptStore.has(scriptOrSha)) {
            throw new Error('NOSCRIPT No matching script');
          }

          // Execute the sliding-window logic in-memory (matches the Lua script behavior)
          const key = keys[0];
          const windowStart = Number(scriptArgs[0]);
          const now = Number(scriptArgs[1]);
          const maxPoints = Number(scriptArgs[2]);
          const member = scriptArgs[4];

          // ZREMRANGEBYSCORE key -inf windowStart
          const entries = getZSet(key).filter(
            (entry) => entry.score > windowStart
          );
          setZSet(key, entries);

          // ZCARD
          const count = entries.length;

          if (count < maxPoints) {
            // ZADD key now member
            entries.push({ score: now, member });
            setZSet(key, entries);
            return [1, count + 1];
          }

          return [0, count];
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
