import { Elysia } from 'elysia';

export const requestContext = new Elysia({ name: 'request-context' }).derive(
  { as: 'global' },
  ({ request }) => {
    return {
      ip:
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        undefined,
      userAgent: request.headers.get('user-agent') || undefined
    };
  }
);
