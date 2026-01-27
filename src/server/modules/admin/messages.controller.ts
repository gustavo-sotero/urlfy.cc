/**
 * ═════════════════════════════════════════════════════════════════════
 * ADMIN CONTACT MESSAGES CONTROLLER
 * ═════════════════════════════════════════════════════════════════════
 * Admin-only endpoints for managing contact messages
 * ═════════════════════════════════════════════════════════════════════
 */

import { Elysia, t } from 'elysia';
import { createLogger } from '@/server/lib/telemetry';
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
  .get(
    '/',
    async ({ query }) => {
      try {
        const result = await ContactService.list(query);

        return {
          success: true,
          data: result.data,
          meta: result.meta
        };
      } catch (error) {
        logger.error('Failed to list messages', {
          error: error instanceof Error ? error.message : String(error)
        });

        throw error;
      }
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
    async ({ params, set }) => {
      try {
        const message = await ContactService.getById(params.id);

        if (!message) {
          set.status = 404;
          return {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Message not found'
            }
          };
        }

        return {
          success: true,
          data: message
        };
      } catch (error) {
        logger.error('Failed to get message', {
          error: error instanceof Error ? error.message : String(error),
          messageId: params.id
        });

        throw error;
      }
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
    async ({ params, body, set }) => {
      try {
        await ContactService.updateStatus(params.id, body);

        logger.info('Message status updated', {
          messageId: params.id,
          newStatus: body.status
        });

        return {
          success: true,
          message: 'Status updated successfully'
        };
      } catch (error) {
        logger.error('Failed to update message status', {
          error: error instanceof Error ? error.message : String(error),
          messageId: params.id
        });

        set.status = 500;
        return {
          success: false,
          error: {
            code: 'UPDATE_FAILED',
            message: 'Failed to update message status'
          }
        };
      }
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
      try {
        await ContactService.delete(params.id);

        logger.info('Message deleted', {
          messageId: params.id
        });

        set.status = 204;
      } catch (error) {
        logger.error('Failed to delete message', {
          error: error instanceof Error ? error.message : String(error),
          messageId: params.id
        });

        set.status = 500;
        return {
          success: false,
          error: {
            code: 'DELETE_FAILED',
            message: 'Failed to delete message'
          }
        };
      }
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
