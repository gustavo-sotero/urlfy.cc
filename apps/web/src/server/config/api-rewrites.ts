function normalizeProxyTarget(target: string): string {
  return target.replace(/\/$/, '');
}

export function getLocalApiProxyTarget(
  env: NodeJS.ProcessEnv = process.env
): string | undefined {
  if (env.NODE_ENV !== 'development') {
    return undefined;
  }

  return normalizeProxyTarget(
    env.DEV_API_PROXY_TARGET || 'http://localhost:3001'
  );
}

export function getDevApiRewrites(
  target: string | undefined = getLocalApiProxyTarget()
): Array<{ source: string; destination: string }> {
  if (!target) {
    return [];
  }

  return [
    {
      source: '/api/:path*',
      destination: `${target}/api/:path*`
    }
  ];
}
