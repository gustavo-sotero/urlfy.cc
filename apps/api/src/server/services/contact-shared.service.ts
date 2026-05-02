/**
 * Shared contact entrypoint for consumers outside of `modules/contact/`.
 *
 * Feature modules must not import sibling modules directly. This shim keeps
 * the contact module as the canonical owner while exposing the narrow surface
 * that admin routes need.
 */

export {
  AdminContactMessage,
  ContactModel,
  ContactService,
  MessageListQuery,
  MessageUpdateBody
} from '@/server/modules/contact';
