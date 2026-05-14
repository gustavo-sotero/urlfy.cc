/**
 * Redis barrel shim.
 * Uses explicit named re-exports (not `export *`) so Bun can statically
 * enumerate the exported names when tests call mock.module on this path.
 * `export *` across workspace packages is not reliably resolved by Bun's
 * module registry during mock setup.
 */
export {
  canAttemptRedisCommand,
  checkRedisHealth,
  closeRedis,
  getRedisClient,
  getRedisHealthSnapshot,
  markRedisCommandFailure,
  markRedisCommandSuccess,
  redis,
  shouldLogRedisFailure
} from './redis';
