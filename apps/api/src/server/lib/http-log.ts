import type { ElysiaContext } from '@logtape/elysia';

type HttpLogRequestLike = Request | { url?: string | URL };

type HttpLogContext =
  | {
      path?: ElysiaContext['path'];
      request?: HttpLogRequestLike;
    }
  | null
  | undefined;

const HTTP_LOG_SKIP_PATHS: ReadonlySet<string> = new Set([
  '/api/health',
  '/api/health/ready'
]);

const HTTP_LOG_SKIP_PREFIXES = ['/api/internal/docs'] as const;

function parsePathname(url: string): string | null {
  if (url.length === 0) {
    return null;
  }

  try {
    return new URL(url, 'http://localhost').pathname;
  } catch {
    return null;
  }
}

function getRequestPathname(
  request: HttpLogRequestLike | null | undefined
): string | null {
  const rawUrl = request?.url;

  if (typeof rawUrl === 'string') {
    return parsePathname(rawUrl);
  }

  if (rawUrl instanceof URL) {
    return rawUrl.pathname;
  }

  return null;
}

export function getHttpLogPathname(ctx: HttpLogContext): string | null {
  if (typeof ctx?.path === 'string' && ctx.path.length > 0) {
    return ctx.path;
  }

  return getRequestPathname(ctx?.request);
}

export function shouldSkipHttpLog(ctx: HttpLogContext): boolean {
  const pathname = getHttpLogPathname(ctx);

  if (pathname == null) {
    return false;
  }

  return (
    HTTP_LOG_SKIP_PATHS.has(pathname) ||
    HTTP_LOG_SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}
