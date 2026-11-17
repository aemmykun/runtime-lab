import type { Run } from './types.js';

export interface FieldChange {
  field: string;
  a: unknown;
  b: unknown;
}

export interface MetricDelta {
  metric: string;
  a: number | null;
  b: number | null;
  delta: number | null;
}

export type LineOp = { op: 'same' | 'add' | 'remove'; text: string };

export interface RunDiff {
  config: FieldChange[];
  metrics: MetricDelta[];
  output: LineOp[];
  stepTypesA: string[];
  stepTypesB: string[];
}

/** Line-level LCS diff; fine for model outputs of a few hundred lines. */
export function diffLines(a: string, b: string): LineOp[] {
  const x = a.split('\n');
  const y = b.split('\n');
  const n = x.length;
  const m = y.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i]![j] = x[i] === y[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const out: LineOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) {
      out.push({ op: 'same', text: x[i]! });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) out.push({ op: 'remove', text: x[i++]! });
    else out.push({ op: 'add', text: y[j++]! });
  }
  while (i < n) out.push({ op: 'remove', text: x[i++]! });
  while (j < m) out.push({ op: 'add', text: y[j++]! });
  return out;
}

const delta = (metric: string, a: number | null, b: number | null): MetricDelta => ({ metric, a, b, delta: a === null || b === null ? null : b - a });

export function diffRuns(a: Run, b: Run): RunDiff {
  const fields: Array<[string, (r: Run) => unknown]> = [
    ['provider', (r) => r.config.provider],
    ['model', (r) => r.config.model],
    ['system', (r) => r.config.system ?? ''],
    ['prompt', (r) => r.config.messages.map((m) => `${m.role}: ${m.content}`).join('\n')],
    ['tools', (r) => r.config.tools ?? []],
    ['temperature', (r) => r.config.temperature ?? null],
    ['maxTokens', (r) => r.config.maxTokens ?? null],
    ['maxTurns', (r) => r.config.maxTurns ?? null],
  ];
  const config = fields.map(([field, get]) => ({ field, a: get(a), b: get(b) })).filter((c) => JSON.stringify(c.a) !== JSON.stringify(c.b));
  const count = (r: Run, t: string) => r.trace.steps.filter((s) => s.type === t).length;
  const errors = (r: Run) => r.trace.steps.filter((s) => s.error).length;
  return {
    config,
    metrics: [
      delta('latencyMs', a.trace.totalLatencyMs, b.trace.totalLatencyMs),
      delta('inputTokens', a.trace.inputTokens, b.trace.inputTokens),
      delta('outputTokens', a.trace.outputTokens, b.trace.outputTokens),
      delta('totalTokens', a.trace.totalTokens, b.trace.totalTokens),
      delta('costUsd', a.trace.costUsd, b.trace.costUsd),
      delta('modelTurns', count(a, 'model'), count(b, 'model')),
      delta('toolCalls', count(a, 'tool'), count(b, 'tool')),
      delta('errors', errors(a), errors(b)),
    ],
    output: diffLines(a.trace.output, b.trace.output),
    stepTypesA: a.trace.steps.map((s) => s.type),
    stepTypesB: b.trace.steps.map((s) => s.type),
  };
}
