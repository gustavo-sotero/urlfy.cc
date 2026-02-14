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

import { db } from '@/db';
import {
  type AuditAction,
  type AuditLog as AuditLogType,
  auditLog
} from '@/db/schema/audit';
import { and, desc, eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * Serialized audit log type for API responses
 */
export type SerializedAuditLog = Omit<AuditLogType, 'createdAt'> & {
  createdAt: string;
};

export class AuditLogService {
  /**
   * Serialize a single audit log for API response
   */
  private serialize(log: AuditLogType): SerializedAuditLog {
    return {
      ...log,
      createdAt: log.createdAt.toISOString()
    };
  }

  /**
   * Serialize multiple audit logs for API response
   */
  private serializeMany(logs: AuditLogType[]): SerializedAuditLog[] {
    return logs.map((log) => this.serialize(log));
  }
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
        userAgent: params.userAgent
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
    }
  ): Promise<{ logs: SerializedAuditLog[]; total: number }> {
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
      logs: this.serializeMany(logs),
      total: count
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
    }
  ): Promise<{ logs: SerializedAuditLog[]; total: number }> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const logs = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.entityType, entityType),
          eq(auditLog.entityId, entityId)
        )
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
          eq(auditLog.entityId, entityId)
        )
      );

    return {
      logs: this.serializeMany(logs),
      total: count
    };
  }

  /**
   * Get recent audit logs (admin view)
   */
  async getRecent(options?: {
    limit?: number;
    offset?: number;
    action?: AuditAction;
  }): Promise<{ logs: SerializedAuditLog[]; total: number }> {
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
      logs: this.serializeMany(logs),
      total: count
    };
  }

  /**
   * Get a single audit log by ID (serialized)
   */
  async getById(id: string): Promise<SerializedAuditLog | null> {
    const log = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.id, id))
      .limit(1)
      .then((results) => results[0] || null);

    return log ? this.serialize(log) : null;
  }

  /**
   * Get audit log summary statistics
   */
  async getSummary(): Promise<{
    totalLogs: number;
    actionCounts: Record<string, number>;
    entityTypeCounts: Record<string, number>;
    topUsers: Array<{ userId: string; count: number }>;
  }> {
    const allLogs = await db.select().from(auditLog);

    const actionCounts: Record<string, number> = {};
    const entityTypeCounts: Record<string, number> = {};
    const userCounts: Record<string, number> = {};

    for (const log of allLogs) {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
      entityTypeCounts[log.entityType] =
        (entityTypeCounts[log.entityType] || 0) + 1;
      userCounts[log.userId] = (userCounts[log.userId] || 0) + 1;
    }

    const topUsers = Object.entries(userCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId, count]) => ({ userId, count }));

    return {
      totalLogs: allLogs.length,
      actionCounts,
      entityTypeCounts,
      topUsers
    };
  }
}

// Export singleton instance
export const auditLogService = new AuditLogService();
