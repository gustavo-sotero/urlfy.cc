import { Elysia } from 'elysia';
import { getClientIp } from '@/server/lib/ip';

export const requestContext = new Elysia({ name: 'request-context' }).derive(
  { as: 'global' },
  ({ request }) => {
    return {
      ip: getClientIp(request),
      userAgent: request.headers.get('user-agent') || undefined
    };
  }
);
