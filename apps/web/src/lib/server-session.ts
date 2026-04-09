import type { Session as AppSession, InternalUser } from '@/types/auth.types';

interface ServerSession {
  user: InternalUser;
  session: AppSession;
}

interface GetServerSessionOptions {
  headers: Headers;
  disableCookieCache?: boolean;
}

function getApiInternalUrl(): string {
  const raw = process.env.API_INTERNAL_URL || 'http://localhost:3001';

  try {
    const parsed = new URL(raw);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Unsupported protocol: ${parsed.protocol}`);
    }

    return parsed.origin;
  } catch {
    throw new Error(`Invalid API_INTERNAL_URL: ${raw}`);
  }
}

function buildForwardedHeaders(requestHeaders: Headers): Headers {
  const forwardedHeaders = new Headers();
  const headerNames = [
    'cookie',
    'user-agent',
    'x-request-id',
    'x-forwarded-for',
    'x-forwarded-host',
    'x-forwarded-proto',
    'host'
  ] as const;

  for (const headerName of headerNames) {
    const value = requestHeaders.get(headerName);

    if (value) {
      forwardedHeaders.set(headerName, value);
    }
  }

  return forwardedHeaders;
}

export async function getServerSession({
  headers,
  disableCookieCache = true
}: GetServerSessionOptions): Promise<ServerSession | null> {
  if (!headers.get('cookie')) {
    return null;
  }

  const url = new URL('/api/auth/get-session', getApiInternalUrl());

  if (disableCookieCache) {
    url.searchParams.set('disableCookieCache', 'true');
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: buildForwardedHeaders(headers),
    cache: 'no-store'
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Failed to retrieve auth session from API: ${response.status} ${response.statusText}`
    );
  }

  const body = (await response.json()) as Partial<ServerSession> | null;

  if (!body?.user || !body?.session) {
    return null;
  }

  return {
    user: body.user,
    session: body.session
  };
}
