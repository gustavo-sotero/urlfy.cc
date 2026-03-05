import { auditLogService } from '@/server/services/audit.service';

type AuditLogInput = Parameters<typeof auditLogService.log>[0];

export const usersAuditAdapter = {
  async log(input: AuditLogInput): Promise<void> {
    await auditLogService.log(input);
  }
};
