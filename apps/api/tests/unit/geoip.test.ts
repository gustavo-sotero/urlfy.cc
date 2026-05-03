import { afterAll, describe, expect, it, mock } from 'bun:test';

const CANONICAL_GEOIP_DB_PATH = '/app/geoip/GeoLite2-City.mmdb';
const CANONICAL_GEOIP_MAX_AGE_DAYS = '25';
const CANONICAL_GEOIP_MMDB_URL =
  'https://cdn.jsdelivr.net/npm/geolite2-city/GeoLite2-City.mmdb.gz';
const NULL_LOCATION = {
  country: null,
  city: null,
  latitude: null,
  longitude: null,
  timezone: null
};

async function readWorkspaceFile(relativePath: string): Promise<string> {
  const fileUrl = new URL(`../../../../${relativePath}`, import.meta.url);
  return Bun.file(fileUrl).text();
}

mock.module('@urlfy/cache', () => ({
  CACHE_KEYS: {
    GEO: (prefix: string) => `geo:${prefix}`
  },
  CACHE_TTL: {
    GEO: 86400
  },
  redis: {
    get: async () => null,
    setex: async () => {}
  }
}));

mock.module('@urlfy/telemetry', () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
  })
}));

mock.module('@maxmind/geoip2-node', () => ({
  Reader: {
    open: async () => {
      throw new Error('stub - no GeoIP database in API unit tests');
    }
  }
}));

const apiGeoIp = await import('../../src/server/lib/geoip');
const packageGeoIp = await import('@urlfy/geoip');

afterAll(() => {
  mock.restore();
});

describe('API GeoIP shim', () => {
  it('re-exports the canonical package implementation without local wrappers', async () => {
    const source = await readWorkspaceFile('apps/api/src/server/lib/geoip.ts');

    expect(source).toContain("} from '@urlfy/geoip';");
    expect(apiGeoIp.lookupGeoIP).toBe(packageGeoIp.lookupGeoIP);
    expect(apiGeoIp.getGeoIPReader).toBe(packageGeoIp.getGeoIPReader);
    expect(apiGeoIp.getWeeklySalt).toBe(packageGeoIp.getWeeklySalt);
  });

  it('keeps private-IP fallback behavior available through the API shim', async () => {
    const result = await apiGeoIp.lookupGeoIP('10.0.0.1');

    expect(result).toEqual(NULL_LOCATION);
  });
});

describe('GeoIP runtime configuration parity', () => {
  it('keeps API env defaults aligned with docker compose and the refresh script', async () => {
    const [envSource, composeSource, refreshScript] = await Promise.all([
      readWorkspaceFile('apps/api/src/lib/env.ts'),
      readWorkspaceFile('docker/docker-compose.yml'),
      readWorkspaceFile('docker/geoip/geoip-refresh.sh')
    ]);

    expect(envSource).toContain(
      `GEOIP_DB_PATH: z.string().default('${CANONICAL_GEOIP_DB_PATH}')`
    );
    expect(envSource).toContain(
      `GEOIP_MAX_AGE_DAYS: z.coerce.number().int().positive().default(${CANONICAL_GEOIP_MAX_AGE_DAYS})`
    );
    expect(envSource).toContain(CANONICAL_GEOIP_MMDB_URL);

    expect(composeSource).toContain(
      `- GEOIP_DB_PATH=${CANONICAL_GEOIP_DB_PATH}`
    );
    expect(composeSource).toContain(
      `- GEOIP_MAX_AGE_DAYS=${CANONICAL_GEOIP_MAX_AGE_DAYS}`
    );
    expect(composeSource).toContain(
      `- GEOIP_MMDB_URL=${CANONICAL_GEOIP_MMDB_URL}`
    );

    expect(refreshScript).toContain(
      `DB_PATH="\${GEOIP_DB_PATH:-${CANONICAL_GEOIP_DB_PATH}}"`
    );
    expect(refreshScript).toContain(
      `MAX_AGE_DAYS="\${GEOIP_MAX_AGE_DAYS:-${CANONICAL_GEOIP_MAX_AGE_DAYS}}"`
    );
    expect(refreshScript).toContain(
      `MIRROR_URL="\${GEOIP_MMDB_URL:-${CANONICAL_GEOIP_MMDB_URL}}"`
    );
  });

  it('keeps refresh startup and monthly cron wiring pointed at the same script', async () => {
    const [entrypoint, dockerfile] = await Promise.all([
      readWorkspaceFile('docker/geoip/geoip-entrypoint.sh'),
      readWorkspaceFile('docker/geoip/Dockerfile')
    ]);

    expect(entrypoint).toContain('/usr/local/bin/geoip-refresh.sh');
    expect(entrypoint).toContain('exec crond -f -l 2');
    expect(dockerfile).toContain('0 0 1 * * /usr/local/bin/geoip-refresh.sh');
    expect(dockerfile).toContain('ENTRYPOINT ["/entrypoint.sh"]');
  });

  it('preserves downloader safety and license compliance invariants', async () => {
    const [readme, refreshScript, appsCompose, prodCompose] = await Promise.all(
      [
        readWorkspaceFile('docker/geoip/README.md'),
        readWorkspaceFile('docker/geoip/geoip-refresh.sh'),
        readWorkspaceFile('docker/docker-compose.apps.yml'),
        readWorkspaceFile('docker/docker-compose.prod.yml')
      ]
    );

    expect(refreshScript).toContain('--retry 3');
    expect(refreshScript).toContain('--connect-timeout 30');
    expect(refreshScript).toContain('--max-time 300');
    expect(refreshScript).toContain('mv "$TMP_MMDB_PATH" "$DB_PATH"');
    expect(refreshScript).toContain('rm -f "$TMP_GZ_PATH"');
    expect(refreshScript).toContain('License: CC BY-SA 4.0');

    expect(readme).toContain(CANONICAL_GEOIP_MMDB_URL);
    expect(readme).toContain(
      'This product includes GeoLite2 data created by MaxMind'
    );
    expect(readme).toContain('CC BY-SA 4.0');

    expect(appsCompose).toContain('geoip_data:/app/geoip:ro');
    expect(prodCompose).toContain('geoip_data:/app/geoip:ro');
  });
});
