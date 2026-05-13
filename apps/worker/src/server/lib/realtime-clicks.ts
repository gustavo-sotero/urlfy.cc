/**
 * Realtime click counter shim.
 * Keeps worker imports stable while allowing app-local test doubles.
 */
export { drainPendingClicks } from '@urlfy/cache';
