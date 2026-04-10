const URL_BASE = 'https://urlfy.cc';

function toRelativePath(url: URL): string {
  return `${url.pathname}${url.search}`;
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
  loginUrl.searchParams.set('callbackUrl', `/${locale}/dashboard`);
  return toRelativePath(loginUrl);
}
