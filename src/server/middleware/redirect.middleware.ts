// src/server/middleware/redirect.middleware.ts
/**
 * Edge Runtime compatible redirect middleware
 * Makes internal API calls instead of direct DB access
 */

import { jwtVerify } from 'jose';
import type { NextRequest, NextResponse } from 'next/server';
import { NextResponse as Response } from 'next/server';
import { createLogger } from '@/server/lib/telemetry.edge';
import type { ClickEvent } from '@/types/analytics.types';

const logger = createLogger('redirect-middleware');

interface ResolveResult {
  success: boolean;
  url?: string;
  redirectType?: number;
  linkId?: string;
  error?: string;
}

/**
 * Resolve link via internal API call (Edge Runtime compatible)
 */
async function resolveLink(
  request: NextRequest,
  shortCode: string,
  depth: number,
  hasPasswordCookie: boolean
): Promise<ResolveResult> {
  try {
    // Construct internal API URL
    const baseUrl = request.nextUrl.origin;
    const apiUrl = new URL(`/api/internal/resolve/${shortCode}`, baseUrl);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api': process.env.INTERNAL_API_SECRET || 'dev-secret'
      },
      body: JSON.stringify({
        depth,
        hasPasswordCookie,
        ip:
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          request.headers.get('x-real-ip') ||
          'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      })
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: 'UNKNOWN_ERROR' }));
      return {
        success: false,
        error: error.error || 'RESOLVE_FAILED'
      };
    }

    return await response.json();
  } catch (error) {
    logger.error('Failed to resolve link via API', {
      shortCode,
      error: error instanceof Error ? error.message : String(error)
    });
    return {
      success: false,
      error: 'INTERNAL_ERROR'
    };
  }
}

/**
 * Handler principal de redirecionamento
 * Executado pelo Next.js middleware quando uma rota /:code é acessada
 */
