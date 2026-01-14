// src/app/api/internal/analytics/route.ts

import { NextResponse } from "next/server";
import { analyticsQueue } from "@/server/lib/queue";
import type { ClickEvent } from "@/types/analytics.types";

/**
 * Internal API endpoint para enfileirar eventos de analytics
 * Este endpoint NÃO é exposto publicamente - apenas para chamadas internas do middleware
 *
 * IMPORTANTE: Roda no Node.js runtime (não Edge), onde BullMQ funciona
 */

export const runtime = "nodejs"; // Force Node.js runtime (not Edge)

export async function POST(request: Request) {
  try {
    // Verifica token interno (usando BETTER_AUTH_SECRET como chave compartilhada)
    const internalToken = request.headers.get("x-internal-token");
    const expectedToken = process.env.BETTER_AUTH_SECRET;

    if (!internalToken || !expectedToken || internalToken !== expectedToken) {
      return NextResponse.json(
        { error: "Forbidden - Invalid internal token" },
        { status: 403 },
      );
    }

    const event: ClickEvent = await request.json();

    // Valida campos mínimos
    if (!event.linkId || !event.shortCode) {
      return NextResponse.json(
        { error: "Invalid event data" },
        { status: 400 },
      );
    }

    // Enfileira evento
    await analyticsQueue.add("click-event", event, {
      jobId: event.requestId, // Idempotency via jobId único
    });

    return NextResponse.json({ success: true }, { status: 202 });
  } catch (error) {
    console.error("Failed to enqueue analytics event:", error);
    // Retorna 202 mesmo com erro - não queremos falhar o redirect
    return NextResponse.json({ success: false }, { status: 202 });
  }
}
