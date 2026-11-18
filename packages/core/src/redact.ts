export const REDACTED = '[REDACTED]';

/** Header names whose values are always secret. */
const SECRET_HEADER = /^(authorization|proxy-authorization|x-api-key|api-key|cookie|set-cookie)$|key|token|secret/i;

/**
 * Patterns for well-known API key shapes, so a key pasted into a prompt or
 * echoed back by a provider error is also scrubbed.
 */
export const KEY_PATTERNS: RegExp[] = [
  /sk-ant-[A-Za-z0-9_-]{8,}/g,
  /sk-or-[A-Za-z0-9_-]{8,}/g,
  /sk-proj-[A-Za-z0-9_-]{8,}/g,
  /sk-[A-Za-z0-9_-]{16,}/g,
  /Bearer\s+[A-Za-z0-9._~+/=-]{8,}/g,
];

export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = SECRET_HEADER.test(k) ? REDACTED : redactString(v, []);
  }
  return out;
}

export function redactString(input: string, secrets: readonly string[]): string {
  let s = input;
  for (const secret of secrets) {
    if (secret && secret.length >= 4) s = s.split(secret).join(REDACTED);
  }
  for (const re of KEY_PATTERNS) s = s.replace(re, REDACTED);
  return s;
}

/** Deep-copies a JSON-like value, replacing secret values and key-shaped strings. */
export function redactDeep<T>(value: T, secrets: readonly string[] = []): T {
  const walk = (v: unknown, key?: string): unknown => {
    if (typeof v === 'string') {
      if (key !== undefined && /^(api[_-]?key|apikey|authorization|x-api-key|secret|password|token)$/i.test(key)) return REDACTED;
      return redactString(v, secrets);
    }
    if (Array.isArray(v)) return v.map((x) => walk(x));
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [redactString(k, secrets), walk(x, k)]));
    }
    return v;
  };
  return walk(value) as T;
}

/** True if any of the given secrets (or a key-shaped string) appears in the text. */
export function containsSecret(text: string, secrets: readonly string[]): boolean {
  if (secrets.some((s) => s && s.length >= 4 && text.includes(s))) return true;
  return KEY_PATTERNS.some((re) => {
    re.lastIndex = 0;
    const hit = re.test(text);
    re.lastIndex = 0;
    return hit;
  });
}
