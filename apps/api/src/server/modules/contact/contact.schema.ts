/**
 * ═════════════════════════════════════════════════════════════════════
 * CONTACT SCHEMA - Validation schemas for contact endpoints
 * ═════════════════════════════════════════════════════════════════════
 * Module: Contact System
 * Pattern: TypeBox schemas as Single Source of Truth
 * ═════════════════════════════════════════════════════════════════════
 */

import { Elysia, type Static, t } from 'elysia';

// ═══════════════════════════════════════════════════════════════════
// CONTACT MESSAGE CREATE
// ═══════════════════════════════════════════════════════════════════

export const ContactBody = t.Object({
  name: t.String({
    minLength: 2,
    maxLength: 255,
    description: 'Contact name'
  }),
  email: t.String({
    format: 'email',
    maxLength: 255,
    description: 'Contact email address'
  }),
  subject: t.String({
    minLength: 3,
    maxLength: 255,
    description: 'Message subject'
  }),
  message: t.String({
    minLength: 10,
    maxLength: 5000,
    description: 'Message content'
  }),
  consent: t.Boolean({
    description: 'LGPD consent for data storage (must be true)'
  })
});
export type ContactBodyType = Static<typeof ContactBody>;

// ═══════════════════════════════════════════════════════════════════
// CONTACT MESSAGE RESPONSE
// ═══════════════════════════════════════════════════════════════════

export const ContactResponse = t.Object({
  success: t.Boolean(),
  message: t.String()
});
export type ContactResponseType = Static<typeof ContactResponse>;

// ═══════════════════════════════════════════════════════════════════
// ADMIN - MESSAGE LIST QUERY
// ═══════════════════════════════════════════════════════════════════

export const MessageListQuery = t.Object({
  status: t.Optional(
    t.Union(
      [
        t.Literal('all'),
        t.Literal('unread'),
        t.Literal('read'),
        t.Literal('archived')
      ],
      {
        description: 'Filter by message status'
      }
    )
  ),
  page: t.Optional(
    t.Integer({
      minimum: 1,
      default: 1,
      description: 'Page number'
    })
  ),
  perPage: t.Optional(
    t.Integer({
      minimum: 1,
      maximum: 100,
      default: 20,
      description: 'Items per page'
    })
  )
});
export type MessageListQueryType = Static<typeof MessageListQuery>;

// ═══════════════════════════════════════════════════════════════════
// ADMIN - MESSAGE UPDATE
// ═══════════════════════════════════════════════════════════════════

export const MessageUpdateBody = t.Object({
  status: t.Union(
    [t.Literal('unread'), t.Literal('read'), t.Literal('archived')],
    {
      description: 'Update message status'
    }
  )
});
export type MessageUpdateBodyType = Static<typeof MessageUpdateBody>;

export const AdminContactMessage = t.Object({
  id: t.String({ description: 'Contact message ID' }),
  name: t.String({ description: 'Sender name' }),
  email: t.String({ description: 'Sender email address' }),
  subject: t.String({ description: 'Message subject' }),
  message: t.String({ description: 'Message body' }),
  status: t.Union([
    t.Literal('unread'),
    t.Literal('read'),
    t.Literal('archived')
  ]),
  telegramSent: t.String({ description: 'Telegram delivery status' }),
  createdAt: t.Nullable(
    t.String({ format: 'date-time', description: 'Creation timestamp' })
  )
});
export type AdminContactMessageType = Static<typeof AdminContactMessage>;

// ═══════════════════════════════════════════════════════════════════
// MODEL REGISTRATION
// ═══════════════════════════════════════════════════════════════════

export const ContactModel = new Elysia({ name: 'contact.model' }).model({
  'contact.admin.message': AdminContactMessage,
  'contact.create': ContactBody,
  'contact.response': ContactResponse,
  'contact.list': MessageListQuery,
  'contact.update': MessageUpdateBody
});
