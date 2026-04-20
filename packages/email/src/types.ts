/**
 * Email i18n Types
 * Defines the type-safe structure for email templates and payloads.
 * Self-contained — no dependency on app-local i18n routing.
 */

export type AppLocale = 'en' | 'pt-br';

export function isAppLocale(value: unknown): value is AppLocale {
  return value === 'en' || value === 'pt-br';
}

export const defaultLocale: AppLocale = 'en';

export type EmailTemplate =
  | 'welcome'
  | 'emailVerification'
  | 'passwordReset'
  | 'dataDeletionConfirmation'
  | 'linkBanned'
  | 'quotaWarning';

export interface WelcomeEmailPayload {
  firstName: string;
  email: string;
}

export interface EmailVerificationPayload {
  firstName: string;
  verificationUrl: string;
  expiresInMinutes?: number;
}

export interface PasswordResetPayload {
  firstName: string;
  resetUrl: string;
  expiresInMinutes?: number;
}

export interface DataDeletionConfirmationPayload {
  firstName: string;
  requestDate: Date;
  deadlineDate: Date;
  exportUrl?: string;
}

export interface LinkBannedPayload {
  firstName: string;
  linkUrl: string;
  shortCode: string;
  bannedReason: string;
  bannedAt: Date;
  appealUrl: string;
}

export interface QuotaWarningPayload {
  firstName: string;
  currentUsage: number;
  quotaLimit: number;
  percentUsed: number;
  upgradeUrl: string;
}

export type EmailPayloadByTemplate = {
  welcome: WelcomeEmailPayload;
  emailVerification: EmailVerificationPayload;
  passwordReset: PasswordResetPayload;
  dataDeletionConfirmation: DataDeletionConfirmationPayload;
  linkBanned: LinkBannedPayload;
  quotaWarning: QuotaWarningPayload;
};

export interface RenderEmailInput<T extends EmailTemplate> {
  locale: AppLocale;
  template: T;
  payload: EmailPayloadByTemplate[T];
}

export interface RenderEmailResult {
  subject: string;
  html: string;
  text?: string;
}

export interface EmailMessages {
  welcome: {
    subject: string;
    previewText: string;
    greeting: string;
    welcomeMessage: string;
    accountCreated: string;
    yourEmail: string;
    whatYouCanDo: string;
    createLinks: string;
    createLinksDesc: string;
    customizeUrls: string;
    customizeUrlsDesc: string;
    trackAnalytics: string;
    trackAnalyticsDesc: string;
    getStarted: string;
    needHelp: string;
    contactSupport: string;
    footer: string;
  };
  emailVerification: {
    subject: string;
    previewText: string;
    title: string;
    greeting: string;
    message: string;
    securityNotice: string;
    expiresIn: string;
    ctaButton: string;
    cantClick: string;
    copyLink: string;
    footer: string;
  };
  passwordReset: {
    subject: string;
    previewText: string;
    title: string;
    greeting: string;
    message: string;
    expiresNotice: string;
    ctaButton: string;
    copyLink: string;
    securityTips: string;
    tip1: string;
    tip2: string;
    tip3: string;
    didntRequest: string;
    footer: string;
  };
  dataDeletionConfirmation: {
    subject: string;
    previewText: string;
    title: string;
    greeting: string;
    message: string;
    requestDetails: string;
    requestedOn: string;
    deadline: string;
    whatHappensNext: string;
    step1: string;
    step2: string;
    step3: string;
    exportData: string;
    cancelRequest: string;
    footer: string;
    deletionHeader: string;
    deletionItem1: string;
    deletionItem2: string;
    deletionItem3: string;
    deletionItem4: string;
    deletionItem5: string;
    exportPrompt: string;
    exportDesc: string;
    warningNote: string;
  };
  linkBanned: {
    subject: string;
    previewText: string;
    title: string;
    greeting: string;
    message: string;
    shortCode: string;
    originalUrl: string;
    reason: string;
    bannedOn: string;
    whatYouCanDo: string;
    reviewTerms: string;
    reviewTermsDesc: string;
    appeal: string;
    appealDesc: string;
    createNew: string;
    createNewDesc: string;
    footer: string;
    implicationsHeader: string;
    implication1: string;
    implication2: string;
    implication3: string;
    implication4: string;
    commonReasonsHeader: string;
    commonReason1: string;
    commonReason2: string;
    commonReason3: string;
    commonReason4: string;
    appealCta: string;
  };
  quotaWarning: {
    subject: string;
    previewText: string;
    title: string;
    greeting: string;
    message: string;
    currentUsage: string;
    quotaLimit: string;
    percentUsed: string;
    whatYouCanDo: string;
    upgrade: string;
    upgradeDesc: string;
    manageLinks: string;
    manageLinksDesc: string;
    footer: string;
    warningNear: string;
    warningCritical: string;
    upgradeCta: string;
  };
}
