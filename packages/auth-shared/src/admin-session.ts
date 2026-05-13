const HOUR_IN_MS = 60 * 60 * 1000;

export const ADMIN_SESSION_MAX_AGE_MS = HOUR_IN_MS / 2;
export const ADMIN_ELEVATION_LOGIN_METHOD = 'github' as const;
export const ADMIN_ELEVATION_PROVIDER = 'github' as const;

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

export function hasRequiredAdminLoginMethod(
  lastLoginMethod: string | null | undefined
): boolean {
  return lastLoginMethod === ADMIN_ELEVATION_LOGIN_METHOD;
}

export function isAdminSessionElevated({
  createdAt,
  lastLoginMethod,
  now = new Date()
}: {
  createdAt: Date | string;
  lastLoginMethod: string | null | undefined;
  now?: Date;
}): boolean {
  if (!isAdminSessionFresh(createdAt, now)) return false;

  return hasRequiredAdminLoginMethod(lastLoginMethod);
}

export function getAdminElevationExpiresAt(
  elevatedAt: Date = new Date()
): Date {
  return new Date(elevatedAt.getTime() + ADMIN_SESSION_MAX_AGE_MS);
}

export function isAdminElevationClaimValid({
  provider,
  expiresAt,
  now = new Date()
}: {
  provider: string | null | undefined;
  expiresAt: Date | string | null | undefined;
  now?: Date;
}): boolean {
  if (provider !== ADMIN_ELEVATION_PROVIDER || !expiresAt) {
    return false;
  }

  return toTimestamp(expiresAt) > now.getTime();
}
