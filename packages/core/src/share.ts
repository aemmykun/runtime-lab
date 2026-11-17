import { redactDeep } from './redact.js';
import type { Run } from './types.js';

export const SHARE_PARAM = 'share';
export const SYSTEM_REMOVED = '[system prompt removed]';
/** Above this, many chat apps and browsers truncate URLs. */
export const SHARE_URL_WARN_LENGTH = 8000;

export interface ShareOptions {
  includeSystemPrompt?: boolean;
  /** Include raw HTTP payloads (default false for links, to keep them short). */
  includeRawPayloads?: boolean;
  /** Extra secret values to scrub (e.g. the keys currently in memory). */
  secrets?: readonly string[];
}

function replaceStringDeep<T>(value: T, needle: string, replacement: string): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return needle && v.includes(needle) ? v.split(needle).join(replacement) : v;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value) as T;
}

/** Produces the copy of a run that is safe to share. Keys are always scrubbed. */
export function sanitizeRunForShare(run: Run, opts: ShareOptions = {}): Run {
  let out: Run = redactDeep(structuredClone(run), opts.secrets ?? []);
  const system = run.config.system;
  if (!opts.includeSystemPrompt && system) {
    out = replaceStringDeep(out, system, SYSTEM_REMOVED);
    out.config = { ...out.config, system: SYSTEM_REMOVED };
  }
  if (!opts.includeRawPayloads) {
    out.trace = { ...out.trace, steps: out.trace.steps.map(({ http: _http, ...rest }) => rest) };
  }
  delete out.notes;
  return out;
}

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Share links carry the run in the URL fragment, which browsers never send to a server. */
export function encodeShareLink(run: Run, baseUrl: string, opts: ShareOptions = {}): string {
  const payload = toBase64Url(JSON.stringify(sanitizeRunForShare(run, opts)));
  return `${baseUrl.split('#')[0]}#${SHARE_PARAM}=${payload}`;
}

export function decodeShareFragment(hash: string): Run {
  const h = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(h);
  const payload = params.get(SHARE_PARAM);
  if (!payload) throw new Error('No shared run in this link');
  let data: unknown;
  try {
    data = JSON.parse(fromBase64Url(payload));
  } catch {
    throw new Error('Shared run is corrupted or truncated');
  }
  return validateRun(data);
}

/** Export a run as a downloadable JSON document (raw payloads included, keys scrubbed). */
export function exportRunJson(run: Run, opts: ShareOptions = {}): string {
  return JSON.stringify(sanitizeRunForShare(run, { includeRawPayloads: true, includeSystemPrompt: true, ...opts }), null, 2);
}

export function importRunJson(json: string): Run {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (e) {
    throw new Error(`Not valid JSON: ${(e as Error).message}`, { cause: e });
  }
  return validateRun(data);
}

export function validateRun(data: unknown): Run {
  const r = data as Partial<Run>;
  const problems: string[] = [];
  if (!r || typeof r !== 'object') throw new Error('Run must be an object');
  if (r.schema !== 'runtime-lab/run@1') problems.push('schema must be "runtime-lab/run@1"');
  if (typeof r.id !== 'string') problems.push('id must be a string');
  if (!r.config || typeof r.config !== 'object' || typeof r.config.model !== 'string') problems.push('config.model is required');
  if (!r.trace || !Array.isArray(r.trace.steps)) problems.push('trace.steps must be an array');
  else
    r.trace.steps.forEach((s, i) => {
      if (!['model', 'tool', 'system', 'validation'].includes(s?.type)) problems.push(`trace.steps[${i}].type is invalid`);
    });
  if (problems.length) throw new Error(`Invalid run file: ${problems.join('; ')}`);
  return r as Run;
}
