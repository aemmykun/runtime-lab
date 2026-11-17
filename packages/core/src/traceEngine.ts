import { ProviderError } from './adapters.js';
import { estimateCost } from './cost.js';
import { newId } from './ids.js';
import { checkToolArguments, runMock } from './mockTools.js';
import type { ModelMessage, ModelRequest, PriceTable, ProviderAdapter, Run, RunConfig, StepError, Trace, TraceStep } from './types.js';

export interface TraceEngineOptions {
  adapter: ProviderAdapter;
  priceTable: PriceTable;
  /** Epoch ms clock (injectable for tests). */
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  onStep?: (step: TraceStep) => void;
  title?: string;
  signal?: AbortSignal;
}

export const DEFAULT_MAX_TURNS = 5;

export function summarizeTrace(steps: TraceStep[], output: string, status: 'ok' | 'error', id = newId('trace')): Trace {
  const startedAt = steps[0]?.startedAt ?? 0;
  const completedAt = steps.reduce((m, s) => Math.max(m, s.endedAt), startedAt);
  let inputTokens = 0;
  let outputTokens = 0;
  let cost: number | null = 0;
  for (const s of steps) {
    if (s.usage) {
      inputTokens += s.usage.inputTokens;
      outputTokens += s.usage.outputTokens;
    }
    if (s.type === 'model' && s.usage) {
      if (s.costUsd === null || s.costUsd === undefined || cost === null) cost = null;
      else cost += s.costUsd;
    }
  }
  return {
    id,
    startedAt,
    completedAt,
    totalLatencyMs: completedAt - startedAt,
    totalTokens: inputTokens + outputTokens,
    costUsd: cost === null ? null : Math.round(cost * 1e8) / 1e8,
    steps,
    inputTokens,
    outputTokens,
    status,
    output,
  };
}

/**
 * Executes a run: calls the provider, answers tool calls from JSON mocks,
 * feeds results back, and records every step on the trace timeline.
 */
