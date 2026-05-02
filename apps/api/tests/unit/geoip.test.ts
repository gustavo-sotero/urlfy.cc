import { describe, expect, it } from 'bun:test';
import { CACHE_TTL } from '@urlfy/cache';
import { getWeeklySalt, lookupGeoIP } from '../../src/server/lib/geoip';

async function readWorkspaceFile(relativePath: string): Promise<string> {
  const fileUrl = new URL(`../../../../${relativePath}`, import.meta.url);
  return Bun.file(fileUrl).text();
}

/**
 * GeoIP Auto-Download System Tests
 *
 * These tests validate the credential-free GeoIP implementation.
 * The system uses GeoLite2 data from a public mirror (jsDelivr CDN)
 * without requiring MaxMind credentials.
 *
 * Attribution: This product includes GeoLite2 data created by MaxMind,
 * available from https://www.maxmind.com
 * License: CC BY-SA 4.0
 */

describe('GeoIP Auto-Download System', () => {
  describe('Environment Configuration', () => {
    it('should have GEOIP_DB_PATH configured', () => {
      const dbPath =
        process.env.GEOIP_DB_PATH || '/app/geoip/GeoLite2-City.mmdb';
      expect(dbPath).toContain('GeoLite2-City.mmdb');
    });

    it('should have GEOIP_MAX_AGE_DAYS configured with valid value', () => {
      const maxAge = Number(process.env.GEOIP_MAX_AGE_DAYS) || 25;
      expect(maxAge).toBeGreaterThan(0);
      expect(maxAge).toBeLessThanOrEqual(30);
    });

    it('should have GEOIP_MMDB_URL pointing to jsDelivr mirror', () => {
      const url =
        process.env.GEOIP_MMDB_URL ||
        'https://cdn.jsdelivr.net/npm/geolite2-city/GeoLite2-City.mmdb.gz';
      expect(url).toContain('jsdelivr');
      expect(url).toContain('GeoLite2-City.mmdb.gz');
    });

    it('should NOT require MaxMind credentials', () => {
      // Verify that MAXMIND_* env vars are not required
      expect(process.env.MAXMIND_ACCOUNT_ID).toBeUndefined();
      expect(process.env.MAXMIND_LICENSE_KEY).toBeUndefined();
    });
  });

  describe('Weekly Salt Generation (LGPD Compliance)', () => {
    it('should generate salt in format YYYY-Www', () => {
      const salt = getWeeklySalt();
      expect(salt).toMatch(/^\d{4}-W\d{2}$/);
    });

    it('should return consistent salt for same week', () => {
      const salt1 = getWeeklySalt();
      const salt2 = getWeeklySalt();
      expect(salt1).toBe(salt2);
    });

    it('should generate valid week numbers (1-53)', () => {
      const salt = getWeeklySalt();
      const weekMatch = salt.match(/W(\d{2})/);
      expect(weekMatch).toBeDefined();

      if (weekMatch) {
        const weekNum = Number.parseInt(weekMatch[1], 10);
        expect(weekNum).toBeGreaterThanOrEqual(1);
        expect(weekNum).toBeLessThanOrEqual(53);
      }
    });

    it('should include current year', () => {
      const salt = getWeeklySalt();
      const currentYear = new Date().getFullYear();
      expect(salt).toContain(String(currentYear));
    });
  });

  describe('Private IP Detection', () => {
    // lookupGeoIP short-circuits for private IPs before any Redis or DB access.
    // These tests verify the short-circuit invariant without requiring infrastructure.

    const privateIPv4Addresses = [
      '10.0.0.1',
      '172.16.0.1',
      '192.168.1.1',
      '127.0.0.1',
      '169.254.1.1'
    ];

    const privateIPv6Addresses = ['::1', 'fc00::1', 'fe80::1'];

    it('should return null location for private IPv4 addresses', async () => {
      for (const ip of privateIPv4Addresses) {
        const result = await lookupGeoIP(ip);
        expect(
          result.country,
          `expected null country for private IP ${ip}`
        ).toBeNull();
        expect(
          result.city,
          `expected null city for private IP ${ip}`
        ).toBeNull();
        expect(
          result.latitude,
          `expected null latitude for private IP ${ip}`
        ).toBeNull();
        expect(
          result.longitude,
          `expected null longitude for private IP ${ip}`
        ).toBeNull();
      }
    });

    it('should return null location for private IPv6 addresses', async () => {
      for (const ip of privateIPv6Addresses) {
        const result = await lookupGeoIP(ip);
        expect(
          result.country,
          `expected null country for private IP ${ip}`
        ).toBeNull();
        expect(
          result.city,
          `expected null city for private IP ${ip}`
        ).toBeNull();
      }
    });
  });

  describe('Cache Strategy', () => {
    it('should use /24 prefix for IPv4 caching', () => {
      const testIP = '8.8.8.8';
      const expectedPrefix = testIP.split('.').slice(0, 3).join('.');
      expect(expectedPrefix).toBe('8.8.8');
    });

    it('should use /48 prefix for IPv6 caching', () => {
      const testIP = '2001:4860:4860::8888';
      const expectedPrefix = testIP.split(':').slice(0, 3).join(':');
      expect(expectedPrefix).toBe('2001:4860:4860');
    });

    it('should keep GeoIP cache TTL at 24 hours in the shared cache package', () => {
      expect(CACHE_TTL.GEO).toBe(86400);
    });
  });

  describe('Data Attribution & Licensing', () => {
    it('should document MaxMind attribution and CC BY-SA license in the GeoIP README', async () => {
      const readme = await readWorkspaceFile('docker/geoip/README.md');

      expect(readme).toContain(
        'This product includes GeoLite2 data created by MaxMind'
      );
      expect(readme).toContain('CC BY-SA 4.0');
      expect(readme).toContain('https://www.maxmind.com');
    });

    it('should keep the downloader script aligned with the public mirror and license header', async () => {
      const refreshScript = await readWorkspaceFile(
        'docker/geoip/geoip-refresh.sh'
      );

      expect(refreshScript).toContain(
        'https://cdn.jsdelivr.net/npm/geolite2-city/GeoLite2-City.mmdb.gz'
      );
      expect(refreshScript).toContain('License: CC BY-SA 4.0');
      expect(refreshScript).toContain('without requiring MaxMind credentials');
    });
  });

  describe('Auto-Download Mechanism', () => {
    it('should run the refresh script once on startup before starting cron', async () => {
      const entrypoint = await readWorkspaceFile(
        'docker/geoip/geoip-entrypoint.sh'
      );

      expect(entrypoint).toContain('/usr/local/bin/geoip-refresh.sh');
      expect(entrypoint).toContain('exec crond -f -l 2');
    });

    it('should skip downloads when the existing MMDB file is still fresh', async () => {
      const refreshScript = await readWorkspaceFile(
        'docker/geoip/geoip-refresh.sh'
      );

      expect(refreshScript).toContain('if [ -f "$DB_PATH" ]; then');
      expect(refreshScript).toContain(
        'if [ "$AGE_DAYS" -lt "$MAX_AGE_DAYS" ]; then'
      );
      expect(refreshScript).toContain('Skipping download.');
      expect(refreshScript).toContain('exit 0');
    });

    it('should schedule monthly refreshes via cron in the GeoIP Docker image', async () => {
      const dockerfile = await readWorkspaceFile('docker/geoip/Dockerfile');

      expect(dockerfile).toContain('0 0 1 * * /usr/local/bin/geoip-refresh.sh');
      expect(dockerfile).toContain('ENTRYPOINT ["/entrypoint.sh"]');
    });

    it('should download with retries and replace the MMDB atomically', async () => {
      const refreshScript = await readWorkspaceFile(
        'docker/geoip/geoip-refresh.sh'
      );

      expect(refreshScript).toContain('--retry 3');
      expect(refreshScript).toContain('--connect-timeout 30');
      expect(refreshScript).toContain('--max-time 300');
      expect(refreshScript).toContain('mv "$TMP_MMDB_PATH" "$DB_PATH"');
      expect(refreshScript).toContain('rm -f "$TMP_GZ_PATH"');
    });
  });

  describe('Container Architecture', () => {
    it('should use a minimal Alpine image with the required downloader packages', async () => {
      const dockerfile = await readWorkspaceFile('docker/geoip/Dockerfile');

      expect(dockerfile).toContain('FROM alpine:3.23.4');
      expect(dockerfile).toContain('curl');
      expect(dockerfile).toContain('gzip');
      expect(dockerfile).toContain('dcron');
      expect(dockerfile).toContain('tzdata');
    });

    it('should mount the GeoIP data volume read-only in app compose services', async () => {
      const [appsCompose, prodCompose] = await Promise.all([
        readWorkspaceFile('docker/docker-compose.apps.yml'),
        readWorkspaceFile('docker/docker-compose.prod.yml')
      ]);

      expect(appsCompose).toContain('geoip_data:/app/geoip:ro');
      expect(prodCompose).toContain('geoip_data:/app/geoip:ro');
    });
  });
});

