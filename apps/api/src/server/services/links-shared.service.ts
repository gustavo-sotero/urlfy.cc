/**
 * Shared links entrypoint for consumers outside of `modules/links/`.
 *
 * Feature modules must not import sibling modules directly. This shim keeps
 * link-domain ownership inside the links module while exposing the public API
 * surface required by non-links modules.
 */

export {
  LINK_RESPONSE_EXAMPLE,
  LINK_STATS_EXAMPLE,
  type LinkCreateBodyType,
  LinkLifecycleService,
  LinkService,
  LinksModel
} from '@/server/modules/links';
