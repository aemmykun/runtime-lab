import { describe, expect, it } from 'vitest';
import { REDACTED, containsSecret, redactDeep, redactHeaders, redactString } from '../src/redact.js';
import { TEST_KEY } from './helpers.js';

describe('redaction', () => {
  it('redacts secret headers by name', () => {
    const h = redactHeaders({ authorization: `Bearer ${TEST_KEY}`, 'x-api-key': 'abc', 'x-goog-api-key': 'g', 'content-type': 'application/json' });
    expect(h.authorization).toBe(REDACTED);
    expect(h['x-api-key']).toBe(REDACTED);
    expect(h['x-goog-api-key']).toBe(REDACTED);
    expect(h['content-type']).toBe('application/json');
  });

  it('scrubs known secrets and key-shaped strings anywhere in a value', () => {
    const v = redactDeep({ a: [`my key is ${TEST_KEY}`], b: { apiKey: 'plain', nested: 'sk-ant-api03-abcdefghijkl' }, n: 3 }, [TEST_KEY]);
    const s = JSON.stringify(v);
    expect(s).not.toContain(TEST_KEY);
    expect(s).not.toContain('sk-ant-api03');
    expect(v.b.apiKey).toBe(REDACTED);
    expect(v.n).toBe(3);
  });

  it('does not mutate the input', () => {
    const input = { k: TEST_KEY };
    redactDeep(input, [TEST_KEY]);
    expect(input.k).toBe(TEST_KEY);
  });

  it('detects secrets', () => {
    expect(containsSecret(`x ${TEST_KEY}`, [])).toBe(true);
    expect(containsSecret('hello world', ['nothere'])).toBe(false);
    expect(redactString('custom-secret-value', ['custom-secret-value'])).toBe(REDACTED);
  });
});
