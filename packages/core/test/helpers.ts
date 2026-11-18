import type { FetchLike } from '../src/network.js';

export interface Recorded {
  url: string;
  init?: RequestInit;
  body: unknown;
  headers: Record<string, string>;
}

/** A fake fetch that replays scripted responses and records every request. */
export function scriptedFetch(responses: Array<{ status?: number; body: unknown } | Error>) {
  const calls: Recorded[] = [];
  let i = 0;
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init, body: init?.body ? JSON.parse(String(init.body)) : undefined, headers: (init?.headers ?? {}) as Record<string, string> });
    const r = responses[i++];
    if (!r) throw new Error('scriptedFetch: no more responses');
    if (r instanceof Error) throw r;
    return new Response(typeof r.body === 'string' ? r.body : JSON.stringify(r.body), { status: r.status ?? 200, headers: { 'content-type': 'application/json' } });
  };
  return { fetch, calls };
}

/** Deterministic clock: advances 10ms per read. */
export function fakeClock(start = 1_700_000_000_000, step = 10) {
  let t = start;
  return () => (t += step);
}

export const openaiText = (text: string, usage = { prompt_tokens: 10, completion_tokens: 5 }) => ({
  choices: [{ message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
  usage,
});

export const openaiToolCall = (name: string, args: string, id = 'call_1') => ({
  choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id, type: 'function', function: { name, arguments: args } }] }, finish_reason: 'tool_calls' }],
  usage: { prompt_tokens: 20, completion_tokens: 8 },
});

export const TEST_KEY = 'sk-test-THIS-IS-A-FAKE-KEY-123456';
