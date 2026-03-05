import {
  brotliCompressSync,
  constants,
  deflateSync,
  gzipSync
} from 'node:zlib';
import { Elysia } from 'elysia';

type CompressionEncoding = 'br' | 'gzip' | 'deflate';

export interface CompressionOptions {
  encodings?: CompressionEncoding[];
  threshold?: number;
  compressibleTypes?: RegExp;
}

const DEFAULT_ENCODINGS: CompressionEncoding[] = ['br', 'gzip', 'deflate'];
const DEFAULT_THRESHOLD = 1024;
const DEFAULT_COMPRESSIBLE_TYPES =
  /^text\/(?!event-stream)|(?:\+|\/)json(?:;|$)|(?:\+|\/)text(?:;|$)|(?:\+|\/)xml(?:;|$)|octet-stream(?:;|$)/u;

function selectEncoding(
  acceptEncoding: string | null,
  encodings: CompressionEncoding[]
): CompressionEncoding | null {
  if (!acceptEncoding) return null;
  const accepted = acceptEncoding
    .split(',')
    .map((value) => value.trim().split(';')[0])
    .filter(Boolean);

  for (const encoding of encodings) {
    if (accepted.includes(encoding)) return encoding;
  }

  return null;
}

function compressBuffer(
  buffer: Uint8Array,
  encoding: CompressionEncoding
): Uint8Array {
  switch (encoding) {
    case 'br':
      return brotliCompressSync(buffer, {
        params: {
          [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_GENERIC,
          [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_DEFAULT_QUALITY
        }
      });
    case 'deflate':
      return deflateSync(buffer);
    default:
      return gzipSync(buffer);
  }
}

function normalizeResponse(response: unknown, fallbackStatus = 200): Response {
  if (response instanceof Response) return response;
  if (response === undefined || response === null) {
    return new Response(null, { status: fallbackStatus });
  }

  if (typeof response === 'string') {
    return new Response(response, {
      status: fallbackStatus,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  if (typeof response === 'number' || typeof response === 'boolean') {
    return new Response(String(response), {
      status: fallbackStatus,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  return new Response(JSON.stringify(response), {
    status: fallbackStatus,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function compressionMiddleware(options?: CompressionOptions) {
  const encodings = options?.encodings ?? DEFAULT_ENCODINGS;
  const threshold = options?.threshold ?? DEFAULT_THRESHOLD;
  const compressibleTypes =
    options?.compressibleTypes ?? DEFAULT_COMPRESSIBLE_TYPES;

  return new Elysia({ name: 'compression' }).mapResponse(
    { as: 'global' },
    async ({ request, response, set }) => {
      const fallbackStatus = typeof set.status === 'number' ? set.status : 200;

      if (!response) return normalizeResponse(response, fallbackStatus);

      const normalizedResponse = normalizeResponse(response, fallbackStatus);

      const acceptEncoding = request.headers.get('accept-encoding');
      const encoding = selectEncoding(acceptEncoding, encodings);
      if (!encoding) return normalizedResponse;

      if (
        set.headers['content-encoding'] ||
        set.headers['Content-Encoding'] ||
        normalizedResponse.headers.get('content-encoding')
      ) {
        return normalizedResponse;
      }

      const contentType =
        normalizedResponse.headers.get('content-type') ?? 'text/plain';

      if (!compressibleTypes.test(contentType)) return normalizedResponse;

      if (normalizedResponse.bodyUsed) return normalizedResponse;

      const buffer = await normalizedResponse.arrayBuffer();
      const baseHeaders = new Headers(normalizedResponse.headers);
      if (buffer.byteLength < threshold) {
        return new Response(new Uint8Array(buffer), {
          status: normalizedResponse.status,
          headers: baseHeaders
        });
      }

      const compressed = compressBuffer(new Uint8Array(buffer), encoding);

      const vary = set.headers.Vary ?? set.headers.vary;
      if (typeof vary === 'string' && vary.length > 0) {
        const tokens = vary
          .split(',')
          .map((value) => value.trim().toLowerCase());
        if (!tokens.includes('*') && !tokens.includes('accept-encoding')) {
          set.headers.Vary = [...tokens, 'accept-encoding'].join(', ');
        }
      } else {
        set.headers.Vary = 'accept-encoding';
      }

      set.headers['Content-Encoding'] = encoding;

      const compressedHeaders = new Headers(baseHeaders);
      compressedHeaders.set('Content-Type', contentType);
      // note: node:zlib returns Buffer<ArrayBufferLike>; wrapping in Uint8Array
      // strips the generic parameter so TypeScript accepts it as BodyInit
      // (BufferSource → ArrayBufferView). This cast is safe — data is unchanged.
      return new Response(new Uint8Array(compressed), {
        status: normalizedResponse.status,
        headers: compressedHeaders
      });
    }
  );
}
