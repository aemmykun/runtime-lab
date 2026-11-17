import { describe, expect, it } from 'vitest';
import { createAdapter } from '../src/adapters.js';
import { executeRun } from '../src/traceEngine.js';
import type { RunConfig, ToolDefinition } from '../src/types.js';
import { TEST_KEY, fakeClock, openaiText, openaiToolCall, scriptedFetch } from './helpers.js';

const priceTable = { note: '', prices: { 'openai:m': { inputPerMTok: 1, outputPerMTok: 2 } } };
const weather: ToolDefinition = {
  name: 'weather',
  parameters: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'], additionalProperties: false },
  mock: { type: 'match', cases: [{ when: { city: 'Melbourne' }, result: { tempC: 21 } }] },
};
const base: RunConfig = { provider: 'openai', model: 'm', system: 'be brief', messages: [{ role: 'user', content: 'weather?' }], tools: [weather] };
const noSleep = async () => {};

async function run(responses: Parameters<typeof scriptedFetch>[0], config: RunConfig = base) {
  const { fetch, calls } = scriptedFetch(responses);
  const r = await executeRun(config, { adapter: createAdapter(config.provider, { apiKey: TEST_KEY, fetch, now: fakeClock(0, 50) }), priceTable, now: fakeClock(), sleep: noSleep });
  return { r, calls };
}

describe('executeRun', () => {
  it('records system, model and tool steps and feeds tool results back', async () => {
    const { r, calls } = await run([{ body: openaiToolCall('weather', '{"city":"Melbourne"}') }, { body: openaiText('21C') }]);
    expect(r.trace.status).toBe('ok');
    expect(r.trace.output).toBe('21C');
    expect(r.trace.steps.map((s) => s.type)).toEqual(['system', 'model', 'tool', 'model']);
    const tool = r.trace.steps[2]!;
    expect(tool.output).toEqual({ tempC: 21 });
    const second = calls[1]!.body as { messages: Array<{ role: string; content: string }> };
    expect(second.messages.at(-1)).toEqual({ role: 'tool', tool_call_id: 'call_1', content: '{"tempC":21}' });
    // totals
    expect(r.trace.inputTokens).toBe(30);
    expect(r.trace.outputTokens).toBe(13);
    expect(r.trace.totalTokens).toBe(43);
    expect(r.trace.costUsd).toBeCloseTo((30 * 1 + 13 * 2) / 1e6, 12);
    expect(r.trace.totalLatencyMs).toBe(r.trace.completedAt - r.trace.startedAt);
    for (const s of r.trace.steps) expect(s.endedAt).toBeGreaterThanOrEqual(s.startedAt);
  });

  it('captures invalid tool arguments as a validation step and tells the model', async () => {
    const { r, calls } = await run([{ body: openaiToolCall('weather', '{"town":"x"}') }, { body: openaiText('sorry') }]);
    const v = r.trace.steps.find((s) => s.type === 'validation')!;
    expect(v.error?.message).toMatch(/\$\.city is required/);
    expect(v.error?.message).toMatch(/\$\.town is not allowed/);
    const second = calls[1]!.body as { messages: Array<{ content: string }> };
    expect(second.messages.at(-1)!.content).toMatch(/Invalid arguments/);
  });

  it('captures malformed JSON arguments and unknown tools', async () => {
    const { r } = await run([
      { body: { choices: [{ message: { tool_calls: [{ id: 'a', function: { name: 'weather', arguments: '{bad' } }, { id: 'b', function: { name: 'nope', arguments: '{}' } }] } }] } },
      { body: openaiText('ok') },
    ]);
    const msgs = r.trace.steps.filter((s) => s.type === 'validation').map((s) => s.error!.message);
    expect(msgs[0]).toMatch(/not valid JSON/);
    expect(msgs[1]).toMatch(/unknown tool "nope"/);
  });

  it('records mock tool errors', async () => {
    const { r } = await run([{ body: openaiToolCall('weather', '{"city":"Sydney"}') }, { body: openaiText('?') }]);
    expect(r.trace.steps[2]!.error).toMatchObject({ source: 'tool', message: expect.stringMatching(/No mock case matched/) });
  });

  it('captures the exact provider error and stops', async () => {
    const { r } = await run([{ status: 429, body: { error: { message: 'Rate limit reached for requests', type: 'requests', code: 'rate_limit_exceeded' } } }]);
    expect(r.trace.status).toBe('error');
    const s = r.trace.steps.at(-1)!;
    expect(s.error).toMatchObject({ source: 'provider', status: 429, code: 'rate_limit_exceeded', message: 'Rate limit reached for requests' });
    expect(s.http?.response?.status).toBe(429);
  });

  it('stops at maxTurns', async () => {
    const { r } = await run([{ body: openaiToolCall('weather', '{"city":"Melbourne"}') }, { body: openaiToolCall('weather', '{"city":"Melbourne"}') }], { ...base, maxTurns: 2 });
    expect(r.trace.status).toBe('error');
    expect(r.trace.steps.at(-1)!.error?.message).toMatch(/Stopped after 2 model turns/);
  });

  it('rejects empty model or prompt without calling the network', async () => {
    const { r, calls } = await run([], { ...base, model: ' ' });
    expect(r.trace.steps.at(-1)!.error?.source).toBe('config');
    expect(calls).toHaveLength(0);
  });

  it('cost is null when the model has no price entry', async () => {
    const { r } = await run([{ body: openaiText('x') }], { ...base, model: 'unpriced' });
    expect(r.trace.costUsd).toBeNull();
  });

  it('never stores the API key anywhere in the run', async () => {
    const { r } = await run([{ body: openaiToolCall('weather', '{"city":"Melbourne"}') }, { body: openaiText('done') }]);
    expect(JSON.stringify(r)).not.toContain(TEST_KEY);
  });
});
