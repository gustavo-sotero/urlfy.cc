const URL_BASE = 'https://urlfy.cc';

export const postSignupVerificationParam = 'verificationEmail';
export const postSignupVerificationSentValue = 'sent';

type SearchParamsReader = {
  get(name: string): string | null;
};

function toRelativePath(url: URL): string {
  return `${url.pathname}${url.search}`;
}

function buildLocalizedDashboardPath(locale: string): string {
  return `/${locale}/dashboard`;
}

function toAppUrl(pathOrUrl: string): URL | null {
  try {
    return new URL(pathOrUrl, URL_BASE);
  } catch {
    return null;
  }
}

export function buildLocalizedDashboardUrl(
  origin: string,
  locale: string
): string {
  const normalizedOrigin = new URL(origin).origin;

  return new URL(
    buildLocalizedDashboardPath(locale),
    normalizedOrigin
  ).toString();
}

export function buildPostLoginCallbackPath(
  locale: string,
  rawCallbackUrl?: string | null
): string {
  const fallbackUrl = new URL(buildLocalizedDashboardPath(locale), URL_BASE);

  if (!rawCallbackUrl) {
    return toRelativePath(fallbackUrl);
  }

  const callbackUrl = toAppUrl(rawCallbackUrl);

  if (!callbackUrl || callbackUrl.origin !== fallbackUrl.origin) {
    return toRelativePath(fallbackUrl);
  }

  if (
    callbackUrl.pathname === '/dashboard' ||
    callbackUrl.pathname.startsWith('/dashboard/')
  ) {
    callbackUrl.pathname = `${buildLocalizedDashboardPath(locale)}${callbackUrl.pathname.slice('/dashboard'.length)}`;
  }

  return toRelativePath(callbackUrl);
}

export function buildPostLoginCallbackUrl(
  origin: string,
  locale: string,
  rawCallbackUrl?: string | null
): string {
  const normalizedOrigin = new URL(origin).origin;
  return new URL(
    buildPostLoginCallbackPath(locale, rawCallbackUrl),
    normalizedOrigin
  ).toString();
}

export function buildPostSignupDashboardPath(): string {
  const searchParams = new URLSearchParams({
    [postSignupVerificationParam]: postSignupVerificationSentValue
  });

  return `/dashboard?${searchParams.toString()}`;
}

export function isPostSignupVerificationSent(
  searchParams: SearchParamsReader
): boolean {
  return (
    searchParams.get(postSignupVerificationParam) ===
    postSignupVerificationSentValue
  );
}

export function buildEmailVerificationResultPath(locale: string): string {
  const resultUrl = new URL(`/${locale}/email-verification`, URL_BASE);
  resultUrl.searchParams.set('verified', '1');
  return toRelativePath(resultUrl);
}

export function buildEmailVerificationCallbackUrl(
  origin: string,
  locale: string
): string {
  const normalizedOrigin = new URL(origin).origin;
  return new URL(
    buildEmailVerificationResultPath(locale),
    normalizedOrigin
  ).toString();
}

export function buildPostVerificationLoginPath(locale: string): string {
  const loginUrl = new URL(`/${locale}/login`, URL_BASE);
  loginUrl.searchParams.set('callbackUrl', buildPostLoginCallbackPath(locale));
  return toRelativePath(loginUrl);
}
