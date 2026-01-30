import { createLink } from './services/create-link';
import { formatLinkResponse } from './services/format-link';
import {
  getLinkByCode,
  getLinkById,
  getLinkByIdUnsafe
} from './services/get-link';
import { listUserLinks } from './services/list-links';
import { updateLink } from './services/update-link';

// Export individual functions
export { createLink } from './services/create-link';
export { formatLinkResponse } from './services/format-link';
export {
  getLinkByCode,
  getLinkById,
  getLinkByIdUnsafe
} from './services/get-link';
export { listUserLinks } from './services/list-links';
export { updateLink } from './services/update-link';

/**
 * LinkService - Handles all link-related business logic
 * Aggregated for backward compatibility
 */
export const LinkService = {
  createLink,
  listUserLinks,
  getLinkById,
  getLinkByIdUnsafe,
  getLinkByCode,
  updateLink,
  formatLinkResponse
};
