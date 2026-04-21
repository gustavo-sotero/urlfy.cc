/**
 * ═════════════════════════════════════════════════════════════════════
 * USERS MODULE - Entry point
 * ═════════════════════════════════════════════════════════════════════
 */

export { consentController, meController } from './me.controller';
// Schema (TypeBox models)
export {
  DeletionRequestListItem,
  type DeletionRequestListItemType,
  DeletionRequestResponse,
  type DeletionRequestResponseType,
  UserBanBody,
  type UserBanBodyType,
  UserIdParam,
  type UserIdParamType,
  UserListItemResponse,
  type UserListItemResponseType,
  UserListQuery,
  type UserListQueryType,
  UserProfileResponse,
  type UserProfileResponseType,
  UserQuotaResponse,
  type UserQuotaResponseType,
  UserQuotaUpdateBody,
  type UserQuotaUpdateBodyType,
  UsersModel
} from './users.schema';
// Service (Business logic)
export { UserService } from './users.service';
