import type { ReactElement } from 'react';
import { Resend } from 'resend';

export interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  react?: ReactElement;
  template?: string;
  data?: Record<string, unknown>;
}

let cachedResend: Resend | null = null;

function getResendClient(): Resend | null {
  if (cachedResend) return cachedResend;

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('RESEND_API_KEY is required');
    }
    return null;
  }

  cachedResend = new Resend(apiKey);

  return cachedResend;
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const from = process.env.RESEND_FROM;

  if (!from) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('RESEND_FROM is required');
    }
    console.warn('RESEND_FROM is not set. Email skipped.');
    return;
  }

  const resend = getResendClient();
  if (!resend) {
    console.warn('Resend is not configured. Email skipped.');
    return;
  }

  const { error } = await resend.emails.send({
    from,
    to: options.to,
    subject: options.subject,
    react: options.react
  });

  if (error) {
    throw new Error(error.message);
  }
}
