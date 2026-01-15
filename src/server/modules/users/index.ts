/**
 * ═════════════════════════════════════════════════════════════════════
 * USERS MODULE - Entry point
 * ═════════════════════════════════════════════════════════════════════
 */

// Controller (Elysia routes)
export { usersController } from './users.controller';
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
  UserRoleUpdateBody,
  type UserRoleUpdateBodyType,
  UsersModel
} from './users.schema';
// Service (Business logic)
export { UserService } from './users.service';
