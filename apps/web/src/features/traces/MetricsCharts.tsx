import type { Trace } from '@runtime-lab/core';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const axis = { stroke: 'var(--muted-foreground)', fontSize: 11 };
const tooltip = { contentStyle: { background: 'var(--card)', border: '1px solid var(--border)', fontSize: 12 } };

export function MetricsCharts({ trace }: { trace: Trace }) {
  const latency = trace.steps.filter((s) => s.type !== 'system').map((s, i) => ({ name: `${i + 1}. ${s.type}`, ms: Math.round(s.latencyMs) }));
  const models = trace.steps.filter((s) => s.type === 'model' && s.usage);
  const tokens = models.map((s, i) => ({ name: `turn ${i + 1}`, input: s.usage!.inputTokens, output: s.usage!.outputTokens }));
  let acc = 0;
  const priced = models.every((s) => typeof s.costUsd === 'number');
  const cost = models.map((s, i) => ({ name: `turn ${i + 1}`, usd: Number((acc += s.costUsd ?? 0).toFixed(8)) }));
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <figure className="h-56">
        <figcaption className="mb-1 text-xs text-slate-400">Latency per step (ms)</figcaption>
        <ResponsiveContainer>
          <BarChart data={latency}>
            <CartesianGrid stroke="var(--border)" />
            <XAxis dataKey="name" {...axis} />
            <YAxis {...axis} />
            <Tooltip {...tooltip} />
            <Bar dataKey="ms" fill="var(--accent)" />
          </BarChart>
        </ResponsiveContainer>
      </figure>
      <figure className="h-56">
        <figcaption className="mb-1 text-xs text-slate-400">Tokens per model turn</figcaption>
        <ResponsiveContainer>
          <BarChart data={tokens}>
            <CartesianGrid stroke="var(--border)" />
            <XAxis dataKey="name" {...axis} />
            <YAxis {...axis} />
            <Tooltip {...tooltip} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="input" stackId="t" fill="#818cf8" />
            <Bar dataKey="output" stackId="t" fill="#34d399" />
          </BarChart>
        </ResponsiveContainer>
      </figure>
      <figure className="h-56">
        <figcaption className="mb-1 text-xs text-slate-400">Cumulative estimated cost (USD)</figcaption>
        {priced && cost.length ? (
          <ResponsiveContainer>
            <LineChart data={cost}>
              <CartesianGrid stroke="var(--border)" />
              <XAxis dataKey="name" {...axis} />
              <YAxis {...axis} />
              <Tooltip {...tooltip} />
              <Line dataKey="usd" stroke="#fbbf24" dot />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-slate-500">No estimate: this model is not in the price table. Add it in Settings.</p>
        )}
      </figure>
    </div>
  );
}
