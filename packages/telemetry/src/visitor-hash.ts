import { createHash } from 'node:crypto';

function getIsoWeekSalt(date: Date): string {
  const normalizedDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = normalizedDate.getUTCDay() || 7;
  normalizedDate.setUTCDate(normalizedDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(normalizedDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((normalizedDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );

  return `${normalizedDate.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function hashVisitorForAnalytics(
  ip: string | null,
  linkId: string,
  date: Date = new Date()
): string {
  const salt = getIsoWeekSalt(date);

  if (!ip || ip.trim() === '') {
    return createHash('sha256')
      .update(`anonymous:${linkId}:${salt}`)
      .digest('hex');
  }

  return createHash('sha256').update(`${ip}:${linkId}:${salt}`).digest('hex');
}
