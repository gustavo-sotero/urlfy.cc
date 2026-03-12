/**
 * Lock shim - re-exports canonical distributed lock helpers from @urlfy/cache.
 * All TTLs are in milliseconds (uses Redis PX under the hood).
 */

export { acquireLock, releaseLock } from '@urlfy/cache';
