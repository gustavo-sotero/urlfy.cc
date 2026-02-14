/**
 * ═════════════════════════════════════════════════════════════════════
 * ADMIN MODULE - Entry point
 * ═════════════════════════════════════════════════════════════════════
 */

// Controllers (Elysia routes)
export { adminController } from './admin.controller';
// Schema (TypeBox models)
export {
  AdminBanLinkBody, AdminModel,
  AdminModels,
  AdminStatsResponse, AdminUserListQuery, AdminUserResponse, AdminUserUpdateBody, AuditLogQuery, AuditLogResponse, type AdminBanLinkBodyType, type AdminStatsResponseType, type AdminUserListQueryType, type AdminUserResponseType, type AdminUserUpdateBodyType, type AuditLogQueryType, type AuditLogResponseType
} from './admin.schema';
// Service (Business logic)
export { AdminService } from './admin.service';
export { auditController } from './audit.controller';
export { adminMessagesController } from './messages.controller';
export { adminQueuesController } from './queues.controller';

