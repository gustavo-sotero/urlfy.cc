import type { RedisClient } from 'bun';
import type { InMemoryValue, ZSetEntry } from './types';

const inMemoryStore = new Map<string, InMemoryValue>();
const inMemoryZSets = new Map<string, ZSetEntry[]>();
const inMemorySets = new Map<string, Set<string>>();
const scriptStore = new Map<string, string>();

// --- Stream support ---
interface StreamEntry {
  id: string;
  fields: string[]; // [key1, val1, key2, val2, ...]
}
interface ConsumerGroupState {
  lastId: string;
  pending: Map<
    string,
    { consumer: string; deliveredAt: number; entry: StreamEntry }
  >;
}
const inMemoryStreams = new Map<string, StreamEntry[]>();
const inMemoryGroups = new Map<string, Map<string, ConsumerGroupState>>();

let streamSeqCounter = 0;

function generateStreamId(): string {
  return `${Date.now()}-${streamSeqCounter++}`;
}

function getStream(key: string): StreamEntry[] {
  let entries = inMemoryStreams.get(key);
  if (!entries) {
    entries = [];
    inMemoryStreams.set(key, entries);
  }
  return entries;
}

function getGroupsForStream(key: string): Map<string, ConsumerGroupState> {
  let groups = inMemoryGroups.get(key);
  if (!groups) {
    groups = new Map();
    inMemoryGroups.set(key, groups);
  }
  return groups;
}

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
    if (inMemoryStreams.delete(key)) count++;
    if (inMemoryGroups.delete(key)) count++;
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
    set: async (key: string, value: string, ...args: string[]) => {
      const exIndex = args.findIndex((arg) => arg.toUpperCase() === 'EX');
      const ttlSeconds =
        exIndex !== -1
          ? Number.parseInt(args[exIndex + 1] ?? '', 10)
          : undefined;

      setStoreValue(
        key,
        value,
        Number.isFinite(ttlSeconds) ? ttlSeconds : undefined
      );
      return 'OK';
    },
    getset: async (key: string, value: string) => {
      const previous = getStoreValue(key);
      setStoreValue(key, value);
      return previous;
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
    incrby: async (key: string, amount: number) => {
      const current = Number.parseInt(getStoreValue(key) ?? '0', 10);
      const next = current + amount;
      setStoreValue(key, String(next));
      return next;
    },
    decrby: async (key: string, amount: number) => {
      const current = Number.parseInt(getStoreValue(key) ?? '0', 10);
      const next = current - amount;
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
          inMemoryStreams.clear();
          inMemoryGroups.clear();
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
        case 'INCRBY': {
          return client.incrby(args[0], Number(args[1]));
        }
        case 'DECRBY': {
          return client.decrby(args[0], Number(args[1]));
        }
        case 'MGET': {
          return args.map((key) => getStoreValue(key));
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
        // --- Stream Commands ---
        case 'XADD': {
          // XADD key [MAXLEN [~] count] id field value [field value ...]
          // Find where fields start (skip MAXLEN options if present)
          let pos = 0;
          const streamKey = args[pos++];
          // Skip MAXLEN
          if (args[pos]?.toUpperCase() === 'MAXLEN') {
            pos++; // skip MAXLEN
            if (args[pos] === '~') pos++; // skip ~
            pos++; // skip count
          }
          const msgId = args[pos] === '*' ? generateStreamId() : args[pos];
          pos++;
          const fields = args.slice(pos);
          const entry: StreamEntry = { id: msgId, fields };
          getStream(streamKey).push(entry);
          return msgId;
        }
        case 'XGROUP': {
          // XGROUP CREATE key group id [MKSTREAM]
          const subCmd = args[0]?.toUpperCase();
          if (subCmd === 'CREATE') {
            const [, streamKey, groupName, startId] = args;
            const groups = getGroupsForStream(streamKey);
            if (groups.has(groupName)) {
              throw new Error('BUSYGROUP Consumer Group name already exists');
            }
            groups.set(groupName, {
              lastId:
                startId === '$'
                  ? (getStream(streamKey).at(-1)?.id ?? '0-0')
                  : (startId ?? '0-0'),
              pending: new Map()
            });
            return 'OK';
          }
          if (subCmd === 'SETID') {
            const [, streamKey, groupName, newId] = args;
            const groups = getGroupsForStream(streamKey);
            const grp = groups.get(groupName);
            if (grp) grp.lastId = newId;
            return 'OK';
          }
          if (subCmd === 'DESTROY') {
            const [, streamKey, groupName] = args;
            getGroupsForStream(streamKey).delete(groupName);
            return 1;
          }
          return 'OK';
        }
        case 'XREADGROUP': {
          // XREADGROUP GROUP group consumer [COUNT count] [BLOCK ms] STREAMS key [key ...] id [id ...]
          let p = 0;
          if (args[p++]?.toUpperCase() !== 'GROUP') return [];
          const groupName = args[p++];
          const consumer = args[p++];
          let count = 10;
          while (p < args.length && args[p]?.toUpperCase() !== 'STREAMS') {
            if (args[p]?.toUpperCase() === 'COUNT') count = Number(args[++p]);
            p++;
          }
          p++; // skip STREAMS
          const streamsStart = p;
          const midpoint =
            streamsStart + Math.floor((args.length - streamsStart) / 2);
          const keys = args.slice(streamsStart, midpoint);
          const ids = args.slice(midpoint);

          const result: unknown[][] = [];
          for (let i = 0; i < keys.length; i++) {
            const streamKey = keys[i];
            const id = ids[i] ?? '>';
            const streamEntries = getStream(streamKey);
            const groups = getGroupsForStream(streamKey);
            const grp = groups.get(groupName);
            if (!grp) {
              result.push([streamKey, []]);
              continue;
            }

            let msgs: StreamEntry[];
            if (id === '>') {
              // New messages after lastId
              msgs = streamEntries
                .filter((e) => e.id > grp.lastId)
                .slice(0, count);
              if (msgs.length > 0) grp.lastId = msgs[msgs.length - 1].id;
            } else {
              // Re-deliver pending for this consumer
              msgs = Array.from(grp.pending.values())
                .filter((p2) => p2.consumer === consumer)
                .map((p2) => p2.entry)
                .slice(0, count);
            }
            // Track pending
            for (const msg of msgs) {
              grp.pending.set(msg.id, {
                consumer,
                deliveredAt: Date.now(),
                entry: msg
              });
            }
            const msgArray = msgs.map((m) => [m.id, m.fields]);
            result.push([streamKey, msgArray]);
          }
          return result.length > 0 ? result : [];
        }
        case 'XACK': {
          // XACK key group id [id ...]
          const [streamKey, groupName, ...msgIds] = args;
          const grp = getGroupsForStream(streamKey).get(groupName);
          if (!grp) return 0;
          let acked = 0;
          for (const id of msgIds) {
            if (grp.pending.delete(id)) acked++;
          }
          return acked;
        }
        case 'XLEN': {
          return getStream(args[0]).length;
        }
        case 'XINFO': {
          const subCmd = args[0]?.toUpperCase();
          const streamKey = args[1];
          if (subCmd === 'STREAM') {
            const entries = getStream(streamKey);
            return [
              'length',
              entries.length,
              'radix-tree-keys',
              1,
              'radix-tree-nodes',
              2,
              'last-generated-id',
              entries.at(-1)?.id ?? '0-0'
            ];
          }
          if (subCmd === 'GROUPS') {
            const groups = getGroupsForStream(streamKey);
            return Array.from(groups.entries()).map(([name, grp]) => [
              'name',
              name,
              'consumers',
              0,
              'pending',
              grp.pending.size,
              'last-delivered-id',
              grp.lastId
            ]);
          }
          return [];
        }
        case 'XAUTOCLAIM': {
          // XAUTOCLAIM key group consumer min-idle-time start [COUNT count]
          const [streamKey, groupName, consumer, , start] = args;
          let count = 10;
          const countIdx = args.indexOf('COUNT');
          if (countIdx !== -1) count = Number(args[countIdx + 1]);
          const grp = getGroupsForStream(streamKey).get(groupName);
          if (!grp) return ['0-0', []];
          const idleThreshold = Date.now() - 0; // claim all for testing
          const claimable = Array.from(grp.pending.entries())
            .filter(
              ([id, p2]) => id >= start && p2.deliveredAt <= idleThreshold
            )
            .slice(0, count);
          const msgs = claimable.map(([id, p2]) => {
            grp.pending.set(id, {
              consumer,
              deliveredAt: Date.now(),
              entry: p2.entry
            });
            return [id, p2.entry.fields];
          });
          return ['0-0', msgs];
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
