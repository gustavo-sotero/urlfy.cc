/**
 * Client IP Extraction Utilities
 * Re-exports from the canonical @urlfy/telemetry IP module.
 * This shim preserves the `@/server/lib/ip` import alias.
 */
export {
  getClientIp,
  getClientIpFromHeaders,
  isPrivateIp,
  isValidIp,
  maskIpForLog
} from '@urlfy/telemetry/ip';
