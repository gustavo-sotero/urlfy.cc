/**
 * Client IP Extraction Utilities
 * Re-exports from canonical @urlfy/telemetry package.
 * This shim preserves the `@/server/lib/ip` import alias.
 */
export {
  getClientIp,
  getClientIpFromHeaders,
  isPrivateIp,
  isValidIp,
  maskIpForLog
} from '@urlfy/telemetry';
