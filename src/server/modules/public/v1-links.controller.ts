/**
 * ═══════════════════════════════════════════════════════════════════
 * PUBLIC API V1 - Links Controller
 * ═══════════════════════════════════════════════════════════════════
 * Endpoints for programmatic link management via API keys.
 *
 * Architecture Note: Each endpoint group uses separate Elysia instances
 * to ensure scope requirements are properly isolated and don't stack.
 * ═══════════════════════════════════════════════════════════════════
 */

import { Elysia, t } from 'elysia';
import { Scopes } from '@/server/config/scopes';
import { createLogger } from '@/server/lib/telemetry';
import { requireApiKey } from '@/server/middleware/api-key.guard';
import { LinksModel } from '@/server/modules/links';
import { LinkService } from '@/server/modules/links/links.service';
import type { ApiKeyContext } from '@/types/api-keys.types';

const logger = createLogger('v1-links-controller');

/**
 * Helper type for context with API key
 */
type WithApiKey<T> = T & { apiKey: ApiKeyContext['apiKey'] };

// ─── Write Operations (links:write) ───────────────────────────────
const writeOperations = new Elysia({ name: 'V1Links.Write' })
  .use(LinksModel)
  .use(requireApiKey({ scopes: [Scopes.LINKS_WRITE] }))

  // Create Link
  .post(
    '/',
    async (ctx) => {
      const { body, apiKey } = ctx as WithApiKey<typeof ctx>;

      try {
        const link = await LinkService.createLink(
          {
            url: body.url,
            customAlias: body.customAlias,
            expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
            maxClicks: body.maxClicks,
            password: body.password,
            redirectType: body.redirectType,
            metaTitle: body.metaTitle,
            metaDescription: body.metaDescription,
            metaImage: body.metaImage,
            utmSource: body.utmSource,
            utmMedium: body.utmMedium,
            utmCampaign: body.utmCampaign,
            tags: body.tags,
            notes: body.notes
          },
          apiKey.userId,
          'api-key' // IP hash placeholder for API keys
        );

        return {
          success: true as const,
          data: LinkService.formatLinkResponse(link)
        };
      } catch (error) {
        logger.error('Failed to create link via API', {
          userId: apiKey.userId,
          error: error instanceof Error ? error.message : String(error)
        });

        if (error instanceof Error && 'code' in error) {
          const errorWithCode = error as Error & { code: string };
          return {
            success: false as const,
            error: {
              code: errorWithCode.code,
              message: error.message
            }
          };
        }

        throw error;
      }
    },
    {
      body: 'links.create',
      detail: {
        summary: 'Shorten URL',
        description: 'Create a new shortened link',
        security: [{ apiKeyAuth: [] }]
      }
    }
  )

  // Delete Link
  .delete(
    '/:id',
    async (ctx) => {
      const { params, apiKey, set } = ctx as WithApiKey<typeof ctx>;

      try {
        await LinkService.softDeleteLink(params.id, apiKey.userId);
        set.status = 204;
        return;
      } catch (_error) {
        set.status = 404;
        return {
          success: false as const,
          error: {
            code: 'LINK_NOT_FOUND',
            message: 'Link not found or already deleted'
          }
        };
      }
    },
    {
      params: t.Object({
        id: t.String({ description: 'Link ID' })
      }),
      detail: {
        summary: 'Delete Link',
        description: 'Soft delete a link',
        security: [{ apiKeyAuth: [] }]
      }
    }
  );

// ─── Read Operations (links:read) ─────────────────────────────────
const readOperations = new Elysia({ name: 'V1Links.Read' })
  .use(LinksModel)
  .use(requireApiKey({ scopes: [Scopes.LINKS_READ] }))

  // Get Single Link
  .get(
    '/:id',
    async (ctx) => {
      const { params, apiKey, set } = ctx as WithApiKey<typeof ctx>;

      const link = await LinkService.getLinkById(params.id, apiKey.userId);

      if (!link) {
        set.status = 404;
        return {
          success: false as const,
          error: {
            code: 'LINK_NOT_FOUND',
            message: 'Link not found'
          }
        };
      }

      return {
        success: true as const,
        data: LinkService.formatLinkResponse(link)
      };
    },
    {
      params: t.Object({
        id: t.String({ description: 'Link ID' })
      }),
      detail: {
        summary: 'Get Link',
        description: 'Retrieve a specific link by ID',
        security: [{ apiKeyAuth: [] }]
      }
    }
  )

  // List Links
  .get(
    '/',
    async (ctx) => {
      const { query, apiKey } = ctx as WithApiKey<typeof ctx>;

      const result = await LinkService.listUserLinks(apiKey.userId, {
        page: query.page ? Number.parseInt(query.page, 10) : 1,
        perPage: query.perPage ? Number.parseInt(query.perPage, 10) : 20,
        sortBy: query.sortBy ?? 'createdAt',
        sortOrder: query.sortOrder ?? 'desc',
        search: query.search,
        isActive:
          query.isActive === 'true'
            ? true
            : query.isActive === 'false'
              ? false
              : undefined
      });

      return {
        success: true as const,
        ...result
      };
    },
    {
      query: 'links.list.query',
      detail: {
        summary: 'List Links',
        description: 'Get paginated list of your links',
        security: [{ apiKeyAuth: [] }]
      }
    }
  );

// ─── Analytics Operations (analytics:read) ────────────────────────
const analyticsOperations = new Elysia({ name: 'V1Links.Analytics' })
  .use(requireApiKey({ scopes: [Scopes.ANALYTICS_READ] }))

  // Get Link Stats
  .get(
    '/:id/stats',
    async (ctx) => {
      const { params, apiKey, set } = ctx as WithApiKey<typeof ctx>;

      // First verify the link belongs to the user
      const link = await LinkService.getLinkById(params.id, apiKey.userId);

      if (!link) {
        set.status = 404;
        return {
          success: false as const,
          error: {
            code: 'LINK_NOT_FOUND',
            message: 'Link not found'
          }
        };
      }

      return {
        success: true as const,
        data: {
          clicks: link.clicksCount,
          uniqueVisitors: 0, // TODO: Implement when analytics module is available
          lastClickedAt: link.lastClickedAt?.toISOString() ?? null
        }
      };
    },
    {
      params: t.Object({
        id: t.String({ description: 'Link ID' })
      }),
      detail: {
        summary: 'Get Link Statistics',
        description: 'Get basic statistics for a link',
        security: [{ apiKeyAuth: [] }]
      }
    }
  );

// ─── Main Controller (combines all operations) ────────────────────
export const v1LinksController = new Elysia({
  prefix: '/links',
  detail: {
    tags: ['Public API V1 - Links']
  }
})
  // Mount operation groups - each with isolated scope requirements
  .use(writeOperations)
  .use(readOperations)
  .use(analyticsOperations);
