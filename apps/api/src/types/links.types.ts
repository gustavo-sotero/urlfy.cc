/**
 * Links types - re-exported from @urlfy/contracts
 * @see packages/contracts/src/links.types.ts
 * @see packages/contracts/src/generated/api.ts (API response contracts)
 */
export type Link = typeof import('@urlfy/data/schema').links.$inferSelect;

export type {
  CreateLinkInput,
  LinkResponse,
  ListLinksQuery,
  PaginatedResponse,
  UpdateLinkInput
} from '@urlfy/contracts';
