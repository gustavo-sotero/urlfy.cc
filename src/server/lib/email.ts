import nodemailer from 'nodemailer';

export interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  template?: string;
  data?: Record<string, unknown>;
}

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT
    ? Number.parseInt(process.env.SMTP_PORT, 10)
    : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP configuration is missing');
    }
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });

  return cachedTransporter;
}

function buildFallbackText(options: SendEmailOptions): string {
  if (options.text) return options.text;

  if (options.template) {
    const payload = options.data ? JSON.stringify(options.data, null, 2) : '';
    return `Template: ${options.template}\n\n${payload}`.trim();
  }

  return '';
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const from = process.env.SMTP_FROM;

  if (!from) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP_FROM is required');
    }
    console.warn('SMTP_FROM is not set. Email skipped.');
    return;
  }

  const transporter = getTransporter();
  if (!transporter) {
    console.warn('SMTP is not configured. Email skipped.');
    return;
  }

  await transporter.sendMail({
    from,
    to: options.to,
    subject: options.subject,
    text: buildFallbackText(options),
    html: options.html
  });
}
