import { ALLOWED_ORIGINS } from '@runtime-lab/core';

/**
 * Content-Security-Policy for the static build. connect-src lists ONLY the
 * provider APIs, so the browser itself refuses any other network call
 * (telemetry, analytics, a backend). The build step adds sha256 hashes for
 * the framework's inline bootstrap scripts to script-src.
 */
export function buildCsp(scriptHashes: string[] = []): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'none'"],
    'script-src': ["'self'", ...scriptHashes.map((h) => `'sha256-${h}'`)],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'"],
    'connect-src': [...ALLOWED_ORIGINS],
    'manifest-src': ["'self'"],
    'base-uri': ["'none'"],
    'form-action': ["'none'"],
    'object-src': ["'none'"],
    'worker-src': ["'none'"],
    'frame-src': ["'none'"],
  };
  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v.join(' ')}`)
    .join('; ');
}

/** Marker in the prerendered shell that the build replaces with buildCsp(hashes). */
export const CSP_PLACEHOLDER = '__RUNTIME_LAB_CSP__';
