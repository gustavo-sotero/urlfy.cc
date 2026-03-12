// Thin shim - canonical implementation lives in @urlfy/email.
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
} from '@urlfy/email/types';
export { defaultLocale, isAppLocale } from '@urlfy/email/types';
