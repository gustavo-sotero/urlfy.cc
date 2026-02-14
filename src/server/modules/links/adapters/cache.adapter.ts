import { cacheService } from '@/server/services/cache.service';

export const linksCacheAdapter = {
  async invalidateLinkAndQR(
    shortCode: string,
    reason?: 'ban' | 'deleted' | 'not_found'
  ) {
    await cacheService.invalidateLinkAndQR(shortCode, reason);
  }
};
