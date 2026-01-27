/**
 * ═════════════════════════════════════════════════════════════════════
 * CONTACT SERVICE - Business logic for contact messages
 * ═════════════════════════════════════════════════════════════════════
 * Module: Contact System
 * Pattern: Object with static-like methods (non-request dependent)
 * ═════════════════════════════════════════════════════════════════════
 */

import { count, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { contactMessage } from '@/db/schema';
import type { ContactBodyType, MessageUpdateBodyType } from './contact.schema';

// ═══════════════════════════════════════════════════════════════════
// TELEGRAM UTILITIES
// ═══════════════════════════════════════════════════════════════════

interface TelegramConfig {
  botToken: string;
  chatId: string;
}

function getTelegramConfig(): TelegramConfig | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return null;
  }

  return { botToken, chatId };
}

async function sendTelegramNotification(
  config: TelegramConfig,
  message: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const text = `
🔔 *New Contact Message*

👤 *From:* ${escapeMarkdown(message.name)}
📧 *Email:* ${escapeMarkdown(message.email)}
📝 *Subject:* ${escapeMarkdown(message.subject)}

💬 *Message:*
${escapeMarkdown(message.message)}
`;

    const response = await fetch(
      `https://api.telegram.org/bot${config.botToken}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chat_id: config.chatId,
          text: text,
          parse_mode: 'Markdown'
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        error: `Telegram API error: ${response.status} - ${error}`
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Escape markdown special characters for Telegram
 */
function escapeMarkdown(text: string): string {
  return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

// ═══════════════════════════════════════════════════════════════════
// CONTACT SERVICE
// ═══════════════════════════════════════════════════════════════════

export const ContactService = {
  /**
   * Create a new contact message
   * @param input - Contact form data
   * @param ipAddress - IP address of the sender
   * @param userAgent - User agent of the sender
   * @returns Created contact message ID
   */
  async create(
    input: ContactBodyType,
    ipAddress: string,
    userAgent?: string
  ): Promise<{ id: string; telegramSent: boolean }> {
    // Validate consent
    if (!input.consent) {
      throw new Error('CONSENT_REQUIRED');
    }

    const messageId = crypto.randomUUID();

    // 1. Insert into database
    await db.insert(contactMessage).values({
      id: messageId,
      name: input.name,
      email: input.email,
      subject: input.subject,
      message: input.message,
      ipAddress,
      userAgent: userAgent || null,
      consentGiven: 'yes',
      telegramSent: 'no',
      telegramError: null,
      status: 'unread'
    });

    // 2. Attempt Telegram notification (non-blocking)
    let telegramSuccess = false;
    const telegramConfig = getTelegramConfig();

    if (telegramConfig) {
      const result = await sendTelegramNotification(telegramConfig, input);

      if (result.success) {
        telegramSuccess = true;
        await db
          .update(contactMessage)
          .set({ telegramSent: 'yes' })
          .where(eq(contactMessage.id, messageId));
      } else {
        // Log error but don't fail the request
        console.error(
          '[ContactService] Telegram notification failed:',
          result.error
        );
        await db
          .update(contactMessage)
          .set({ telegramError: result.error })
          .where(eq(contactMessage.id, messageId));
      }
    }

    return {
      id: messageId,
      telegramSent: telegramSuccess
    };
  },

  /**
   * List contact messages (admin)
   * @param query - Filter and pagination options
   * @returns Paginated list of messages
   */
  async list(query: {
    status?: 'all' | 'unread' | 'read' | 'archived';
    page?: number;
    perPage?: number;
  }): Promise<{
    data: Array<{
      id: string;
      name: string;
      email: string;
      subject: string;
      message: string;
      status: string;
      telegramSent: string;
      createdAt: Date | null;
    }>;
    meta: {
      total: number;
      page: number;
      perPage: number;
      lastPage: number;
      hasMore: boolean;
    };
  }> {
    const page = query.page || 1;
    const perPage = Math.min(query.perPage || 20, 100);
    const offset = (page - 1) * perPage;

    // Build where condition
    const whereCondition =
      query.status && query.status !== 'all'
        ? eq(contactMessage.status, query.status)
        : undefined;

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(contactMessage)
      .where(whereCondition);

    const total = totalResult?.count || 0;

    // Get messages
    const messages = await db
      .select()
      .from(contactMessage)
      .where(whereCondition)
      .orderBy(desc(contactMessage.createdAt))
      .limit(perPage)
      .offset(offset);

    const lastPage = Math.ceil(total / perPage);

    return {
      data: messages,
      meta: {
        total,
        page,
        perPage,
        lastPage,
        hasMore: page < lastPage
      }
    };
  },

  /**
   * Get a single message by ID (admin)
   * @param id - Message ID
   * @returns Message details or null
   */
  async getById(id: string) {
    const [message] = await db
      .select()
      .from(contactMessage)
      .where(eq(contactMessage.id, id))
      .limit(1);

    return message || null;
  },

  /**
   * Update message status (admin)
   * @param id - Message ID
   * @param data - Update data
   */
  async updateStatus(id: string, data: MessageUpdateBodyType): Promise<void> {
    await db
      .update(contactMessage)
      .set({ status: data.status })
      .where(eq(contactMessage.id, id));
  },

  /**
   * Delete a message (admin)
   * @param id - Message ID
   */
  async delete(id: string): Promise<void> {
    await db.delete(contactMessage).where(eq(contactMessage.id, id));
  }
};
