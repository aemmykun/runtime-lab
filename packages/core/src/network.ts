import { ALLOWED_ORIGINS } from './providers.js';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class BlockedRequestError extends Error {
  constructor(public readonly url: string) {
    super(`Blocked request to ${url}: only provider APIs are allowed`);
    this.name = 'BlockedRequestError';
  }
}

export function isAllowedUrl(url: string, allowed: readonly string[] = ALLOWED_ORIGINS): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  return allowed.includes(u.origin);
}

/**
 * Wraps fetch so it refuses anything that is not a provider API. This is
 * defence in depth on top of the Content-Security-Policy connect-src.
 */
export function guardedFetch(inner: FetchLike, allowed: readonly string[] = ALLOWED_ORIGINS): FetchLike {
  return (input, init) => {
    if (!isAllowedUrl(input, allowed)) return Promise.reject(new BlockedRequestError(input));
    return inner(input, init);
  };
}
