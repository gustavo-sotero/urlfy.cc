import {
  DataDeletionConfirmationEmail,
  EmailVerificationEmail,
  LinkBannedEmail,
  PasswordResetEmail,
  QuotaWarningEmail,
  WelcomeEmail
} from '@/emails/components';
import { sendEmail } from '@/server/lib/email';

/**
 * Serviço de envio de emails transacionais usando templates React
 */
export const emailService = {
  /**
   * Envia email de boas-vindas para novos usuários
   */
  async sendWelcomeEmail(params: {
    to: string;
    firstName: string;
    email: string;
  }) {
    return sendEmail({
      to: params.to,
      subject: `Bem-vindo ao urlfy.cc, ${params.firstName}! 🎉`,
      react: WelcomeEmail({
        firstName: params.firstName,
        email: params.email
      })
    });
  },

  /**
   * Envia email de verificação de endereço de email
   */
  async sendEmailVerification(params: {
    to: string;
    firstName: string;
    verificationUrl: string;
    expiresInMinutes?: number;
  }) {
    return sendEmail({
      to: params.to,
      subject: 'Confirme seu email - urlfy.cc',
      react: EmailVerificationEmail({
        firstName: params.firstName,
        verificationUrl: params.verificationUrl,
        expiresInMinutes: params.expiresInMinutes
      })
    });
  },

  /**
   * Envia email de redefinição de senha
   */
  async sendPasswordResetEmail(params: {
    to: string;
    firstName: string;
    resetUrl: string;
    expiresInMinutes?: number;
  }) {
    return sendEmail({
      to: params.to,
      subject: 'Redefinir sua senha - urlfy.cc',
      react: PasswordResetEmail({
        firstName: params.firstName,
        resetUrl: params.resetUrl,
        expiresInMinutes: params.expiresInMinutes
      })
    });
  },

  /**
   * Envia confirmação de solicitação de exclusão de dados (LGPD)
   */
  async sendDataDeletionConfirmation(params: {
    to: string;
    firstName: string;
    requestDate: Date;
    deadlineDate: Date;
    exportUrl?: string;
  }) {
    return sendEmail({
      to: params.to,
      subject: 'Solicitação de Exclusão de Dados Recebida',
      react: DataDeletionConfirmationEmail({
        firstName: params.firstName,
        requestDate: params.requestDate,
        deadlineDate: params.deadlineDate,
        exportUrl: params.exportUrl
      })
    });
  },

  /**
   * Notifica usuário sobre link banido
   */
  async sendLinkBannedNotification(params: {
    to: string;
    firstName: string;
    linkUrl: string;
    shortCode: string;
    bannedReason: string;
    bannedAt: Date;
    appealUrl: string;
  }) {
    return sendEmail({
      to: params.to,
      subject: '⚠️ Link Bloqueado - Ação Necessária',
      react: LinkBannedEmail({
        firstName: params.firstName,
        linkUrl: params.linkUrl,
        shortCode: params.shortCode,
        bannedReason: params.bannedReason,
        bannedAt: params.bannedAt,
        appealUrl: params.appealUrl
      })
    });
  },

  /**
   * Alerta sobre quota próxima do limite
   */
  async sendQuotaWarning(params: {
    to: string;
    firstName: string;
    currentUsage: number;
    quotaLimit: number;
    percentUsed: number;
    upgradeUrl: string;
  }) {
    return sendEmail({
      to: params.to,
      subject: `⚠️ Você está usando ${params.percentUsed.toFixed(0)}% da sua quota`,
      react: QuotaWarningEmail({
        firstName: params.firstName,
        currentUsage: params.currentUsage,
        quotaLimit: params.quotaLimit,
        percentUsed: params.percentUsed,
        upgradeUrl: params.upgradeUrl
      })
    });
  }
};
