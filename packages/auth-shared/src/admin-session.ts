const HOUR_IN_MS = 60 * 60 * 1000;

export const ADMIN_SESSION_MAX_AGE_MS = 4 * HOUR_IN_MS;

function toTimestamp(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

export function getAdminSessionAgeMs(
  createdAt: Date | string,
  now: Date = new Date()
): number {
  return now.getTime() - toTimestamp(createdAt);
}

export function isAdminSessionFresh(
  createdAt: Date | string,
  now: Date = new Date()
): boolean {
  return getAdminSessionAgeMs(createdAt, now) <= ADMIN_SESSION_MAX_AGE_MS;
}
