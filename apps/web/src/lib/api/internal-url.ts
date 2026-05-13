const DEFAULT_DEV_INTERNAL_API_ORIGIN = 'http://127.0.0.1:3001';
const DEFAULT_INTERNAL_API_ORIGIN = 'http://localhost:3001';

function readOptionalUrl(raw: string | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }

  const normalized = raw.trim();

  if (!normalized || normalized === 'undefined' || normalized === 'null') {
    return undefined;
  }

  return normalized;
}

function normalizeInternalApiOrigin(raw: string): string {
  const parsed = new URL(raw);

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported protocol: ${parsed.protocol}`);
  }

  return parsed.origin;
}

export function resolveInternalApiOrigin(
  env: NodeJS.ProcessEnv = process.env
): string {
  const raw =
    readOptionalUrl(env.API_INTERNAL_URL) ||
    (env.NODE_ENV === 'development'
      ? readOptionalUrl(env.DEV_API_PROXY_TARGET)
      : undefined) ||
    (env.NODE_ENV === 'development'
      ? DEFAULT_DEV_INTERNAL_API_ORIGIN
      : DEFAULT_INTERNAL_API_ORIGIN);

  try {
    return normalizeInternalApiOrigin(raw);
  } catch {
    throw new Error(`Invalid internal API URL: ${raw}`);
  }
}
