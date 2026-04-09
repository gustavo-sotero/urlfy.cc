import { describe, expect, it } from 'bun:test';
import { Elysia } from 'elysia';
import { compressionMiddleware } from '../compression';

describe('compressionMiddleware', () => {
  it('preserves error responses generated before mapResponse', async () => {
    const app = new Elysia()
      .use(compressionMiddleware())
      .onError(({ set }) => {
        set.status = 500;

        return {
          success: false as const,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'boom'
          }
        };
      })
      .get('/boom', () => {
        throw new Error('boom');
      });

    const response = await app.handle(new Request('http://localhost/boom'));

    expect(response.status).toBe(500);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'boom'
      }
    });
  });

  it('does not treat falsey values as empty responses', async () => {
    const app = new Elysia()
      .use(compressionMiddleware())
      .get('/false', () => false)
      .get('/zero', () => 0)
      .get('/empty', () => '');

    const falseResponse = await app.handle(
      new Request('http://localhost/false')
    );
    expect(falseResponse.status).toBe(200);
    expect(await falseResponse.text()).toBe('false');

    const zeroResponse = await app.handle(new Request('http://localhost/zero'));
    expect(zeroResponse.status).toBe(200);
    expect(await zeroResponse.text()).toBe('0');

    const emptyResponse = await app.handle(
      new Request('http://localhost/empty')
    );
    expect(emptyResponse.status).toBe(200);
    expect(await emptyResponse.text()).toBe('');
  });
});
