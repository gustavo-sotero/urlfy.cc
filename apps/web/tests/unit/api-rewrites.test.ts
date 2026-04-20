import { describe, expect, it } from 'bun:test';
import {
  getDevApiRewrites,
  getLocalApiProxyTarget
} from '@/server/config/api-rewrites';

describe('Dev API rewrite config', () => {
  it('enables the same-origin API proxy only in development', () => {
    expect(
      getLocalApiProxyTarget({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)
    ).toBe('http://127.0.0.1:3001');

    expect(
      getLocalApiProxyTarget({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)
    ).toBeUndefined();
  });

  it('normalizes an override target before generating rewrites', () => {
    const target = getLocalApiProxyTarget({
      NODE_ENV: 'development',
      DEV_API_PROXY_TARGET: 'http://api.internal:3001/'
    } as NodeJS.ProcessEnv);

    expect(target).toBe('http://api.internal:3001');
    expect(getDevApiRewrites(target)).toEqual([
      {
        source: '/api/:path*',
        destination: 'http://api.internal:3001/api/:path*'
      }
    ]);
  });

  it('returns no rewrites when the dev proxy target is disabled', () => {
    expect(getDevApiRewrites(undefined)).toEqual([]);
  });
});
