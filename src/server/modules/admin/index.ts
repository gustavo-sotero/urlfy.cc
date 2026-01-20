/**
 * ═════════════════════════════════════════════════════════════════════
 * ADMIN MODULE - Entry point
 * ═════════════════════════════════════════════════════════════════════
 */

// Controller (Elysia routes)
export { adminController } from './admin.controller';

// Schema (TypeBox models)
export {
  AdminBanLinkBody,
  type AdminBanLinkBodyType,
  AdminModel,
  AdminStatsResponse,
  type AdminStatsResponseType,
  AdminUserListQuery,
  type AdminUserListQueryType,
  AdminUserResponse,
  type AdminUserResponseType,
  AdminUserUpdateBody,
  type AdminUserUpdateBodyType,
  AuditLogQuery,
  type AuditLogQueryType,
  AuditLogResponse,
  type AuditLogResponseType
} from './admin.schema';

// Service (Business logic)
export { AdminService } from './admin.service';
