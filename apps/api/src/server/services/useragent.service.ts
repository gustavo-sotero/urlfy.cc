// src/server/services/useragent.service.ts

import { UAParser } from 'ua-parser-js';
import { createLogger } from '@/server/lib/telemetry';
import type { UserAgentData } from '@/types/analytics.types';

const logger = createLogger('useragent-service');

const BOT_PATTERNS = [
  /bot/i,
  /crawler/i,
  /spider/i,
  /crawling/i,
  /googlebot/i,
  /bingbot/i,
  /slurp/i,
  /duckduckbot/i,
  /baiduspider/i,
  /yandexbot/i,
  /facebookexternalhit/i,
  /twitterbot/i,
  /linkedinbot/i,
  /whatsapp/i,
  /ia_archiver/i,
  /curl/i,
  /wget/i,
  /python/i,
  /java/i,
  /node/i,
  /requests/i,
  /axios/i,
  /scrapy/i,
  /phantom/i,
  /selenium/i,
  /headless/i
];

class UserAgentService {
  /**
   * Parse user agent string and return structured data
   */
  parse(userAgent: string): UserAgentData {
    try {
      const parser = new UAParser(userAgent);
      const ua = parser.getResult();

      const isBot = this.detectBot(userAgent);

      const deviceType = this.mapDeviceType(ua.device?.type);

      return {
        browser: ua.browser?.name || null,
        browserVersion: ua.browser?.version || null,
        os: ua.os?.name || null,
        osVersion: ua.os?.version || null,
        deviceType,
        isBot
      };
    } catch (error) {
      logger.warn('[UserAgentService] Error parsing user agent', {
        error: error instanceof Error ? error.message : String(error),
        userAgentLength: userAgent.length
      });

      // Fallback if parsing fails
      return {
        browser: null,
        browserVersion: null,
        os: null,
        osVersion: null,
        deviceType: null,
        isBot: this.detectBot(userAgent)
      };
    }
  }

  /**
   * Detect whether the user agent is a bot
   */
  private detectBot(userAgent: string): boolean {
    if (!userAgent) return false;

    return BOT_PATTERNS.some((pattern) => pattern.test(userAgent));
  }

  /**
   * Map device type to standard values
   * Returns "desktop" by default for browsers without a specific type
   */
  private mapDeviceType(type?: string): 'desktop' | 'mobile' | 'tablet' | null {
    if (!type) return 'desktop'; // Desktop browsers don't have device type set

    switch (type.toLowerCase()) {
      case 'mobile':
        return 'mobile';
      case 'tablet':
        return 'tablet';
      case 'console':
      case 'smarttv':
      case 'wearable':
        return 'desktop'; // Group as desktop to simplify
      default:
        return 'desktop';
    }
  }
}

export const userAgentService = new UserAgentService();

/**
 * Helper for one-off parsing
 */
export function parseUserAgent(userAgent: string): UserAgentData {
  return userAgentService.parse(userAgent);
}

/**
 * Helper for bot detection
 */
export function isBot(userAgent: string): boolean {
  const parsed = parseUserAgent(userAgent);
  return parsed.isBot;
}
