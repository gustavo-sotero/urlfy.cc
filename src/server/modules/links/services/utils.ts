const ALLOWED_FIELDS = [
  'id',
  'shortCode',
  'shortUrl',
  'originalUrl',
  'redirectType',
  'clicksCount',
  'maxClicks',
  'isActive',
  'isBanned',
  'bannedReason',
  'isProtected',
  'expiresAt',
  'metaTitle',
  'metaDescription',
  'metaImage',
  'utmSource',
  'utmMedium',
  'utmCampaign',
  'tags',
  'notes',
  'lastClickedAt',
  'createdAt',
  'updatedAt'
] as const;

export function filterFields<T extends object>(
  item: T,
  fields?: string
): Partial<T> {
  if (!fields) return item;
  const requested = fields.split(',').map((f) => f.trim());
  const valid = requested.filter((f) =>
    ALLOWED_FIELDS.includes(f as (typeof ALLOWED_FIELDS)[number])
  );
  if (valid.length === 0) return item;

  const result: Partial<T> = {};
  for (const key of valid) {
    if (key in item) {
      const typedKey = key as keyof T;
      result[typedKey] = item[typedKey];
    }
  }
  return result;
}
