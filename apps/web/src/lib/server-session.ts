import { getClientIpFromHeaders } from '@/server/lib/ip';
import type {
  Session as AppSession,
  InternalSessionUser
} from '@/types/auth.types';

export interface ServerSession {
  user: InternalSessionUser;
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

  forwardedHeaders.set(
    'x-forwarded-for',
    getClientIpFromHeaders(requestHeaders)
  );
  forwardedHeaders.set('x-internal-api', process.env.INTERNAL_API_SECRET ?? '');

  return forwardedHeaders;
}

export async function getServerSession({
  headers,
  disableCookieCache: _disableCookieCache = true
}: GetServerSessionOptions): Promise<ServerSession | null> {
  if (!headers.get('cookie')) {
    return null;
  }

  const response = await fetch(
    new URL('/api/internal/session', getApiInternalUrl()),
    {
      method: 'GET',
      headers: buildForwardedHeaders(headers),
      cache: 'no-store'
    }
  );

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Failed to retrieve auth session from internal API: ${response.status} ${response.statusText}`
    );
  }

  const session = (await response.json()) as Partial<ServerSession> | null;

  if (!session?.user || !session?.session) {
    return null;
  }

  const isAdmin =
    typeof (session.user as { isAdmin?: unknown }).isAdmin === 'boolean'
      ? (session.user as { isAdmin: boolean }).isAdmin
      : false;

  return {
    user: {
      ...(session.user as Omit<InternalSessionUser, 'isAdmin'>),
      isAdmin
    } as InternalSessionUser,
    session: session.session as AppSession
  };
}
