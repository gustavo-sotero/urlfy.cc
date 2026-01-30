import { redis } from '@/server/lib/redis';
import { invalidateQRCache } from '@/server/services/qr.service';

export const LinkCacheService = {
  /**
   * Invalidate link cache
   */
  async invalidateLinkCache(
    code: string,
    reason: 'update' | 'ban' | 'delete'
  ): Promise<void> {
    try {
      const commands: Promise<unknown>[] = [
        redis.del(`link:${code}`),
        redis.del(`link:meta:${code}`)
      ];

      if (reason === 'delete') {
        commands.push(
          redis.send('SET', [`link:404:${code}`, '1', 'EX', '300'])
        );
      } else if (reason === 'ban') {
        commands.push(
          redis.send('SET', [`link:banned:${code}`, '1', 'EX', '86400'])
        );
      }

      await Promise.all(commands);

      // Invalida QR codes
      await invalidateQRCache(code);
    } catch (_error) {
      // Cache invalidation is non-critical - log but don't throw
      // Actual error is already logged by cache service
    }
  }
};
