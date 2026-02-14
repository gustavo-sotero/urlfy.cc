/**
 * @deprecated Import from '@/server/modules/links/services/qr.service' instead.
 * This adapter exists for backward compatibility during migration.
 */

export type {
  QRFormat,
  QRSize
} from '@/server/modules/links/services/qr.service';
export {
  generateQRCode,
  invalidateQRCache,
  validateQRFormat,
  validateQRSize
} from '@/server/modules/links/services/qr.service';
