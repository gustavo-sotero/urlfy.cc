import { headers } from 'next/headers';
import { getServerSession } from '@/lib/server-session';
import { SettingsPageClient } from './_client';

export default async function SettingsPage() {
  const requestHeaders = await headers();
  const session = await getServerSession({
    headers: requestHeaders,
    disableCookieCache: true
  });

  return <SettingsPageClient initialSession={session} />;
}
