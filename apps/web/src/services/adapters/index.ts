import { ALLOWED_ORIGINS, PROVIDERS, createAdapter, guardedFetch, type FetchLike, type ProviderAdapter, type ProviderId } from '@runtime-lab/core';

export { PROVIDERS, PROVIDER_IDS, type ProviderInfo } from '@runtime-lab/core';

/**
 * The ONLY fetch the app uses. It goes straight from the browser to the
 * provider and refuses every other host (the CSP enforces the same rule).
 */
export function browserFetch(inner: FetchLike = (u, i) => globalThis.fetch(u, i)): FetchLike {
  return guardedFetch(inner, ALLOWED_ORIGINS);
}

export function getBrowserAdapter(provider: ProviderId, apiKey: string | undefined, inner?: FetchLike): ProviderAdapter {
  return createAdapter(provider, { apiKey: apiKey || undefined, fetch: browserFetch(inner) });
}

export const providerOptions = () => Object.values(PROVIDERS);
