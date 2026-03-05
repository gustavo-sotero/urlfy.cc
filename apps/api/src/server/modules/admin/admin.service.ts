/**
 * ═════════════════════════════════════════════════════════════════════
 * ADMIN SERVICE - Unified facade for admin operations
 * ═════════════════════════════════════════════════════════════════════
 * Delegates to specialized services:
 *   - AdminStatsService  (admin-stats.service.ts)
 *   - AdminUsersService  (admin-users.service.ts)
 *   - AdminLinksService  (admin-links.service.ts)
 *
 * Backward-compatible: consumers can still import { AdminService }.
 * ═════════════════════════════════════════════════════════════════════
 */

import { AdminLinksService } from './admin-links.service';
import { AdminStatsService } from './admin-stats.service';
import { AdminUsersService } from './admin-users.service';

export const AdminService = {
  // Stats
  getGlobalStats: AdminStatsService.getGlobalStats.bind(AdminStatsService),
  getGrowthStats: AdminStatsService.getGrowthStats.bind(AdminStatsService),

  // Users
  listUsers: AdminUsersService.listUsers.bind(AdminUsersService),
  updateUserStatus: AdminUsersService.updateUserStatus.bind(AdminUsersService),

  // Links
  banLink: AdminLinksService.banLink.bind(AdminLinksService),
  unbanLink: AdminLinksService.unbanLink.bind(AdminLinksService),
  searchLinks: AdminLinksService.searchLinks.bind(AdminLinksService),
  listLinks: AdminLinksService.listLinks.bind(AdminLinksService)
};

// Re-export specialized services for direct imports
export { AdminLinksService } from './admin-links.service';
export { AdminStatsService } from './admin-stats.service';
export { AdminUsersService } from './admin-users.service';
