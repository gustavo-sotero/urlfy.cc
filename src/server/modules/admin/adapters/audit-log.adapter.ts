import { auditLogService } from '@/server/services/audit.service';

export const adminAuditAdapter = {
  getRecent: auditLogService.getRecent.bind(auditLogService),
  getById: auditLogService.getById.bind(auditLogService),
  getByEntity: auditLogService.getByEntity.bind(auditLogService),
  getByUser: auditLogService.getByUser.bind(auditLogService),
  getSummary: auditLogService.getSummary.bind(auditLogService)
};
