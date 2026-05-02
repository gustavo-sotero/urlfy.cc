export const ALIAS_MIN_LENGTH = 3;
export const ALIAS_MAX_LENGTH = 20;
export const ALIAS_PATTERN = '[a-zA-Z0-9][a-zA-Z0-9-]{1,18}[a-zA-Z0-9]';
export const ALIAS_REGEX = new RegExp(`^${ALIAS_PATTERN}$`);
export const ALIAS_PATH_SEGMENT_REGEX = new RegExp(`^/${ALIAS_PATTERN}/?$`);
export const ALIAS_REDIRECT_PATH_REGEX = new RegExp(`^/r/${ALIAS_PATTERN}/?$`);

export function isAliasFormat(value: string): boolean {
  return ALIAS_REGEX.test(value);
}
