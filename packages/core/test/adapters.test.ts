import { describe, expect, it } from 'vitest';
import { ProviderError, buildAnthropicRequest, buildGeminiRequest, buildOpenAIRequest, createAdapter, extractProviderError, parseAnthropicResponse, parseGeminiResponse } from '../src/adapters.js';
import { PROVIDERS } from '../src/providers.js';
import type { ModelRequest } from '../src/types.js';
import { TEST_KEY, openaiText, scriptedFetch } from './helpers.js';

const req: ModelRequest = {
  model: 'some-model',
  system: 'sys',
  messages: [
    { role: 'user', content: 'hi' },
    { role: 'assistant', content: '', toolCalls: [{ id: 't1', name: 'f', arguments: '{"a":1}' }] },
    { role: 'tool', toolCallId: 't1', name: 'f', content: '{"ok":true}' },
  ],
  tools: [{ name: 'f', description: 'd', parameters: { type: 'object' } }],
  temperature: 0.2,
  maxTokens: 50,
};

describe('wire formats', () => {
  it('OpenAI-compatible request', () => {
    const w = buildOpenAIRequest('https://api.openai.com/v1', req, TEST_KEY, 'openai');
    expect(w.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(w.headers.authorization).toBe(`Bearer ${TEST_KEY}`);
    const body = w.body as { messages: Array<Record<string, unknown>>; tools: unknown[]; max_completion_tokens: number };
    expect(body.messages[0]).toEqual({ role: 'system', content: 'sys' });
    expect(body.messages[2]).toMatchObject({ role: 'assistant', tool_calls: [{ id: 't1', type: 'function', function: { name: 'f', arguments: '{"a":1}' } }] });
    expect(body.messages[3]).toEqual({ role: 'tool', tool_call_id: 't1', content: '{"ok":true}' });
    expect(body.max_completion_tokens).toBe(50);
    expect(buildOpenAIRequest('x', req, 'k', 'groq').body.max_tokens).toBe(50);
  });

  it('Anthropic request sends the direct-browser-access header', () => {
    const w = buildAnthropicRequest('https://api.anthropic.com/v1', req, TEST_KEY);
    expect(w.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(w.headers['x-api-key']).toBe(TEST_KEY);
    const body = w.body as { system: string; messages: Array<{ role: string; content: unknown }>; tools: Array<{ input_schema: unknown }> };
    expect(body.system).toBe('sys');
    expect(body.messages[1]!.content).toEqual([{ type: 'tool_use', id: 't1', name: 'f', input: { a: 1 } }]);
    expect(body.messages[2]).toEqual({ role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: '{"ok":true}' }] });
    expect(body.tools[0]!.input_schema).toEqual({ type: 'object' });
  });

  it('Anthropic response parsing', () => {
    const p = parseAnthropicResponse({
      content: [{ type: 'text', text: 'a' }, { type: 'tool_use', id: 'x', name: 'f', input: { q: 1 } }],
      usage: { input_tokens: 3, output_tokens: 4 },
      stop_reason: 'tool_use',
    });
    expect(p).toEqual({ text: 'a', toolCalls: [{ id: 'x', name: 'f', arguments: '{"q":1}' }], usage: { inputTokens: 3, outputTokens: 4 }, stopReason: 'tool_use' });
  });

  it('Gemini request/response', () => {
    const w = buildGeminiRequest('https://generativelanguage.googleapis.com/v1beta', req, TEST_KEY);
    expect(w.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/some-model:generateContent');
    expect(w.headers['x-goog-api-key']).toBe(TEST_KEY);
    expect(w.url).not.toContain(TEST_KEY);
    const p = parseGeminiResponse({
      candidates: [{ content: { parts: [{ text: 'hi' }, { functionCall: { name: 'f', args: { a: 2 } } }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 2 },
    });
    expect(p.toolCalls[0]).toMatchObject({ name: 'f', arguments: '{"a":2}' });
    expect(p.usage).toEqual({ inputTokens: 7, outputTokens: 2 });
  });

  it('keeps the provider error message verbatim', () => {
    expect(extractProviderError({ error: { message: 'Incorrect API key provided', code: 'invalid_api_key' } }, 401)).toEqual({ message: 'Incorrect API key provided', code: 'invalid_api_key' });
    expect(extractProviderError({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, 401)).toEqual({ message: 'invalid x-api-key', code: 'authentication_error' });
    expect(extractProviderError('', 502).message).toBe('HTTP 502');
  });
});

describe('createAdapter', () => {
  it('executes and returns redacted HTTP exchange', async () => {
    const { fetch, calls } = scriptedFetch([{ body: openaiText('hello', { prompt_tokens: 3, completion_tokens: 1 }) }]);
    let t = 0;
    const a = createAdapter('openai', { apiKey: TEST_KEY, fetch, now: () => (t += 100) });
    const res = await a.execute({ model: 'm', messages: [{ role: 'user', content: 'x' }] });
    expect(res.text).toBe('hello');
    expect(res.usage).toEqual({ inputTokens: 3, outputTokens: 1 });
    expect(res.latencyMs).toBe(100);
    expect(calls[0]!.url).toBe(`${PROVIDERS.openai.baseUrl}/chat/completions`);
    expect(calls[0]!.headers.authorization).toBe(`Bearer ${TEST_KEY}`); // real request carries the key...
    expect(JSON.stringify(res.http)).not.toContain(TEST_KEY); // ...the recorded one never does
  });

  it('throws ProviderError with status, code and raw body on HTTP errors', async () => {
    const { fetch } = scriptedFetch([{ status: 401, body: { error: { message: `Incorrect API key provided: ${TEST_KEY}`, code: 'invalid_api_key' } } }]);
    const a = createAdapter('openai', { apiKey: TEST_KEY, fetch });
    const err = (await a.execute({ model: 'm', messages: [] }).catch((e) => e)) as ProviderError;
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.details.status).toBe(401);
    expect(err.details.code).toBe('invalid_api_key');
    expect(err.message).toBe('Incorrect API key provided: [REDACTED]');
    expect(JSON.stringify(err.details)).not.toContain(TEST_KEY);
  });

  it('reports network failures (e.g. CORS) as network errors', async () => {
    const { fetch } = scriptedFetch([new TypeError('Failed to fetch')]);
    const err = (await createAdapter('anthropic', { apiKey: 'k-1234', fetch }).execute({ model: 'm', messages: [] }).catch((e) => e)) as ProviderError;
    expect(err.source).toBe('network');
    expect(err.message).toMatch(/Failed to fetch/);
  });

  it('refuses to run without a key when the provider needs one, but Ollama does not', async () => {
    const { fetch, calls } = scriptedFetch([{ body: openaiText('local') }]);
    await expect(createAdapter('openai', { fetch }).execute({ model: 'm', messages: [] })).rejects.toThrow(/No API key/);
    const r = await createAdapter('ollama', { fetch }).execute({ model: 'llama', messages: [] });
    expect(r.text).toBe('local');
    expect(calls[0]!.url).toBe('http://localhost:11434/v1/chat/completions');
    expect(calls[0]!.headers.authorization).toBeUndefined();
  });
});
