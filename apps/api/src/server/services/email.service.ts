// Thin shim - canonical implementation lives in @urlfy/email.
type EmailService = typeof import('@urlfy/email/email-service').emailService;

let emailServicePromise: Promise<EmailService> | null = null;

function getEmailService() {
  emailServicePromise ??= import('@urlfy/email/email-service').then(
    ({ emailService }) => emailService
  );
  return emailServicePromise;
}

export const emailService = {
  async sendWelcomeEmail(
    params: Parameters<EmailService['sendWelcomeEmail']>[0]
  ) {
    return (await getEmailService()).sendWelcomeEmail(params);
  },

  async sendEmailVerification(
    params: Parameters<EmailService['sendEmailVerification']>[0]
  ) {
    return (await getEmailService()).sendEmailVerification(params);
  },

  async sendPasswordResetEmail(
    params: Parameters<EmailService['sendPasswordResetEmail']>[0]
  ) {
    return (await getEmailService()).sendPasswordResetEmail(params);
  },

  async sendDataDeletionConfirmation(
    params: Parameters<EmailService['sendDataDeletionConfirmation']>[0]
  ) {
    return (await getEmailService()).sendDataDeletionConfirmation(params);
  },

  async sendLinkBannedNotification(
    params: Parameters<EmailService['sendLinkBannedNotification']>[0]
  ) {
    return (await getEmailService()).sendLinkBannedNotification(params);
  },

  async sendQuotaWarning(
    params: Parameters<EmailService['sendQuotaWarning']>[0]
  ) {
    return (await getEmailService()).sendQuotaWarning(params);
  }
} satisfies EmailService;
