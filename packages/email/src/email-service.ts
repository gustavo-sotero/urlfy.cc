import { getLocaleByEmail, getUserLocale, resolveLocale } from './locale';
import { renderEmail } from './render';
import { sendEmail } from './transport';
import type {
  AppLocale,
  DataDeletionConfirmationPayload,
  EmailVerificationPayload,
  LinkBannedPayload,
  PasswordResetPayload,
  QuotaWarningPayload,
  WelcomeEmailPayload
} from './types';

export const emailService = {
  async sendWelcomeEmail(params: {
    to: string;
    firstName: string;
    email: string;
    userId?: string;
    locale?: string;
  }) {
    let locale: AppLocale;
    if (params.locale) {
      locale = resolveLocale(params.locale);
    } else if (params.userId) {
      locale = await getUserLocale(params.userId);
    } else {
      locale = await getLocaleByEmail(params.email);
    }

    const payload: WelcomeEmailPayload = {
      firstName: params.firstName,
      email: params.email
    };

    const { subject, html } = await renderEmail({
      locale,
      template: 'welcome',
      payload
    });

    return sendEmail({ to: params.to, subject, html });
  },

  async sendEmailVerification(params: {
    to: string;
    firstName: string;
    verificationUrl: string;
    expiresInMinutes?: number;
    userId?: string;
    locale?: string;
  }) {
    let locale: AppLocale;
    if (params.locale) {
      locale = resolveLocale(params.locale);
    } else if (params.userId) {
      locale = await getUserLocale(params.userId);
    } else {
      locale = await getLocaleByEmail(params.to);
    }

    const payload: EmailVerificationPayload = {
      firstName: params.firstName,
      verificationUrl: params.verificationUrl,
      expiresInMinutes: params.expiresInMinutes
    };

    const { subject, html } = await renderEmail({
      locale,
      template: 'emailVerification',
      payload
    });

    return sendEmail({ to: params.to, subject, html });
  },

  async sendPasswordResetEmail(params: {
    to: string;
    firstName: string;
    resetUrl: string;
    expiresInMinutes?: number;
    userId?: string;
    locale?: string;
  }) {
    let locale: AppLocale;
    if (params.locale) {
      locale = resolveLocale(params.locale);
    } else if (params.userId) {
      locale = await getUserLocale(params.userId);
    } else {
      locale = await getLocaleByEmail(params.to);
    }

    const payload: PasswordResetPayload = {
      firstName: params.firstName,
      resetUrl: params.resetUrl,
      expiresInMinutes: params.expiresInMinutes
    };

    const { subject, html } = await renderEmail({
      locale,
      template: 'passwordReset',
      payload
    });

    return sendEmail({ to: params.to, subject, html });
  },

  async sendDataDeletionConfirmation(params: {
    to: string;
    firstName: string;
    requestDate: Date;
    deadlineDate: Date;
    exportUrl?: string;
    userId?: string;
    locale?: string;
  }) {
    let locale: AppLocale;
    if (params.locale) {
      locale = resolveLocale(params.locale);
    } else if (params.userId) {
      locale = await getUserLocale(params.userId);
    } else {
      locale = await getLocaleByEmail(params.to);
    }

    const payload: DataDeletionConfirmationPayload = {
      firstName: params.firstName,
      requestDate: params.requestDate,
      deadlineDate: params.deadlineDate,
      exportUrl: params.exportUrl
    };

    const { subject, html } = await renderEmail({
      locale,
      template: 'dataDeletionConfirmation',
      payload
    });

    return sendEmail({ to: params.to, subject, html });
  },

  async sendLinkBannedNotification(params: {
    to: string;
    firstName: string;
    linkUrl: string;
    shortCode: string;
    bannedReason: string;
    bannedAt: Date;
    appealUrl: string;
    userId?: string;
    locale?: string;
  }) {
    let locale: AppLocale;
    if (params.locale) {
      locale = resolveLocale(params.locale);
    } else if (params.userId) {
      locale = await getUserLocale(params.userId);
    } else {
      locale = await getLocaleByEmail(params.to);
    }

    const payload: LinkBannedPayload = {
      firstName: params.firstName,
      linkUrl: params.linkUrl,
      shortCode: params.shortCode,
      bannedReason: params.bannedReason,
      bannedAt: params.bannedAt,
      appealUrl: params.appealUrl
    };

    const { subject, html } = await renderEmail({
      locale,
      template: 'linkBanned',
      payload
    });

    return sendEmail({ to: params.to, subject, html });
  },

  async sendQuotaWarning(params: {
    to: string;
    firstName: string;
    currentUsage: number;
    quotaLimit: number;
    percentUsed: number;
    upgradeUrl: string;
    userId?: string;
    locale?: string;
  }) {
    let locale: AppLocale;
    if (params.locale) {
      locale = resolveLocale(params.locale);
    } else if (params.userId) {
      locale = await getUserLocale(params.userId);
    } else {
      locale = await getLocaleByEmail(params.to);
    }

    const payload: QuotaWarningPayload = {
      firstName: params.firstName,
      currentUsage: params.currentUsage,
      quotaLimit: params.quotaLimit,
      percentUsed: params.percentUsed,
      upgradeUrl: params.upgradeUrl
    };

    const { subject, html } = await renderEmail({
      locale,
      template: 'quotaWarning',
      payload
    });

    return sendEmail({ to: params.to, subject, html });
  }
};
