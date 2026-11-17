import { formatUsd, type TraceStep } from '@runtime-lab/core';
import { AlertTriangle, Bot, ChevronDown, ChevronRight, Cog, ShieldX, Wrench } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '~/components/ui/badge';
import { cn, formatMs } from '~/lib/utils';

const ICON = { model: Bot, tool: Wrench, system: Cog, validation: ShieldX } as const;
const VARIANT = { model: 'info', tool: 'tool', system: 'default', validation: 'warn' } as const;

export function JsonBlock({ value, label }: { value: unknown; label: string }) {
  if (value === undefined) return null;
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <pre className="max-h-80 overflow-auto rounded bg-slate-950 p-2 text-[11px] leading-relaxed text-slate-300">{typeof value === 'string' ? value : JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}

function StepRow({ step, scaleMs, t0 }: { step: TraceStep; scaleMs: number; t0: number }) {
  const [open, setOpen] = useState(!!step.error);
  const Icon = ICON[step.type];
  const left = scaleMs ? ((step.startedAt - t0) / scaleMs) * 100 : 0;
  const width = scaleMs ? Math.max((step.latencyMs / scaleMs) * 100, 0.8) : 0;
  return (
    <li className={cn('rounded-md border', step.error ? 'border-red-900 bg-red-950/20' : 'border-slate-800 bg-slate-900/40')}>
      <button className="flex w-full items-center gap-2 p-2 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? <ChevronDown className="size-3 shrink-0" /> : <ChevronRight className="size-3 shrink-0" />}
        <Icon className="size-4 shrink-0 text-slate-400" />
        <span className="min-w-0 flex-1 truncate text-sm">{step.label}</span>
        {step.error && <AlertTriangle className="size-4 text-red-400" aria-label="error" />}
        <Badge variant={VARIANT[step.type]}>{step.type}</Badge>
        <span className="w-16 text-right font-mono text-xs text-slate-400">{formatMs(step.latencyMs)}</span>
      </button>
      <div className="mx-2 mb-2 h-1.5 rounded bg-slate-800" aria-hidden>
        <div className={cn('h-1.5 rounded', step.error ? 'bg-red-500' : step.type === 'tool' ? 'bg-violet-400' : 'bg-sky-400')} style={{ marginLeft: `${left}%`, width: `${width}%` }} />
      </div>
      {open && (
        <div className="space-y-2 border-t border-slate-800 p-2">
          <div className="flex flex-wrap gap-3 font-mono text-[11px] text-slate-400">
            <span>latency {formatMs(step.latencyMs)}</span>
            {step.usage && (
              <span>
                tokens {step.usage.inputTokens} in / {step.usage.outputTokens} out
              </span>
            )}
            {step.type === 'model' && step.usage && <span>est. cost {formatUsd(step.costUsd)}</span>}
          </div>
          {step.error && (
            <div className="rounded border border-red-900 bg-red-950/40 p-2 text-xs text-red-200">
              <div className="font-semibold">
                {step.error.source} error{step.error.status ? ` · HTTP ${step.error.status}` : ''}
                {step.error.code ? ` · ${step.error.code}` : ''}
              </div>
              <div className="mt-1 whitespace-pre-wrap font-mono">{step.error.message}</div>
              {step.error.raw !== undefined && <JsonBlock label="raw error (redacted)" value={step.error.raw} />}
            </div>
          )}
          <JsonBlock label="input" value={step.input} />
          <JsonBlock label="output" value={step.output} />
          {step.http && (
            <>
              <JsonBlock label={`raw request · ${step.http.request.method} ${step.http.request.url} (secrets redacted)`} value={{ headers: step.http.request.headers, body: step.http.request.body }} />
              {step.http.response && <JsonBlock label={`raw response · HTTP ${step.http.response.status}`} value={step.http.response.body} />}
            </>
          )}
        </div>
      )}
    </li>
  );
}

export function ExecutionTimeline({ steps }: { steps: TraceStep[] }) {
  if (!steps.length) return null;
  const t0 = steps[0]!.startedAt;
  const end = steps.reduce((m, s) => Math.max(m, s.endedAt), t0);
  return (
    <ol className="space-y-2" aria-label="Execution timeline">
      {steps.map((s) => (
        <StepRow key={s.id} step={s} t0={t0} scaleMs={end - t0} />
      ))}
    </ol>
  );
}
