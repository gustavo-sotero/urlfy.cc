/**
 * Input Validators
 * Common validation functions for security and data integrity
 */

/**
 * Input validation utilities for security and data integrity.
 * Provides validators for email, password, usernames, UUIDs, pagination, and more.
 */

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

/**
 * Validate password strength
 */
export interface PasswordStrength {
  strong: boolean;
  score: number;
  feedback: string[];
}

export function validatePasswordStrength(password: string): PasswordStrength {
  const feedback: string[] = [];
  let score = 0;

  if (!password || password.length < 8) {
    feedback.push("Password must be at least 8 characters long");
  } else {
    score += 1;
  }

  if (password.length >= 12) {
    score += 1;
  }

  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    feedback.push("Password should contain lowercase letters");
  }

  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push("Password should contain uppercase letters");
  }

  if (/\d/.test(password)) {
    score += 1;
  } else {
    feedback.push("Password should contain numbers");
  }

  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    score += 1;
  } else {
    feedback.push("Password should contain special characters");
  }

  return {
    strong: score >= 4,
    score,
    feedback,
  };
}

/**
 * Validate username format
 */
export function isValidUsername(username: string): boolean {
  // Alphanumeric, hyphens, underscores, 3-30 chars
  const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
  return usernameRegex.test(username);
}

/**
 * Validate custom link alias
 */
export function isValidAlias(alias: string): boolean {
  // Alphanumeric, hyphens, 3-50 chars
  const aliasRegex = /^[a-zA-Z0-9_-]{3,50}$/;
  return aliasRegex.test(alias);
}

/**
 * Validate API key format
 */
export function isValidAPIKey(apiKey: string): boolean {
  // Format: urlfy_sk_live_xxx (for secret keys)
  // or urlfy_pk_live_xxx (for public keys)
  const apiKeyRegex = /^urlfy_(sk|pk)_(live|test)_[a-zA-Z0-9_]{32,}$/;
  return apiKeyRegex.test(apiKey);
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate short code format (NanoID)
 */
export function isValidShortCode(code: string): boolean {
  // 7 characters, alphanumeric
  const shortCodeRegex = /^[a-zA-Z0-9_-]{7}$/;
  return shortCodeRegex.test(code);
}

/**
 * Validate date format
 */
export function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return date instanceof Date && !Number.isNaN(date.getTime());
}

/**
 * Validate expiration date (must be in future)
 */
export function isValidExpirationDate(dateString: string): boolean {
  if (!isValidDate(dateString)) return false;

  const date = new Date(dateString);
  const now = new Date();

  return date > now;
}

/**
 * Validate range (min, max)
 */
export function isValidRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Validate click limit
 */
export function isValidClickLimit(limit: number | null | undefined): boolean {
  if (limit === null || limit === undefined) return true; // Optional
  return isValidRange(limit, 1, 1000000);
}

/**
 * Validate redirect type
 */
export function isValidRedirectType(type: number): boolean {
  return type === 301 || type === 302;
}

/**
 * Validate QR code size
 */
export function isValidQRSize(size: number): boolean {
  return isValidRange(size, 100, 1000);
}

/**
 * Sanitize filename
 */
export function sanitizeFilename(filename: string): string {
  // Remove path traversal attempts
  let safe = filename.replace(/\.\./g, "").replace(/[/\\]/g, "");

  // Remove special characters except dots, hyphens, underscores
  safe = safe.replace(/[^\w.-]/g, "");

  // Limit length
  safe = safe.slice(0, 255);

  return safe || "file";
}

/**
 * Validate pagination parameters
 */
export interface PaginationParams {
  page: number;
  perPage: number;
  valid: boolean;
  errors: string[];
}

export function validatePagination(
  page?: number | string,
  perPage?: number | string,
  maxPerPage: number = 100,
): PaginationParams {
  const errors: string[] = [];

  let p = 1;
  let pp = 20;

  if (page) {
    const parsed = typeof page === "string" ? parseInt(page, 10) : page;
    if (Number.isNaN(parsed) || parsed < 1) {
      errors.push("Page must be a positive integer");
    } else {
      p = parsed;
    }
  }

  if (perPage) {
    const parsed =
      typeof perPage === "string" ? parseInt(perPage, 10) : perPage;
    if (Number.isNaN(parsed) || parsed < 1 || parsed > maxPerPage) {
      errors.push(`Per page must be between 1 and ${maxPerPage}`);
    } else {
      pp = parsed;
    }
  }

  return {
    page: p,
    perPage: pp,
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate role
 */
export function isValidRole(role: string): boolean {
  return ["user", "admin"].includes(role.toLowerCase());
}

/**
 * Check for suspicious characters in input
 */
export function hasSuspiciousChars(input: string): boolean {
  // Check for control characters (ASCII 0-31 except tabs, newlines, carriage returns)
  // Note: Biome doesn't allow control chars in regex, so we check manually
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    // Control characters except tab (9), LF (10), CR (13)
    if (
      (code >= 0 && code <= 8) ||
      (code >= 11 && code <= 12) ||
      (code >= 14 && code <= 31)
    ) {
      return true;
    }
  }

  const suspiciousPatterns = [
    /\.\.\//gi, // Path traversal /
    /\.\.%2f/gi, // Path traversal encoded
    /<script/gi, // Script tags
    /javascript:/gi, // JavaScript protocol
    /on\w+\s*=/gi, // Event handlers
  ];

  return suspiciousPatterns.some((pattern) => pattern.test(input));
}

/**
 * Validate request body size
 */
export function isValidBodySize(
  sizeBytes: number,
  maxBytes: number = 2 * 1024 * 1024, // 2MB default
): boolean {
  return sizeBytes <= maxBytes;
}