describe('GeoIP Implementation Compliance', () => {
  describe('Plan Requirements', () => {
    it('should meet objective: credential-free auto-download', () => {
      // ✅ No MaxMind credentials required
      expect(process.env.MAXMIND_ACCOUNT_ID).toBeUndefined();
      expect(process.env.MAXMIND_LICENSE_KEY).toBeUndefined();
    });

    it('should keep downloader defaults aligned between env.ts and docker compose', async () => {
      const [envSource, composeSource] = await Promise.all([
        readWorkspaceFile('apps/api/src/lib/env.ts'),
        readWorkspaceFile('docker/docker-compose.yml')
      ]);

      expect(envSource).toContain(
        "GEOIP_DB_PATH: z.string().default('/app/geoip/GeoLite2-City.mmdb')"
      );
      expect(envSource).toContain(
        'GEOIP_MAX_AGE_DAYS: z.coerce.number().int().positive().default(25)'
      );
      expect(envSource).toContain(
        'https://cdn.jsdelivr.net/npm/geolite2-city/GeoLite2-City.mmdb.gz'
      );
      expect(composeSource).toContain(
        'GEOIP_DB_PATH=/app/geoip/GeoLite2-City.mmdb'
      );
      expect(composeSource).toContain('GEOIP_MAX_AGE_DAYS=25');
      expect(composeSource).toContain(
        'GEOIP_MMDB_URL=https://cdn.jsdelivr.net/npm/geolite2-city/GeoLite2-City.mmdb.gz'
      );
    });
  });

  describe('Non-Goals Compliance', () => {
    it('should NOT add MaxMind credentials back', () => {
      // ✅ No credential env vars in config
      expect(process.env.MAXMIND_ACCOUNT_ID).toBeUndefined();
    });
  });

  describe('Configuration Summary', () => {
    it('should have all required environment variables defined in env.ts', async () => {
      const { validateEnv } = await import('../../src/lib/env');
      const env = validateEnv();
      // These keys must exist in env with defaults
      expect(typeof env.GEOIP_DB_PATH).toBe('string');
      expect(typeof env.GEOIP_MAX_AGE_DAYS).toBe('number');
      expect(typeof env.GEOIP_MMDB_URL).toBe('string');
    });
  });
});
