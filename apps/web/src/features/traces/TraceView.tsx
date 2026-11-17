import { formatUsd, type Run } from '@runtime-lab/core';
import { useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Textarea } from '~/components/ui/input';
import { Tabs } from '~/components/ui/tabs';
import { updateRunNotes } from '~/db/repo';
import { ExportPanel } from '~/features/exports/ExportPanel';
import { formatMs, formatTime } from '~/lib/utils';
import { configToDraft, currentSecrets, useSessionStore } from '~/stores/session-store';
import { AgentGraph } from './AgentGraph';
import { ExecutionTimeline } from './ExecutionTimeline';
import { MetricsCharts } from './MetricsCharts';

type Tab = 'timeline' | 'metrics' | 'graph' | 'export' | 'notes';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-900 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="font-mono text-sm">{value}</div>
    </div>
  );
}

export function TraceSummary({ run }: { run: Run }) {
  const t = run.trace;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">{run.title || `${run.config.provider}:${run.config.model}`}</h2>
        <Badge variant={t.status === 'ok' ? 'success' : 'error'}>{t.status === 'ok' ? 'OK' : 'ERROR'}</Badge>
        {run.source && <Badge variant="warn">{run.source}</Badge>}
      </div>
      <p className="text-xs text-slate-500">
        {run.config.provider} · {run.config.model} · {formatTime(run.createdAt)}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label="Latency" value={formatMs(t.totalLatencyMs)} />
        <Stat label="Tokens" value={`${t.inputTokens} / ${t.outputTokens}`} />
        <Stat label="Est. cost" value={formatUsd(t.costUsd)} />
        <Stat label="Tool calls" value={String(t.steps.filter((s) => s.type === 'tool').length)} />
        <Stat label="Errors" value={String(t.steps.filter((s) => s.error).length)} />
      </div>
      {t.output && (
        <div className="rounded-md border border-slate-800 bg-slate-950 p-3">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Final output</div>
          <p className="whitespace-pre-wrap text-sm">{t.output}</p>
        </div>
      )}
    </div>
  );
}

function Notes({ run, editable }: { run: Run; editable: boolean }) {
  const [notes, setNotes] = useState(run.notes ?? '');
  const [saved, setSaved] = useState(false);
  const qc = useQueryClient();
  if (!editable) return <p className="text-sm text-slate-400">Notes are only available for runs saved in your local lab.</p>;
  return (
    <div className="space-y-2">
      <Textarea rows={8} className="font-sans" placeholder="What did you change? What did you learn?" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <Button
        size="sm"
        onClick={async () => {
          await updateRunNotes(run.id, notes, currentSecrets());
          await qc.invalidateQueries({ queryKey: ['runs'] });
          setSaved(true);
          setTimeout(() => setSaved(false), 1500);
        }}
      >
        {saved ? 'Saved' : 'Save notes'}
      </Button>
      <p className="text-xs text-slate-500">Notes stay on this device and are never included in share links.</p>
    </div>
  );
}

export function TraceView({ run, editable = true }: { run: Run; editable?: boolean }) {
  const [tab, setTab] = useState<Tab>('timeline');
  const loadConfig = useSessionStore((s) => s.loadConfig);
  return (
    <div className="space-y-4">
      <TraceSummary run={run} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'timeline', label: 'Timeline' },
            { value: 'metrics', label: 'Metrics' },
            { value: 'graph', label: 'Graph' },
            { value: 'export', label: 'Export & share' },
            { value: 'notes', label: 'Notes' },
          ]}
        />
        {editable && (
          <Button variant="ghost" size="sm" onClick={() => loadConfig(configToDraft(run.config, run.title ?? ''))}>
            <Pencil /> Load into editor
          </Button>
        )}
      </div>
      {tab === 'timeline' && <ExecutionTimeline steps={run.trace.steps} />}
      {tab === 'metrics' && <MetricsCharts trace={run.trace} />}
      {tab === 'graph' && <AgentGraph trace={run.trace} />}
      {tab === 'export' && <ExportPanel run={run} />}
      {tab === 'notes' && <Notes key={run.id} run={run} editable={editable} />}
    </div>
  );
}
