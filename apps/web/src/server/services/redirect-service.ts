/**
 * ═══════════════════════════════════════════════════════════════════
 * REDIRECT SERVICE (web-app wiring)
 * ═══════════════════════════════════════════════════════════════════
 * Wires the @urlfy/redirect-domain service with the concrete
 * @urlfy/data repository implementation.
 *
 * This file owns the only place in apps/web where @urlfy/data is
 * imported, keeping the redirect-domain package free of a direct
 * database dependency.
 * ═══════════════════════════════════════════════════════════════════
 */

import { createRedirectLinkRepository } from '@urlfy/data/redirect-repository';
import {
  createRedirectService,
  defaultRedirectFetcherDependencies,
  getLink,
  isCodeAvailable
} from '@urlfy/redirect-domain';

const linksRepository = createRedirectLinkRepository();

const fetcherDeps = {
  ...defaultRedirectFetcherDependencies,
  links: linksRepository
};

export const redirectService = createRedirectService({
  fetchLink: (code) => getLink(code, fetcherDeps),
  isCodeAvailable: (code) => isCodeAvailable(code, fetcherDeps)
});
