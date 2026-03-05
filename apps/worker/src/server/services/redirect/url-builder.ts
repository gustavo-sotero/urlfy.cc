import { createLogger } from '@/server/lib/telemetry';
import type { CachedLink } from '@/types/redirect.types';

const logger = createLogger('redirect-url-builder');

/**
 * Build final URL with UTM parameters
 */
export function buildFinalUrl(link: CachedLink): string {
  try {
    const url = new URL(link.originalUrl);

    // Add UTMs when configured
    if (link.utmSource) {
      url.searchParams.set('utm_source', link.utmSource);
    }
    if (link.utmMedium) {
      url.searchParams.set('utm_medium', link.utmMedium);
    }
    if (link.utmCampaign) {
      url.searchParams.set('utm_campaign', link.utmCampaign);
    }

    return url.toString();
  } catch (error) {
    logger.error('Error building final URL', {
      linkId: link.id,
      originalUrl: link.originalUrl,
      error: error instanceof Error ? error.message : String(error)
    });
    // Return original URL in case of error
    return link.originalUrl;
  }
}
