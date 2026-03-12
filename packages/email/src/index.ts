/**
 * @urlfy/email
 * Shared email rendering, transport and locale resolution
 */

export { emailService } from './email-service';
export { getLocaleByEmail, getUserLocale, resolveLocale } from './locale';
export { renderEmail } from './render';
export type { SendEmailOptions } from './transport';
export { sendEmail } from './transport';
export type {
  AppLocale,
  DataDeletionConfirmationPayload,
  EmailMessages,
  EmailPayloadByTemplate,
  EmailTemplate,
  EmailVerificationPayload,
  LinkBannedPayload,
  PasswordResetPayload,
  QuotaWarningPayload,
  RenderEmailInput,
  RenderEmailResult,
  WelcomeEmailPayload
} from './types';
export { defaultLocale, isAppLocale } from './types';
