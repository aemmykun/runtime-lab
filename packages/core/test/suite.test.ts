import { describe, expect, it } from 'vitest';
import { createAdapter } from '../src/adapters.js';
import { parseSuite, runSuite } from '../src/suite.js';
import { DEFAULT_PRICE_TABLE } from '../src/prices.js';
import { openaiText, scriptedFetch } from './helpers.js';
import { parseToolDefinitions, runMock } from '../src/mockTools.js';

const suiteJson = JSON.stringify({
  schema: 'runtime-lab/suite@1',
  name: 'smoke',
  defaults: { provider: 'openai', model: 'gpt-5-mini' },
  tests: [
    { name: 'greets', prompt: 'say hi', assertions: [{ type: 'contains', value: 'hi' }] },
    { name: 'json', prompt: 'json please', assertions: [{ type: 'json-schema', schema: { type: 'object', required: ['a'] } }] },
  ],
});

describe('suites', () => {
  it('parses and reports precise validation errors', () => {
    expect(parseSuite(suiteJson).tests).toHaveLength(2);
    expect(() => parseSuite('{')).toThrow(/not valid JSON/);
    expect(() => parseSuite(JSON.stringify({ name: 'x', tests: [{ name: 't', prompt: 'p', assertions: [{ type: 'bogus' }] }] }))).toThrow(
      /provider must be set[\s\S]*model must be set[\s\S]*"bogus" is not supported/,
    );
  });

  it('validates assertion payloads before running tests', () => {
    for (const assertion of [
      { type: 'regex' },
      { type: 'contains' },
      { type: 'max-cost', usd: '1' },
      { type: 'json-schema', schema: [] },
    ]) {
      const invalid = { name: 'invalid', defaults: { provider: 'openai', model: 'm' }, tests: [{ name: 't', prompt: 'p', assertions: [assertion] }] };
      expect(() => parseSuite(JSON.stringify(invalid))).toThrow(/assertions\[0\]/);
    }
  });

  it('rejects malformed mock cases and missing results', () => {
    const tool = (mock: unknown) => JSON.stringify([{ name: 'tool', parameters: { type: 'object' }, mock }]);
    expect(parseToolDefinitions(tool({ type: 'match', cases: [{}] })).errors).toContain('tools[0].mock.cases[0].when must be an object');
    expect(parseToolDefinitions(tool({ type: 'static' })).errors).toContain('tools[0].mock.result is required');
    expect(parseToolDefinitions(tool({ type: 'match', cases: [{ when: {}, result: null }] })).errors).toEqual([]);
  });

  it('matches nested mock arguments regardless of object key order', () => {
    const result = runMock(
      { type: 'match', cases: [{ when: { nested: { a: 1, b: [2, 3] } }, result: 'matched' }] },
      { nested: { b: [2, 3], a: 1 } },
    );
    expect(result).toEqual({ ok: true, result: 'matched' });
  });

  it('runs every test and counts passes and failures', async () => {
    const { fetch } = scriptedFetch([{ body: openaiText('hi there') }, { body: openaiText('not json') }]);
    const res = await runSuite(parseSuite(suiteJson), { getAdapter: (p) => createAdapter(p, { apiKey: 'k-test', fetch }), priceTable: DEFAULT_PRICE_TABLE, sleep: async () => {} });
    expect(res.passed).toBe(1);
    expect(res.failed).toBe(1);
    expect(res.results[1]!.assertions[0]!.message).toMatch(/not valid JSON/);
  });

  it('a failed run fails the test even when assertions would pass', async () => {
    const { fetch } = scriptedFetch([{ status: 500, body: { error: { message: 'boom' } } }]);
    const suite = parseSuite(JSON.stringify({ name: 's', defaults: { provider: 'openai', model: 'm' }, tests: [{ name: 't', prompt: 'p', assertions: [{ type: 'not-contains', value: 'x' }] }] }));
    const res = await runSuite(suite, { getAdapter: (p) => createAdapter(p, { apiKey: 'k-test', fetch }), priceTable: DEFAULT_PRICE_TABLE });
    expect(res.failed).toBe(1);
    expect(res.results[0]!.assertions[0]!.message).toBe('run failed: boom');
  });
});
