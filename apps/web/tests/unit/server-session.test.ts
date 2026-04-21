import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

const originalApiInternalUrl = process.env.API_INTERNAL_URL;
const fetchMock = mock(async () => new Response(null, { status: 200 }));

describe('getServerSession', () => {
  beforeEach(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockClear();
    process.env.API_INTERNAL_URL = 'http://api:3001';
  });

  afterEach(() => {
    process.env.API_INTERNAL_URL = originalApiInternalUrl;
  });

  it('forwards cookies to the internal auth API and bypasses cookie cache', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user: { id: 'user-1', email: 'test@example.com' },
          session: { id: 'session-1', userId: 'user-1' }
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' }
        }
      )
    );

    const { getServerSession } = await import('@/lib/server-session');

    const session = await getServerSession({
      headers: new Headers({
        cookie: 'urlfy.session_token=abc123',
        'x-request-id': 'req-1',
        'user-agent': 'bun-test'
      })
    });

    expect(session?.user).toEqual(
      expect.objectContaining({ id: 'user-1', email: 'test@example.com' })
    );
    expect(session?.session).toEqual(
      expect.objectContaining({ id: 'session-1', userId: 'user-1' })
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, requestInit] = fetchMock.mock.calls[0] as unknown as [
      URL,
      RequestInit
    ];
    const [requestUrl] = fetchMock.mock.calls[0] as unknown as [
      URL,
      RequestInit
    ];
    const forwardedHeaders = requestInit.headers as Headers;

    expect(requestUrl.toString()).toBe('http://api:3001/api/internal/session');
    expect(requestInit.method).toBe('GET');
    expect(requestInit.cache).toBe('no-store');
    expect(forwardedHeaders).toBeInstanceOf(Headers);

    expect(forwardedHeaders.get('cookie')).toBe('urlfy.session_token=abc123');
    expect(forwardedHeaders.get('x-request-id')).toBe('req-1');
    expect(forwardedHeaders.get('user-agent')).toBe('bun-test');
    expect(forwardedHeaders.get('x-forwarded-for')).toBe('127.0.0.1');
  });

  it('returns null when there is no cookie to validate', async () => {
    const { getServerSession } = await import('@/lib/server-session');

    const session = await getServerSession({ headers: new Headers() });

    expect(session).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null for unauthorized responses', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));

    const { getServerSession } = await import('@/lib/server-session');

    const session = await getServerSession({
      headers: new Headers({ cookie: 'urlfy.session_token=abc123' })
    });

    expect(session).toBeNull();
  });

  it('throws on upstream auth API failures instead of downgrading to logged out', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('upstream failure', {
        status: 503,
        statusText: 'Service Unavailable'
      })
    );

    const { getServerSession } = await import('@/lib/server-session');

    await expect(
      getServerSession({
        headers: new Headers({ cookie: 'urlfy.session_token=abc123' })
      })
    ).rejects.toThrow(
      'Failed to retrieve auth session from internal API: 503 Service Unavailable'
    );
  });

  // ═══════════════════════════════════════════════════════════════════
  // isAdmin field propagation
  // ═══════════════════════════════════════════════════════════════════

  it('propagates isAdmin=true when the internal API returns an admin session', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user: { id: 'admin-1', email: 'admin@example.com', isAdmin: true },
          session: { id: 'session-admin', userId: 'admin-1' }
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' }
        }
      )
    );

    const { getServerSession } = await import('@/lib/server-session');

    const session = await getServerSession({
      headers: new Headers({ cookie: 'urlfy.session_token=admin-token' })
    });

    expect(session?.user).toEqual(
      expect.objectContaining({ id: 'admin-1', isAdmin: true })
    );
  });

  it('propagates isAdmin=false when the internal API returns a non-admin session', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user: { id: 'user-2', email: 'user@example.com', isAdmin: false },
          session: { id: 'session-user', userId: 'user-2' }
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' }
        }
      )
    );

    const { getServerSession } = await import('@/lib/server-session');

    const session = await getServerSession({
      headers: new Headers({ cookie: 'urlfy.session_token=user-token' })
    });

    expect(session?.user).toEqual(
      expect.objectContaining({ id: 'user-2', isAdmin: false })
    );
  });
});
