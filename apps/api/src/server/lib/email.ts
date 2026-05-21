// Thin shim - canonical implementation lives in @urlfy/email.
export type { SendEmailOptions } from '@urlfy/email/transport';

let emailTransportPromise: Promise<
  typeof import('@urlfy/email/transport')
> | null = null;

function getEmailTransport() {
  emailTransportPromise ??= import('@urlfy/email/transport');
  return emailTransportPromise;
}

export async function sendEmail(
  options: import('@urlfy/email/transport').SendEmailOptions
): Promise<void> {
  const { sendEmail: sendCanonicalEmail } = await getEmailTransport();
  return sendCanonicalEmail(options);
}
