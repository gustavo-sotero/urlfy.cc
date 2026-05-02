/**
 * ═════════════════════════════════════════════════════════════════════
 * ADMIN CONTACT MESSAGES CONTROLLER
 * ═════════════════════════════════════════════════════════════════════
 * Admin-only endpoints for managing contact messages
 * ═════════════════════════════════════════════════════════════════════
 */

import { Elysia, t } from 'elysia';
import { AppError, ErrorCode } from '@/server/lib/error-handler';
import {
  ErrorRef,
  PaginatedResponse,
  SuccessResponse
} from '@/server/lib/response.schema';
import { createLogger } from '@/server/lib/telemetry';
import { adminRateLimits } from '@/server/middleware/admin-rate-limit';
import { requireAdmin } from '@/server/middleware/auth.middleware';
import {
  ContactModel,
  ContactService,
  MessageListQuery,
  MessageUpdateBody
} from '@/server/services/contact-shared.service';

const logger = createLogger('admin-messages-controller');

// ═══════════════════════════════════════════════════════════════════
// ADMIN MESSAGES CONTROLLER
// ═══════════════════════════════════════════════════════════════════

export const adminMessagesController = new Elysia({
  prefix: '/admin/messages'
})
  .use(ContactModel)
  .use(requireAdmin)
  .use(adminRateLimits.general)
  .get(
    '/',
    async ({ query }) => {
      const result = await ContactService.list(query);

      return {
        success: true,
        data: result.data,
        meta: result.meta
      };
    },
    {
      query: MessageListQuery,
      detail: {
        summary: 'List contact messages',
        description: 'Admin-only: Get paginated list of contact messages',
        tags: ['Admin', 'Contact']
      },
      response: {
        200: PaginatedResponse(t.Ref('contact.admin.message'), {
          description: 'Paginated list of contact messages'
        }),
        401: ErrorRef(401),
        403: ErrorRef(403),
        500: ErrorRef(500)
      }
    }
  )
  .get(
    '/:id',
    async ({ params }) => {
      const message = await ContactService.getById(params.id);

      if (!message) {
        throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, 'Message not found');
      }

      return {
        success: true,
        data: message
      };
    },
    {
      params: t.Object({
        id: t.String()
      }),
      detail: {
        summary: 'Get message by ID',
        description: 'Admin-only: Get details of a specific message',
        tags: ['Admin', 'Contact']
      },
      response: {
        200: SuccessResponse(
          t.Ref('contact.admin.message'),
          'Contact message details'
        ),
        401: ErrorRef(401),
        403: ErrorRef(403),
        404: ErrorRef(404),
        500: ErrorRef(500)
      }
    }
  )
  .patch(
    '/:id',
    async ({ params, body }) => {
      await ContactService.updateStatus(params.id, body);

      logger.info('Message status updated', {
        messageId: params.id,
        newStatus: body.status
      });

      return {
        success: true as const,
        data: {
          message: 'Status updated successfully'
        }
      };
    },
    {
      params: t.Object({
        id: t.String()
      }),
      body: MessageUpdateBody,
      detail: {
        summary: 'Update message status',
        description: 'Admin-only: Update the status of a message',
        tags: ['Admin', 'Contact']
      },
      response: {
        200: SuccessResponse(
          t.Object({
            message: t.String()
          }),
          'Status updated successfully'
        ),
        400: ErrorRef(400),
        401: ErrorRef(401),
        403: ErrorRef(403),
        404: ErrorRef(404),
        500: ErrorRef(500)
      }
    }
  )
  .delete(
    '/:id',
    async ({ params, set }) => {
      await ContactService.delete(params.id);

      logger.info('Message deleted', {
        messageId: params.id
      });

      set.status = 204;
    },
    {
      params: t.Object({
        id: t.String()
      }),
      detail: {
        summary: 'Delete message',
        description: 'Admin-only: Permanently delete a message',
        tags: ['Admin', 'Contact']
      }
    }
  );
