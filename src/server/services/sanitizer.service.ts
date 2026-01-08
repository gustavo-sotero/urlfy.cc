/**
 * Sanitizer Service
 * Provides OOP wrapper around sanitization functions for dependency injection
 */

import {
  sanitizeMetaTags,
  sanitizeNotes,
  sanitizeSearchQuery,
  sanitizeTags,
  sanitizeText,
} from "@/server/lib/sanitize";

/**
 * Sanitizer Service Class
 * Wraps sanitization functions in a service class for easier testing and DI
 */
export class SanitizerService {
  /**
   * Sanitize meta tags for OG properties
   */
  sanitizeMetaTags(input: {
    title?: string | null;
    description?: string | null;
    image?: string | null;
  }) {
    return sanitizeMetaTags(input);
  }

  /**
   * Sanitize generic text with max length
   */
  sanitizeText(
    text: string | null | undefined,
    maxLength: number,
  ): string | null {
    return sanitizeText(text, maxLength);
  }

  /**
   * Sanitize array of tags
   */
  sanitizeTags(tags: string[] | null | undefined): string[] | null {
    return sanitizeTags(tags);
  }

  /**
   * Sanitize notes/comments field
   */
  sanitizeNotes(notes: string | null | undefined): string | null {
    return sanitizeNotes(notes);
  }

  /**
   * Sanitize search query input
   */
  sanitizeSearchQuery(query: string | null | undefined): string {
    return sanitizeSearchQuery(query);
  }
}

/**
 * Singleton instance for service-based architecture
 */
export const sanitizerService = new SanitizerService();
