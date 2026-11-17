import { describe, expect, it } from 'vitest';
import { evaluateAssertion } from '../src/assertions.js';
import { SAMPLE_RUN } from '../src/sample.js';
import type { Run } from '../src/types.js';

const withOutput = (output: string): Run => ({ ...SAMPLE_RUN, trace: { ...SAMPLE_RUN.trace, output } });

describe('assertions', () => {
  it('contains / not-contains (case-insensitive by default)', () => {
    expect(evaluateAssertion({ type: 'contains', value: 'auspost' }, SAMPLE_RUN).pass).toBe(true);
    expect(evaluateAssertion({ type: 'contains', value: 'auspost', caseSensitive: true }, SAMPLE_RUN).pass).toBe(false);
    expect(evaluateAssertion({ type: 'not-contains', value: 'refund' }, SAMPLE_RUN).pass).toBe(true);
  });
  it('regex, including invalid patterns', () => {
    expect(evaluateAssertion({ type: 'regex', pattern: 'ORD-\\d{4}' }, SAMPLE_RUN).pass).toBe(true);
    const bad = evaluateAssertion({ type: 'regex', pattern: '(' }, SAMPLE_RUN);
    expect(bad.pass).toBe(false);
    expect(bad.message).toMatch(/invalid regex/);
  });
  it('json-schema', () => {
    const schema = { type: 'object' as const, required: ['ok'], properties: { ok: { type: 'boolean' as const } } };
    expect(evaluateAssertion({ type: 'json-schema', schema }, withOutput('{"ok":true}')).pass).toBe(true);
    expect(evaluateAssertion({ type: 'json-schema', schema }, withOutput('{"ok":1}')).message).toMatch(/\$\.ok expected boolean/);
    expect(evaluateAssertion({ type: 'json-schema', schema }, withOutput('nope')).message).toMatch(/not valid JSON/);
  });
  it('max-latency, max-tokens, max-cost, tool-called, no-errors', () => {
    expect(evaluateAssertion({ type: 'max-latency', ms: 10_000 }, SAMPLE_RUN).pass).toBe(true);
    expect(evaluateAssertion({ type: 'max-latency', ms: 100 }, SAMPLE_RUN).pass).toBe(false);
    expect(evaluateAssertion({ type: 'max-tokens', tokens: 10 }, SAMPLE_RUN).pass).toBe(false);
    expect(evaluateAssertion({ type: 'max-cost', usd: 1 }, SAMPLE_RUN).pass).toBe(true);
    expect(evaluateAssertion({ type: 'max-cost', usd: 1 }, { ...SAMPLE_RUN, trace: { ...SAMPLE_RUN.trace, costUsd: null } }).pass).toBe(false);
    expect(evaluateAssertion({ type: 'tool-called', name: 'get_order_status' }, SAMPLE_RUN).pass).toBe(true);
    expect(evaluateAssertion({ type: 'tool-called', name: 'refund' }, SAMPLE_RUN).pass).toBe(false);
    expect(evaluateAssertion({ type: 'no-errors' }, SAMPLE_RUN).pass).toBe(false); // the sample has a validation error
  });
});
