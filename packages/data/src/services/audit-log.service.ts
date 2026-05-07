import { and, asc, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../index';
import {
  type AuditAction,
  type AuditLog as AuditLogType,
  auditLog
} from '../schema/audit';

/**
 * Serialized audit log type for API responses.
 */
export type SerializedAuditLog = Omit<AuditLogType, 'createdAt'> & {
  createdAt: string;
};

export class AuditLogService {
  protected getDb() {
    return db;
  }

  private serialize(log: AuditLogType): SerializedAuditLog {
    return {
      ...log,
      createdAt: log.createdAt.toISOString()
    };
  }

  private serializeMany(logs: AuditLogType[]): SerializedAuditLog[] {
    return logs.map((log) => this.serialize(log));
  }

  async log(params: {
    userId: string | null;
    action: AuditAction;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditLogType> {
    const database = this.getDb();

    const [log] = await database
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

  async getByUser(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<{ logs: SerializedAuditLog[]; total: number }> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    const database = this.getDb();

    const logs = await database
      .select()
      .from(auditLog)
      .where(eq(auditLog.userId, userId))
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await database
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLog)
      .where(eq(auditLog.userId, userId));

    return {
      logs: this.serializeMany(logs),
      total: count
    };
  }

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
    const database = this.getDb();

    const logs = await database
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

    const [{ count }] = await database
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

  async getRecent(options?: {
    limit?: number;
    offset?: number;
    action?: AuditAction;
    entityType?: string;
    userId?: string;
    from?: Date;
    to?: Date;
    sortBy?: 'createdAt' | 'action' | 'userId';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ logs: SerializedAuditLog[]; total: number }> {
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;
    const sortOrder = options?.sortOrder === 'asc' ? 'asc' : 'desc';
    const sortBy = options?.sortBy ?? 'createdAt';
    const database = this.getDb();

    const conditions = [];
    if (options?.action) conditions.push(eq(auditLog.action, options.action));
    if (options?.entityType)
      conditions.push(eq(auditLog.entityType, options.entityType));
    if (options?.userId) conditions.push(eq(auditLog.userId, options.userId));
    if (options?.from) conditions.push(gte(auditLog.createdAt, options.from));
    if (options?.to) conditions.push(lt(auditLog.createdAt, options.to));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const orderExpr = (() => {
      const col =
        sortBy === 'action'
          ? auditLog.action
          : sortBy === 'userId'
            ? auditLog.userId
            : auditLog.createdAt;
      return sortOrder === 'asc' ? asc(col) : desc(col);
    })();

    const [logs, [{ count }]] = await Promise.all([
      database
        .select()
        .from(auditLog)
        .where(where)
        .orderBy(orderExpr)
        .limit(limit)
        .offset(offset),
      database
        .select({ count: sql<number>`count(*)::int` })
        .from(auditLog)
        .where(where)
    ]);

    return {
      logs: this.serializeMany(logs),
      total: count
    };
  }

  async getById(id: string): Promise<SerializedAuditLog | null> {
    const log = await this.getDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.id, id))
      .limit(1)
      .then((results) => results[0] || null);

    return log ? this.serialize(log) : null;
  }

  async getSummary(): Promise<{
    totalLogs: number;
    actionCounts: Record<string, number>;
    entityTypeCounts: Record<string, number>;
    topUsers: Array<{ userId: string; count: number }>;
  }> {
    const database = this.getDb();

    const [totalResult, actionRows, entityRows, userRows] = await Promise.all([
      database
        .select({ count: sql<number>`count(*)::int` })
        .from(auditLog)
        .then((r) => r[0]),
      database
        .select({
          action: auditLog.action,
          count: sql<number>`count(*)::int`
        })
        .from(auditLog)
        .groupBy(auditLog.action),
      database
        .select({
          entityType: auditLog.entityType,
          count: sql<number>`count(*)::int`
        })
        .from(auditLog)
        .groupBy(auditLog.entityType),
      database
        .select({
          userId: sql<string>`coalesce(${auditLog.userId}, 'system')`,
          count: sql<number>`count(*)::int`
        })
        .from(auditLog)
        .groupBy(sql`coalesce(${auditLog.userId}, 'system')`)
        .orderBy(sql`count(*) desc`)
        .limit(10)
    ]);

    const actionCounts: Record<string, number> = {};
    for (const row of actionRows) {
      actionCounts[row.action] = row.count;
    }

    const entityTypeCounts: Record<string, number> = {};
    for (const row of entityRows) {
      entityTypeCounts[row.entityType] = row.count;
    }

    return {
      totalLogs: totalResult.count,
      actionCounts,
      entityTypeCounts,
      topUsers: userRows.map((r) => ({ userId: r.userId, count: r.count }))
    };
  }
}

export const auditLogService = new AuditLogService();
