import { summarizeTrace } from './traceEngine.js';
import type { Run, ToolDefinition, TraceStep } from './types.js';

/**
 * Built-in sample trace. This is a SYNTHETIC FIXTURE written by hand to show
 * what a traced run looks like: it is not a recording of a real provider call,
 * and its timings, token counts and payloads are illustrative.
 */
const tools: ToolDefinition[] = [
  {
    name: 'get_order_status',
    description: 'Look up the shipping status of an order by id.',
    parameters: {
      type: 'object',
      properties: { order_id: { type: 'string', pattern: '^ORD-[0-9]{4}$' } },
      required: ['order_id'],
      additionalProperties: false,
    },
    mock: {
      type: 'match',
      cases: [{ when: { order_id: 'ORD-1042' }, result: { status: 'shipped', carrier: 'AusPost', eta: '2026-11-21' } }],
      default: { status: 'not_found' },
    },
    mockLatencyMs: 120,
  },
];

const T0 = Date.UTC(2026, 10, 18, 0, 0, 0);
const req = (body: unknown) => ({
  url: 'https://api.openai.com/v1/chat/completions',
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: '[REDACTED]' },
  body,
});

const steps: TraceStep[] = [
  {
    id: 'step_1',
    type: 'system',
    label: 'Run started',
    startedAt: T0,
    endedAt: T0,
    latencyMs: 0,
    input: { provider: 'openai', model: 'gpt-5-mini', system: 'You are a support agent. Use tools to answer.', tools: ['get_order_status'], maxTurns: 5 },
    output: null,
  },
  {
    id: 'step_2',
    type: 'model',
    label: 'Model turn 1',
    startedAt: T0 + 2,
    endedAt: T0 + 842,
    latencyMs: 840,
    input: { turn: 1, messageCount: 1 },
    output: { text: '', toolCalls: [{ id: 'call_a', name: 'get_order_status', arguments: '{"order_id":"1042"}' }], stopReason: 'tool_calls' },
    usage: { inputTokens: 112, outputTokens: 21 },
    costUsd: 0.00007,
    http: {
      request: req({ model: 'gpt-5-mini', messages: [{ role: 'system', content: 'You are a support agent. Use tools to answer.' }, { role: 'user', content: 'Where is my order 1042?' }] }),
      response: { status: 200, body: { note: 'illustrative payload (synthetic fixture)' } },
    },
  },
  {
    id: 'step_3',
    type: 'validation',
    label: 'Invalid arguments: get_order_status',
    startedAt: T0 + 843,
    endedAt: T0 + 843,
    latencyMs: 0,
    input: { callId: 'call_a', name: 'get_order_status', rawArguments: '{"order_id":"1042"}' },
    output: null,
    error: { source: 'validation', message: 'Invalid arguments for get_order_status: $.order_id must match /^ORD-[0-9]{4}$/', raw: '{"order_id":"1042"}' },
  },
  {
    id: 'step_4',
    type: 'model',
    label: 'Model turn 2',
    startedAt: T0 + 844,
    endedAt: T0 + 1534,
    latencyMs: 690,
    input: { turn: 2, messageCount: 3 },
    output: { text: '', toolCalls: [{ id: 'call_b', name: 'get_order_status', arguments: '{"order_id":"ORD-1042"}' }], stopReason: 'tool_calls' },
    usage: { inputTokens: 171, outputTokens: 23 },
    costUsd: 0.00008875,
    http: { request: req({ note: 'illustrative payload (synthetic fixture)' }), response: { status: 200, body: { note: 'illustrative payload (synthetic fixture)' } } },
  },
  {
    id: 'step_5',
    type: 'tool',
    label: 'Tool get_order_status (mock)',
    startedAt: T0 + 1535,
    endedAt: T0 + 1655,
    latencyMs: 120,
    input: { callId: 'call_b', name: 'get_order_status', arguments: { order_id: 'ORD-1042' }, rawArguments: '{"order_id":"ORD-1042"}' },
    output: { status: 'shipped', carrier: 'AusPost', eta: '2026-11-21' },
  },
  {
    id: 'step_6',
    type: 'model',
    label: 'Model turn 3',
    startedAt: T0 + 1656,
    endedAt: T0 + 2611,
    latencyMs: 955,
    input: { turn: 3, messageCount: 5 },
    output: { text: 'Your order ORD-1042 has shipped with AusPost and should arrive by 21 November 2026.', toolCalls: [], stopReason: 'stop' },
    usage: { inputTokens: 236, outputTokens: 26 },
    costUsd: 0.000111,
    http: { request: req({ note: 'illustrative payload (synthetic fixture)' }), response: { status: 200, body: { note: 'illustrative payload (synthetic fixture)' } } },
  },
];

export const SAMPLE_RUN: Run = {
  schema: 'runtime-lab/run@1',
  id: 'run_sample',
  createdAt: new Date(T0).toISOString(),
  title: 'Sample: support agent with an order-status tool',
  source: 'synthetic fixture (hand-written example, not a real provider call)',
  config: {
    provider: 'openai',
    model: 'gpt-5-mini',
    system: 'You are a support agent. Use tools to answer.',
    messages: [{ role: 'user', content: 'Where is my order 1042?' }],
    tools,
    maxTurns: 5,
  },
  trace: summarizeTrace(steps, 'Your order ORD-1042 has shipped with AusPost and should arrive by 21 November 2026.', 'ok', 'trace_sample'),
};
