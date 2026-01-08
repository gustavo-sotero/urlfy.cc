/**
 * ═════════════════════════════════════════════════════════════════════
 * AUDIT LOG SERVICE
 * ═════════════════════════════════════════════════════════════════════
 * Service for logging administrative and security events
 *
 * Module: Authentication & Identity (Module 2)
 * Requirement: RF-34 - Audit logs for admin actions
 * ═════════════════════════════════════════════════════════════════════
 */

import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  type AuditAction,
  type AuditLog as AuditLogType,
  auditLog,
} from "@/db/schema/audit";
import { db } from "@/server/lib/db";

export class AuditLogService {
  /**
   * Log an administrative or security event
   */
  async log(params: {
    userId: string;
    action: AuditAction;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditLogType> {
    const [log] = await db
      .insert(auditLog)
      .values({
        id: nanoid(),
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: params.metadata || {},
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      })
      .returning();

    return log;
  }

  /**
   * Get audit logs for a specific user
   */
  async getByUser(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
    },
  ): Promise<{ logs: AuditLogType[]; total: number }> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const logs = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.userId, userId))
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLog)
      .where(eq(auditLog.userId, userId));

    return {
      logs,
      total: count,
    };
  }

  /**
   * Get audit logs for a specific entity
   */
  async getByEntity(
    entityType: string,
    entityId: string,
    options?: {
      limit?: number;
      offset?: number;
    },
  ): Promise<{ logs: AuditLogType[]; total: number }> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const logs = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.entityType, entityType),
          eq(auditLog.entityId, entityId),
        ),
      )
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.entityType, entityType),
          eq(auditLog.entityId, entityId),
        ),
      );

    return {
      logs,
      total: count,
    };
  }

  /**
   * Get recent audit logs (admin view)
   */
  async getRecent(options?: {
    limit?: number;
    offset?: number;
    action?: AuditAction;
  }): Promise<{ logs: AuditLogType[]; total: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const query = db.select().from(auditLog);

    if (options?.action) {
      query.where(eq(auditLog.action, options.action));
    }

    const logs = await query
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLog)
      .where(options?.action ? eq(auditLog.action, options.action) : undefined);

    return {
      logs,
      total: count,
    };
  }
}

// Export singleton instance
export const auditLogService = new AuditLogService();

// Re-export for convenience
import { and, sql } from "drizzle-orm";
