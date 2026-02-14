/**
 * @deprecated Import from '@/server/modules/links/services/url-validator' instead.
 * This adapter exists for backward compatibility during migration.
 */

export type {
  ValidationError,
  ValidationResult
} from '@/server/modules/links/services/url-validator';
export {
  blockDomain,
  blockDomainPersistent,
  isBlockedHostname,
  isDomainBlocked,
  isPrivateIP,
  reloadBannedDomains,
  unblockDomain,
  validateUrl,
  validateUrlAsync,
  validateUrlSafe
} from '@/server/modules/links/services/url-validator';
