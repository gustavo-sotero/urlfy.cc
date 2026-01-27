/**
 * Client Error Monitoring API
 * Receives and logs client-side errors for debugging
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/server/lib/telemetry';

const logger = createLogger('client-error-monitor');

interface ClientError {
  error: string;
  componentStack?: string;
  url: string;
  userAgent?: string;
  timestamp?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as ClientError;

    // Validate required fields
    if (!body.error || !body.url) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields: error, url'
          }
        },
        { status: 400 }
      );
    }

    // Extract client information
    const userAgent =
      request.headers.get('user-agent') || body.userAgent || 'unknown';
    const referer = request.headers.get('referer') || body.url;

    // Log error with full context for monitoring
    logger.error('Client-side error reported', {
      error: body.error,
      componentStack: body.componentStack,
      url: body.url,
      referer,
      userAgent,
      timestamp: body.timestamp || new Date().toISOString(),
      // Include request ID for correlation with other logs
      requestId: request.headers.get('x-request-id') || crypto.randomUUID()
    });

    // Return success (fire-and-forget from client perspective)
    return NextResponse.json(
      {
        success: true,
        data: { received: true }
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Failed to process client error report', {
      error: error instanceof Error ? error.message : String(error)
    });

    // Don't expose internal errors to client
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process error report'
        }
      },
      { status: 500 }
    );
  }
}
