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
import {
  ErrorRef,
  PaginatedResponse,
  ResponseModels,
  SuccessResponse
} from '@/server/lib/response.schema';
import { createLogger } from '@/server/lib/telemetry';
import { requireApiKey } from '@/server/middleware/api-key.guard';
import {
  LINK_RESPONSE_EXAMPLE,
  LINK_STATS_EXAMPLE,
  LinksModel
} from '@/server/modules/links';
import { LinkService } from '@/server/modules/links/links.service';

const logger = createLogger('v1-links-controller');

/**
 * Helper type for context with API key
 */

// ─── Write Operations (links:write) ───────────────────────────────
const writeOperations = new Elysia({ name: 'V1Links.Write' })
  .use(LinksModel)
  .use(ResponseModels)
  .use(requireApiKey({ scopes: [Scopes.LINKS_WRITE] }))

  // Create Link
  .post(
    '/',
    async ({ body, apiKey }) => {
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
          apiKey?.userId,
          'api-key' // IP hash placeholder for API keys
        );

        return {
          success: true as const,
          data: LinkService.formatLinkResponse(link)
        };
      } catch (error) {
        logger.error('Failed to create link via API', {
          userId: apiKey?.userId,
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
      },
      response: {
        201: SuccessResponse(t.Ref('links.response'), {
          description: 'Link created successfully',
          example: LINK_RESPONSE_EXAMPLE
        }),
        400: ErrorRef(400),
        401: ErrorRef(401),
        403: ErrorRef(403),
        409: ErrorRef(409),
        422: ErrorRef(422),
        429: ErrorRef(429),
        500: ErrorRef(500)
      }
    }
  )

  // Create Link (Alias)
  .post(
    '/shorten',
    async ({ body, apiKey }) => {
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
          apiKey?.userId,
          'api-key' // IP hash placeholder for API keys
        );

        return {
          success: true as const,
          data: LinkService.formatLinkResponse(link)
        };
      } catch (error) {
        logger.error('Failed to create link via API', {
          userId: apiKey?.userId,
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
        summary: 'Shorten URL (Alias)',
        description: 'Alias for creating a new shortened link',
        security: [{ apiKeyAuth: [] }]
      },
      response: {
        201: SuccessResponse(t.Ref('links.response'), {
          description: 'Link created successfully',
          example: LINK_RESPONSE_EXAMPLE
        }),
        400: ErrorRef(400),
        401: ErrorRef(401),
        403: ErrorRef(403),
        409: ErrorRef(409),
        422: ErrorRef(422),
        429: ErrorRef(429),
        500: ErrorRef(500)
      }
    }
  )

  // Delete Link
  .delete(
    '/:id',
    async ({ params, apiKey, set }) => {
      try {
        // biome-ignore lint/style/noNonNullAssertion: apiKey guaranteed non-null by requireApiKey middleware
        await LinkService.softDeleteLink(params.id, apiKey!.userId);
        return {
          success: true as const,
          data: {
            deleted: true as const,
            id: params.id
          }
        };
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
      },
      response: {
        200: SuccessResponse(
          t.Object({
            deleted: t.Literal(true),
            id: t.String({ format: 'uuid' })
          }),
          'Link deleted successfully (soft delete)'
        ),
        401: ErrorRef(401),
        403: ErrorRef(403),
        404: ErrorRef(404),
        500: ErrorRef(500)
      }
    }
  );

// ─── Read Operations (links:read) ─────────────────────────────────
const readOperations = new Elysia({ name: 'V1Links.Read' })
  .use(LinksModel)
  .use(ResponseModels)
  .use(requireApiKey({ scopes: [Scopes.LINKS_READ] }))

  // Get Single Link
  .get(
    '/:id',
    async ({ params, apiKey, set }) => {
      // biome-ignore lint/style/noNonNullAssertion: apiKey guaranteed non-null by requireApiKey middleware
      const link = await LinkService.getLinkById(params.id, apiKey!.userId);

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
      },
      response: {
        200: SuccessResponse(t.Ref('links.response'), {
          description: 'Link details retrieved successfully',
          example: LINK_RESPONSE_EXAMPLE
        }),
        401: ErrorRef(401),
        403: ErrorRef(403),
        404: ErrorRef(404),
        410: ErrorRef(410),
        451: ErrorRef(451),
        500: ErrorRef(500)
      }
    }
  );

// ─── List Operations (links:read, no quota increment) ────────────
const listOperations = new Elysia({ name: 'V1Links.List' })
  .use(LinksModel)
  .use(ResponseModels)
  .use(requireApiKey({ scopes: [Scopes.LINKS_READ], skipQuotaIncrement: true }))

  // List Links
  .get(
    '/',
    async ({ query, apiKey }) => {
      // biome-ignore lint/style/noNonNullAssertion: apiKey guaranteed non-null by requireApiKey middleware
      const result = await LinkService.listUserLinks(apiKey!.userId, {
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
        data: result.data.map((link) => LinkService.formatLinkResponse(link)),
        meta: result.meta
      };
    },
    {
      query: 'links.list.query',
      detail: {
        summary: 'List Links',
        description:
          'Get paginated list of your links (does not consume quota)',
        security: [{ apiKeyAuth: [] }]
      },
      response: {
        200: PaginatedResponse(t.Ref('links.response'), {
          description: 'Paginated list of user links',
          exampleItem: LINK_RESPONSE_EXAMPLE
        }),
        401: ErrorRef(401),
        403: ErrorRef(403),
        429: ErrorRef(429),
        500: ErrorRef(500)
      }
    }
  );

// ─── Analytics Operations (analytics:read) ────────────────────────
const analyticsOperations = new Elysia({ name: 'V1Links.Analytics' })
  .use(ResponseModels)
  .use(requireApiKey({ scopes: [Scopes.ANALYTICS_READ] }))

  // Get Link Stats
  .get(
    '/:id/stats',
    async ({ params, apiKey, set }) => {
      // First verify the link belongs to the user
      // biome-ignore lint/style/noNonNullAssertion: apiKey guaranteed non-null by requireApiKey middleware
      const link = await LinkService.getLinkById(params.id, apiKey!.userId);

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
      },
      response: {
        200: SuccessResponse(t.Ref('links.stats.response'), {
          description: 'Link statistics retrieved successfully',
          example: LINK_STATS_EXAMPLE
        }),
        401: ErrorRef(401),
        403: ErrorRef(403),
        404: ErrorRef(404),
        500: ErrorRef(500)
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
  .use(listOperations)
  .use(analyticsOperations);