export async function executeRun(config: RunConfig, opts: TraceEngineOptions): Promise<Run> {
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const steps: TraceStep[] = [];
  const push = (s: Omit<TraceStep, 'id'>): TraceStep => {
    const step = { id: `step_${steps.length + 1}`, ...s } as TraceStep;
    steps.push(step);
    opts.onStep?.(step);
    return step;
  };
  const tools = config.tools ?? [];
  const maxTurns = Math.max(1, config.maxTurns ?? DEFAULT_MAX_TURNS);

  const t0 = now();
  push({
    type: 'system',
    label: 'Run started',
    startedAt: t0,
    endedAt: t0,
    latencyMs: 0,
    input: {
      provider: config.provider,
      model: config.model,
      system: config.system ?? null,
      messages: config.messages,
      tools: tools.map((t) => t.name),
      temperature: config.temperature ?? null,
      maxTokens: config.maxTokens ?? null,
      maxTurns,
    },
    output: null,
  });

  const fail = (label: string, error: StepError, type: TraceStep['type'] = 'validation') => {
    const t = now();
    push({ type, label, startedAt: t, endedAt: t, latencyMs: 0, input: null, output: null, error });
  };

  const finish = (output: string, status: 'ok' | 'error'): Run => ({
    schema: 'runtime-lab/run@1',
    id: newId('run'),
    createdAt: new Date(t0).toISOString(),
    title: opts.title,
    config,
    trace: summarizeTrace(steps, output, status),
  });

  if (!config.model.trim()) {
    fail('Configuration error', { source: 'config', message: 'Model id is empty' });
    return finish('', 'error');
  }
  if (!config.messages.length || config.messages.every((m) => !m.content.trim())) {
    fail('Configuration error', { source: 'config', message: 'Prompt is empty' });
    return finish('', 'error');
  }

  const conversation: ModelMessage[] = config.messages.map((m) => ({ role: m.role, content: m.content }));
  let lastText = '';

  for (let turn = 1; turn <= maxTurns; turn++) {
    if (opts.signal?.aborted) {
      fail('Cancelled', { source: 'config', message: 'Run cancelled by user' });
      return finish(lastText, 'error');
    }
    const req: ModelRequest = {
      model: config.model,
      system: config.system || undefined,
      messages: conversation,
      tools: tools.length ? tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) : undefined,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    };
    const started = now();
    try {
      const res = await opts.adapter.execute(req);
      const ended = now();
      lastText = res.text;
      push({
        type: 'model',
        label: `Model turn ${turn}`,
        startedAt: started,
        endedAt: ended,
        latencyMs: res.latencyMs,
        input: { turn, messageCount: conversation.length },
        output: { text: res.text, toolCalls: res.toolCalls, stopReason: res.stopReason ?? null },
        usage: res.usage,
        costUsd: estimateCost(opts.priceTable, config.provider, config.model, res.usage),
        http: res.http,
      });
      conversation.push({ role: 'assistant', content: res.text, toolCalls: res.toolCalls.length ? res.toolCalls : undefined });
      if (!res.toolCalls.length) return finish(res.text, 'ok');

      for (const call of res.toolCalls) {
        const tool = tools.find((t) => t.name === call.name);
        const ts = now();
        if (!tool) {
          const message = `Model called unknown tool "${call.name}"`;
          push({ type: 'validation', label: `Unknown tool ${call.name}`, startedAt: ts, endedAt: ts, latencyMs: 0, input: call, output: null, error: { source: 'validation', message } });
          conversation.push({ role: 'tool', toolCallId: call.id, name: call.name, content: JSON.stringify({ error: message }) });
          continue;
        }
        const checked = checkToolArguments(tool, call.arguments);
        if (checked.errors.length) {
          const message = `Invalid arguments for ${call.name}: ${checked.errors.join('; ')}`;
          push({
            type: 'validation',
            label: `Invalid arguments: ${call.name}`,
            startedAt: ts,
            endedAt: now(),
            latencyMs: 0,
            input: { callId: call.id, name: call.name, rawArguments: call.arguments },
            output: null,
            error: { source: 'validation', message, raw: call.arguments },
          });
          conversation.push({ role: 'tool', toolCallId: call.id, name: call.name, content: JSON.stringify({ error: message }) });
          continue;
        }
        if (tool.mockLatencyMs) await sleep(tool.mockLatencyMs);
        const outcome = runMock(tool.mock, checked.args ?? {});
        const te = now();
        push({
          type: 'tool',
          label: `Tool ${call.name} (mock)`,
          startedAt: ts,
          endedAt: te,
          latencyMs: te - ts,
          input: { callId: call.id, name: call.name, arguments: checked.args, rawArguments: call.arguments },
          output: outcome.ok ? outcome.result : null,
          error: outcome.ok ? undefined : { source: 'tool', message: outcome.error },
        });
        conversation.push({
          role: 'tool',
          toolCallId: call.id,
          name: call.name,
          content: JSON.stringify(outcome.ok ? outcome.result : { error: outcome.error }),
        });
      }
    } catch (e) {
      const ended = now();
      if (e instanceof ProviderError) {
        push({
          type: 'model',
          label: `Model turn ${turn} failed`,
          startedAt: started,
          endedAt: ended,
          latencyMs: e.details.latencyMs ?? ended - started,
          input: { turn, messageCount: conversation.length },
          output: null,
          http: e.details.http,
          error: { source: e.source, message: e.message, status: e.details.status, code: e.details.code, raw: e.details.raw },
        });
      } else {
        push({
          type: 'model',
          label: `Model turn ${turn} failed`,
          startedAt: started,
          endedAt: ended,
          latencyMs: ended - started,
          input: { turn },
          output: null,
          error: { source: 'provider', message: e instanceof Error ? e.message : String(e) },
        });
      }
      return finish(lastText, 'error');
    }
  }
  fail('Turn limit reached', { source: 'validation', message: `Stopped after ${maxTurns} model turns with tool calls still pending` });
  return finish(lastText, 'error');
}
