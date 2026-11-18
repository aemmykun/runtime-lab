import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { ALLOWED_ORIGINS, BlockedRequestError } from '@runtime-lab/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyCsp, hoistThemeBoot, inlineScriptHashes } from '../scripts/postbuild';
import { CSP_PLACEHOLDER, buildCsp } from '~/lib/csp';
import { browserFetch, getBrowserAdapter } from '~/services/adapters';
import { runDraft } from '~/services/trace-engine';
import { useSessionStore } from '~/stores/session-store';
import { FAKE_KEY, freshDb, spyFetch } from './helpers';

const ROOT = join(__dirname, '..', '..', '..');
// Always compare repo-relative paths with forward slashes, so the checks behave the same on Windows.
const rel = (f: string) => relative(ROOT, f).split(sep).join('/');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === 'node_modules' || f === 'dist' ? [] : walk(p);
    return /\.(ts|tsx)$/.test(f) && !f.endsWith('.gen.ts') ? [p] : [];
  });
}

describe('Content-Security-Policy', () => {
  const csp = buildCsp(['abc=']);
  const directive = (name: string) => csp.split('; ').find((d) => d.startsWith(`${name} `))!.split(' ').slice(1);

  it('connect-src is exactly the provider allow-list (no self, no wildcards)', () => {
    expect(directive('connect-src')).toEqual([...ALLOWED_ORIGINS]);
    expect(csp).not.toContain('*');
  });
  it('forbids eval and inline scripts other than hashed bootstrap', () => {
    expect(directive('script-src')).toEqual(["'self'", "'sha256-abc='"]);
    expect(csp).not.toContain('unsafe-eval');
    expect(directive('default-src')).toEqual(["'none'"]);
    expect(directive('form-action')).toEqual(["'none'"]);
  });
  it('postbuild hashes inline scripts and fills the placeholder', () => {
    const html = `<head><meta http-equiv="Content-Security-Policy" content="${CSP_PLACEHOLDER}"/></head><body><script>console.log(1)</script><script type="module" src="/a.js"></script></body>`;
    expect(inlineScriptHashes(html)).toEqual(['CihokcEcBW4atb/CW/XWsvWwbTjqwQlE9nj9ii5ww5M=']);
    const out = applyCsp(html);
    expect(out).toContain("'sha256-CihokcEcBW4atb/CW/XWsvWwbTjqwQlE9nj9ii5ww5M='");
    expect(out).not.toContain(CSP_PLACEHOLDER);
    expect(() => applyCsp('<html></html>')).toThrow(/placeholder/);
  });
  it('hoists the theme boot script to the start of head', () => {
    const html = '<html><head><link rel="stylesheet" href="/styles.css"/><script src="/theme-boot.js"></script></head></html>';
    const out = hoistThemeBoot(html);
    expect(out.indexOf('<script src="/theme-boot.js"></script>')).toBeLessThan(out.indexOf('rel="stylesheet"'));
    expect(out.match(/theme-boot\.js/g)).toHaveLength(1);
    expect(() => hoistThemeBoot('<html><head></head></html>')).toThrow(/theme-boot/);
  });
});

describe('no network calls except to provider hosts', () => {
  beforeEach(freshDb);

  it('a full traced run in the app only contacts the configured provider', async () => {
    const { fetch, urls } = spyFetch();
    useSessionStore.getState().setKey('openai', FAKE_KEY);
    const run = await runDraft(fetch);
    expect(run?.trace.status).toBe('ok');
    expect(urls).toEqual(['https://api.openai.com/v1/chat/completions', 'https://api.openai.com/v1/chat/completions']);
  });

  it('the browser fetch guard refuses any non-provider host', async () => {
    const { fetch, urls } = spyFetch();
    const guarded = browserFetch(fetch);
    await expect(guarded('https://analytics.example.com/collect')).rejects.toBeInstanceOf(BlockedRequestError);
    await expect(guarded('https://api.openai.com.attacker.example/v1')).rejects.toBeInstanceOf(BlockedRequestError);
    expect(urls).toEqual([]);
    const a = getBrowserAdapter('openai', FAKE_KEY, fetch);
    expect(a.id).toBe('openai');
  });

  it('source code has exactly one network entry point and no beacons/sockets/XHR', () => {
    const files = [...walk(join(ROOT, 'apps/web/src')), ...walk(join(ROOT, 'packages/core/src'))];
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      const r = rel(f);
      if (/XMLHttpRequest|WebSocket|sendBeacon|EventSource|importScripts|new Worker\(/.test(src)) offenders.push(`${r}: forbidden API`);
      const fetchUses = src.match(/\bglobalThis\.fetch\b|\bwindow\.fetch\b|(?<![.\w])fetch\(/g) ?? [];
      if (fetchUses.length && r !== 'apps/web/src/services/adapters/index.ts') offenders.push(`${r}: direct fetch`);
    }
    expect(offenders).toEqual([]);
  });

  it('every hard-coded http(s) URL in app code is a provider API or a plain navigation link', () => {
    const allowedPrefixes = [
      ...ALLOWED_ORIGINS,
      'https://github.com/aemmykun/runtime-lab',
      'https://github.com/sponsors/aemmykun',
      'https://tenantsage.org',
      'http://www.w3.org/2000/svg',
    ];
    const files = [...walk(join(ROOT, 'apps/web/src')), ...walk(join(ROOT, 'packages/core/src'))];
    const bad: string[] = [];
    for (const f of files) {
      const code = readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      for (const m of code.matchAll(/https?:\/\/[^\s'"`)<>]+/g)) {
        if (!allowedPrefixes.some((p) => m[0].startsWith(p))) bad.push(`${rel(f)}: ${m[0]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
