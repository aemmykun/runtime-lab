/**
 * Post-build step for the static SPA:
 *  1. Hashes every inline <script> in the prerendered shell (TanStack Start
 *     bootstrap) and writes the final Content-Security-Policy into the shell.
 *  2. Removes the unused SSR bundle so only static files remain in dist/client.
 */
import { createHash } from 'node:crypto';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildCsp, CSP_PLACEHOLDER } from '../src/lib/csp.ts';

export function inlineScriptHashes(html: string): string[] {
  const hashes: string[] = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    if (m[1]) hashes.push(createHash('sha256').update(m[1], 'utf8').digest('base64'));
  }
  return hashes;
}

export function applyCsp(html: string): string {
  if (!html.includes(CSP_PLACEHOLDER)) throw new Error('CSP placeholder not found in shell HTML');
  return html.replace(CSP_PLACEHOLDER, buildCsp(inlineScriptHashes(html)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = new URL('../dist/client/index.html', import.meta.url);
  const html = readFileSync(file, 'utf8');
  writeFileSync(file, applyCsp(html));
  rmSync(new URL('../dist/server', import.meta.url), { recursive: true, force: true });
  console.log(`postbuild: CSP written with ${inlineScriptHashes(html).length} inline script hash(es); dist/client is the static site.`);
}