export async function handleRedirect(
  request: NextRequest,
  shortCode: string
): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  const startTime = performance.now();

  try {
    // Extrai profundidade atual de redirects
    const currentDepth = Number.parseInt(
      request.headers.get('X-Redirect-Depth') ?? '0',
      10
    );

    // Verifica se há cookie de senha válido
    const hasPasswordCookie = await checkPasswordCookie(request, shortCode);

    // Resolve o link via internal API (Edge Runtime compatible)
    const result = await resolveLink(
      request,
      shortCode,
      currentDepth,
      hasPasswordCookie
    );

    if (!result.success) {
      const errorType = result.error ?? 'UNKNOWN_ERROR';
      return handleError(errorType, shortCode, request, requestId);
    }

    // Dispara evento de analytics (assíncrono, não bloqueia)
    if (result.linkId) {
      enqueueClickEvent(shortCode, request, requestId, result.linkId).catch(
        (error) => {
          // Log mas não falha o redirect
          logger.error('Failed to enqueue click event', {
            shortCode,
            requestId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      );
    }

    // Log de latência
    const latency = performance.now() - startTime;
    // Cache hits typically < 10ms for Redis, but can vary based on network
    // More accurate would be to pass cache status from service
    const estimatedCacheHit = latency < 15;

    logger.info('Redirect completed', {
      shortCode,
      redirectType: result.redirectType,
      latencyMs: latency.toFixed(2),
      estimatedCacheHit,
      requestId
    });

    // Resposta de redirect
    const targetUrl = result.url ?? 'https://urlfy.cc';
    return Response.redirect(targetUrl, {
      status: result.redirectType,
      headers: {
        'X-Request-Id': requestId,
        'X-Redirect-Depth': String(currentDepth + 1),
        'X-Cache-Status': estimatedCacheHit ? 'HIT' : 'MISS',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (error) {
    const latency = performance.now() - startTime;
    logger.error('Redirect error', {
      shortCode,
      requestId,
      latencyMs: latency.toFixed(2),
      error: error instanceof Error ? error.message : String(error)
    });

    // Erro interno - retorna 500
    return new Response(null, {
      status: 500,
      headers: {
        'X-Request-Id': requestId,
        'X-Error': 'INTERNAL_ERROR'
      }
    });
  }
}

/**
 * Manipula diferentes tipos de erro no redirecionamento
 */
function handleError(
  error: string,
  code: string,
  request: NextRequest,
  requestId: string
): NextResponse {
  const baseUrl = request.nextUrl.origin;

  logger.debug('Redirect error', { code, error, requestId });

  switch (error) {
    case 'NOT_FOUND':
      // Redireciona para página 404
      return Response.redirect(`${baseUrl}/404`, {
        status: 302,
        headers: {
          'X-Request-Id': requestId,
          'X-Error-Code': 'NOT_FOUND'
        }
      });

    case 'PASSWORD_REQUIRED':
      // Redireciona para página de unlock
      return Response.redirect(`${baseUrl}/unlock/${code}`, {
        status: 302,
        headers: {
          'X-Request-Id': requestId,
          'X-Error-Code': 'PASSWORD_REQUIRED'
        }
      });

    case 'EXPIRED':
      // Link expirado - 410 Gone
      return new Response(null, {
        status: 410,
        headers: {
          'X-Request-Id': requestId,
          'X-Error-Code': 'LINK_EXPIRED',
          'Content-Type': 'text/plain'
        }
      });

    case 'BANNED':
      // Link banido - 451 Unavailable For Legal Reasons
      return new Response(null, {
        status: 451,
        headers: {
          'X-Request-Id': requestId,
          'X-Error-Code': 'LINK_BANNED',
          'Content-Type': 'text/plain'
        }
      });

    case 'INACTIVE':
      // Link desativado - 410 Gone
      return new Response(null, {
        status: 410,
        headers: {
          'X-Request-Id': requestId,
          'X-Error-Code': 'LINK_INACTIVE',
          'Content-Type': 'text/plain'
        }
      });

    case 'MAX_CLICKS':
      // Limite de cliques atingido - 410 Gone
      return new Response(null, {
        status: 410,
        headers: {
          'X-Request-Id': requestId,
          'X-Error-Code': 'MAX_CLICKS_REACHED',
          'Content-Type': 'text/plain'
        }
      });

    case 'REDIRECT_LOOP':
      // Loop de redirects detectado - 421 Misdirected Request
      return new Response(null, {
        status: 421,
        headers: {
          'X-Request-Id': requestId,
          'X-Error-Code': 'REDIRECT_LOOP',
          'Content-Type': 'text/plain'
        }
      });

    default:
      // Erro desconhecido
      return new Response(null, {
        status: 500,
        headers: {
          'X-Request-Id': requestId,
          'X-Error-Code': 'UNKNOWN_ERROR'
        }
      });
  }
}

/**
 * Enfileira evento de clique via API interna
 * Usa fetch para chamar endpoint que roda no Node.js runtime (não Edge)
 */
async function enqueueClickEvent(
  shortCode: string,
  request: NextRequest,
  requestId: string,
  linkId: string
): Promise<void> {
  try {
    // Extrai informações da request
    const ip = getClientIp(request);
    const userAgent = request.headers.get('user-agent') ?? null;
    const referer = request.headers.get('referer') ?? null;
    const acceptLanguage = request.headers.get('accept-language') ?? null;

    const searchParams = request.nextUrl.searchParams;
    const utmSource = searchParams.get('utm_source');
    const utmMedium = searchParams.get('utm_medium');
    const utmCampaign = searchParams.get('utm_campaign');
    const utmContent = searchParams.get('utm_content');
    const utmTerm = searchParams.get('utm_term');

    const event: ClickEvent = {
      linkId,
      shortCode,
      timestamp: new Date(),
      ip,
      userAgent,
      referer,
      requestId,
      acceptLanguage,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm
    };

    // Chama API interna de forma assíncrona (não aguarda resposta)
    const baseUrl = request.nextUrl.origin;
    const internalToken = process.env.BETTER_AUTH_SECRET;

    // Fire and forget - não aguardamos resposta para não bloquear redirect
    fetch(`${baseUrl}/api/internal/analytics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-token': internalToken || ''
      },
      body: JSON.stringify(event)
    }).catch((error) => {
      // Log erro mas não propaga (já estamos no catch do handleRedirect)
      logger.error('Failed to call internal analytics API', {
        shortCode,
        requestId,
        error: error instanceof Error ? error.message : String(error)
      });
    });

    logger.debug('Click event dispatched to internal API', {
      shortCode,
      requestId
    });
  } catch (error) {
    logger.error('Failed to prepare click event', {
      shortCode,
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Extrai IP do cliente considerando proxies
 */
function getClientIp(request: NextRequest): string {
  // Verifica headers de proxy (ordem de precedência)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Pega o primeiro IP da lista (cliente original)
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }

  // Fallback para unknown se nenhum header disponível
  // NextRequest não expõe IP diretamente no Edge Runtime
  return 'unknown';
}

/**
 * Verifica cookie de senha para links protegidos
 * Retorna true se o cookie é válido
 */
export async function checkPasswordCookie(
  request: NextRequest,
  code: string
): Promise<boolean> {
  try {
    const cookieName = `urlfy_unlock_${code}`;
    const token = request.cookies.get(cookieName)?.value;

    if (!token) {
      return false;
    }

    // Verifica JWT usando jose (Edge Runtime compatible)
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET ?? 'urlfy-secret-key'
    );

    const { payload } = await jwtVerify(token, secret);

    // Verifica se o payload contém o código correto
    return (
      payload.code === code &&
      payload.type === 'unlock' &&
      typeof payload.exp === 'number' &&
      payload.exp * 1000 > Date.now()
    );
  } catch (error) {
    logger.error('Error checking password cookie', {
      code,
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}
