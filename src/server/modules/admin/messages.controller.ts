/**
 * ═════════════════════════════════════════════════════════════════════
 * ADMIN CONTACT MESSAGES CONTROLLER
 * ═════════════════════════════════════════════════════════════════════
 * Admin-only endpoints for managing contact messages
 * ═════════════════════════════════════════════════════════════════════
 */

import { Elysia, t } from 'elysia';
import { AppError, ErrorCode } from '@/server/lib/error-handler';
import { createLogger } from '@/server/lib/telemetry';
import { adminRateLimits } from '@/server/middleware/admin-rate-limit';
import { requireAdmin } from '@/server/middleware/auth.middleware';
import {
  MessageListQuery,
  MessageUpdateBody
} from '@/server/modules/contact/contact.schema';
import { ContactService } from '@/server/modules/contact/contact.service';

const logger = createLogger('admin-messages-controller');

// ═══════════════════════════════════════════════════════════════════
// ADMIN MESSAGES CONTROLLER
// ═══════════════════════════════════════════════════════════════════

export const adminMessagesController = new Elysia({
  prefix: '/admin/messages'
})
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
