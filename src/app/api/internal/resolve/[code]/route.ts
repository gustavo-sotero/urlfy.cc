// src/app/api/internal/resolve/[code]/route.ts
/**
 * Internal API for link resolution
 * Called by Edge middleware to resolve links using full Node.js runtime
 */

import { type NextRequest, NextResponse } from 'next/server';
import { redirectService } from '@/server/services/redirect.service';

// Verify internal API secret
function verifyInternalRequest(request: NextRequest): boolean {
  const secret = request.headers.get('x-internal-api');
  const expectedSecret = process.env.INTERNAL_API_SECRET || 'dev-secret';
  return secret === expectedSecret;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    // Verify this is an internal request
    if (!verifyInternalRequest(request)) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { code } = await params;
    const body = await request.json();
    const { depth, hasPasswordCookie } = body;

    // Use the existing redirect service
    const result = await redirectService.resolve(
      code,
      depth ?? 0,
      hasPasswordCookie ?? false
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'UNKNOWN_ERROR'
        },
        { status: 200 }
      );
    }

    // Return success with redirect info
    return NextResponse.json({
      success: true,
      url: result.url,
      redirectType: result.redirectType,
      linkId: result.linkId
    });
  } catch (error) {
    console.error('Internal resolve error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}
