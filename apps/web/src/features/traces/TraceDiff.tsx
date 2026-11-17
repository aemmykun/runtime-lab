import { diffRuns, formatUsd, type Run } from '@runtime-lab/core';
import { cn } from '~/lib/utils';
import { TraceSummary } from './TraceView';

const fmt = (metric: string, v: number | null) => (v === null ? 'n/a' : metric === 'costUsd' ? formatUsd(v) : metric === 'latencyMs' ? `${Math.round(v)} ms` : String(v));

export function TraceDiff({ a, b }: { a: Run; b: Run }) {
  const d = diffRuns(a, b);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-slate-800 p-3">
          <div className="mb-2 text-xs font-semibold text-sky-300">A</div>
          <TraceSummary run={a} />
        </div>
        <div className="rounded-md border border-slate-800 p-3">
          <div className="mb-2 text-xs font-semibold text-emerald-300">B</div>
          <TraceSummary run={b} />
        </div>
      </div>
      <section>
        <h3 className="mb-2 text-sm font-semibold">Metrics (B − A)</h3>
        <table className="w-full text-left text-xs">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1">Metric</th>
              <th>A</th>
              <th>B</th>
              <th>Δ</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {d.metrics.map((m) => (
              <tr key={m.metric} className="border-t border-slate-800">
                <td className="py-1 font-sans">{m.metric}</td>
                <td>{fmt(m.metric, m.a)}</td>
                <td>{fmt(m.metric, m.b)}</td>
                <td className={cn(m.delta && m.delta > 0 ? 'text-amber-300' : m.delta && m.delta < 0 ? 'text-emerald-300' : 'text-slate-400')}>
                  {m.delta === null ? 'n/a' : `${m.delta > 0 ? '+' : ''}${fmt(m.metric, m.delta)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold">Configuration changes</h3>
        {d.config.length === 0 ? (
          <p className="text-xs text-slate-500">Same configuration.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {d.config.map((c) => (
              <li key={c.field} className="rounded border border-slate-800 p-2">
                <div className="font-semibold">{c.field}</div>
                <div className="text-red-300">− {String(c.a ?? '')}</div>
                <div className="text-emerald-300">+ {String(c.b ?? '')}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold">Output diff</h3>
        <pre className="overflow-auto rounded bg-slate-950 p-2 text-xs">
          {d.output.map((l, i) => (
            <div key={i} className={cn(l.op === 'add' && 'bg-emerald-950 text-emerald-200', l.op === 'remove' && 'bg-red-950 text-red-200')}>
              {l.op === 'add' ? '+ ' : l.op === 'remove' ? '- ' : '  '}
              {l.text}
            </div>
          ))}
        </pre>
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold">Step sequence</h3>
        <p className="font-mono text-xs text-slate-400">A: {d.stepTypesA.join(' → ')}</p>
        <p className="font-mono text-xs text-slate-400">B: {d.stepTypesB.join(' → ')}</p>
      </section>
    </div>
  );
}
