import { gdprService } from '@/server/services/gdpr.service';

export const usersGdprAdapter = {
  async exportUserData(userId: string) {
    return gdprService.exportUserData(userId);
  },

  async getPendingDeletionRequest(userId: string) {
    return gdprService.getPendingDeletionRequest(userId);
  },

  async scheduleDataDeletion(userId: string) {
    return gdprService.scheduleDataDeletion(userId);
  }
};
