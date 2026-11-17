import { redactDeep } from './redact.js';
import { isProviderId } from './providers.js';
import { parseToolDefinitions } from './mockTools.js';
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
  const system = out.config.system;
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

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const hasOptionalString = (obj: Record<string, unknown>, key: string) => obj[key] === undefined || typeof obj[key] === 'string';
const hasOptionalNumber = (obj: Record<string, unknown>, key: string) => obj[key] === undefined || isFiniteNumber(obj[key]);

function isUsage(value: unknown): boolean {
  return isRecord(value) && isFiniteNumber(value.inputTokens) && isFiniteNumber(value.outputTokens);
}

function isHttpExchange(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.request)) return false;
  const request = value.request;
  if (typeof request.url !== 'string' || typeof request.method !== 'string' || !isRecord(request.headers)) return false;
  if (Object.values(request.headers).some((header) => typeof header !== 'string')) return false;
  if (!Object.hasOwn(request, 'body')) return false;
  if (value.response === undefined) return true;
  return isRecord(value.response) && isFiniteNumber(value.response.status) && Object.hasOwn(value.response, 'body');
}

function isTraceStep(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (
    typeof value.id !== 'string' ||
    !['model', 'tool', 'system', 'validation'].includes(value.type as string) ||
    !isFiniteNumber(value.startedAt) ||
    !isFiniteNumber(value.endedAt) ||
    !Object.hasOwn(value, 'input') ||
    !Object.hasOwn(value, 'output') ||
    typeof value.label !== 'string' ||
    !isFiniteNumber(value.latencyMs)
  )
    return false;
  if (value.usage !== undefined && !isUsage(value.usage)) return false;
  if (value.costUsd !== undefined && value.costUsd !== null && !isFiniteNumber(value.costUsd)) return false;
  if (value.http !== undefined && !isHttpExchange(value.http)) return false;
  if (value.error !== undefined) {
    if (
      !isRecord(value.error) ||
      !['provider', 'network', 'validation', 'tool', 'config'].includes(value.error.source as string) ||
      typeof value.error.message !== 'string' ||
      !hasOptionalNumber(value.error, 'status') ||
      !hasOptionalString(value.error, 'code')
    )
      return false;
  }
  return true;
}

export function validateRun(data: unknown): Run {
  const r = data as Partial<Run> | null;
  const problems: string[] = [];
  if (!isRecord(r)) throw new Error('Run must be an object');
  if (r.schema !== 'runtime-lab/run@1') problems.push('schema must be "runtime-lab/run@1"');
  if (typeof r.id !== 'string' || !r.id) problems.push('id must be a non-empty string');
  if (typeof r.createdAt !== 'string' || !Number.isFinite(Date.parse(r.createdAt))) problems.push('createdAt must be a valid date string');
  if (!hasOptionalString(r, 'title') || !hasOptionalString(r, 'projectId') || !hasOptionalString(r, 'experimentId') || !hasOptionalString(r, 'notes') || !hasOptionalString(r, 'source'))
    problems.push('optional run metadata fields must be strings');
  if (!isRecord(r.config)) problems.push('config must be an object');
  else {
    const config = r.config;
    if (!isProviderId(config.provider)) problems.push('config.provider must be a known provider');
    if (typeof config.model !== 'string' || !config.model) problems.push('config.model is required');
    if (config.system !== undefined && typeof config.system !== 'string') problems.push('config.system must be a string');
    if (
      !Array.isArray(config.messages) ||
      config.messages.some((message) => !isRecord(message) || !['user', 'assistant'].includes(message.role as string) || typeof message.content !== 'string')
    )
      problems.push('config.messages must contain user or assistant messages with string content');
    for (const key of ['temperature', 'maxTokens', 'maxTurns']) {
      if (!hasOptionalNumber(config, key)) problems.push(`config.${key} must be a number`);
    }
    if (config.tools !== undefined) {
      const parsedTools = parseToolDefinitions(JSON.stringify(config.tools));
      if (!Array.isArray(config.tools) || parsedTools.errors.length) problems.push('config.tools must contain valid tool definitions');
    }
  }
  if (!isRecord(r.trace)) problems.push('trace must be an object');
  else {
    const trace = r.trace;
    if (typeof trace.id !== 'string' || !trace.id) problems.push('trace.id must be a non-empty string');
    for (const key of ['startedAt', 'completedAt', 'totalLatencyMs', 'totalTokens', 'inputTokens', 'outputTokens']) {
      if (!isFiniteNumber(trace[key])) problems.push(`trace.${key} must be a number`);
    }
    if (trace.costUsd !== null && !isFiniteNumber(trace.costUsd)) problems.push('trace.costUsd must be a number or null');
    if (trace.status !== 'ok' && trace.status !== 'error') problems.push('trace.status must be "ok" or "error"');
    if (typeof trace.output !== 'string') problems.push('trace.output must be a string');
    if (!Array.isArray(trace.steps)) problems.push('trace.steps must be an array');
    else trace.steps.forEach((step, i) => {
      if (!isTraceStep(step)) problems.push(`trace.steps[${i}] is invalid`);
    });
  }
  if (problems.length) throw new Error(`Invalid run file: ${problems.join('; ')}`);
  return r as Run;
}
