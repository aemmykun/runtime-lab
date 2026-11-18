import { importRunJson, newId } from '@runtime-lab/core';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { GitCompare, History, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { deleteRun, getRun, saveRun, setRunExperiment } from '~/db/repo';
import { useExperiments, useRuns } from '~/lib/queries';
import { cn, formatTime } from '~/lib/utils';
import { currentSecrets, useSessionStore } from '~/stores/session-store';
import { useTraceStore } from '~/stores/trace-store';

export function SavedTraces() {
  const projectId = useSessionStore((s) => s.activeProjectId);
  const activeExperiment = useSessionStore((s) => s.activeExperimentId);
  const { data: runs = [] } = useRuns(projectId);
  const { data: experiments = [] } = useExperiments(projectId);
  const current = useTraceStore((s) => s.current);
  const show = useTraceStore((s) => s.show);
  const compare = useTraceStore((s) => s.compare);
  const toggleCompare = useTraceStore((s) => s.toggleCompare);
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string>();
  const visible = activeExperiment ? runs.filter((r) => r.experimentId === activeExperiment) : runs;
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['runs'] }), qc.invalidateQueries({ queryKey: ['experiments'] }), qc.invalidateQueries({ queryKey: ['history'] })]);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <History className="size-3" /> Saved traces
        </h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()} aria-label="Import run JSON">
            <Upload />
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                const run = importRunJson(await f.text());
                const saved = await saveRun({ ...run, id: newId('run'), projectId, experimentId: activeExperiment }, currentSecrets(), 'import');
                setImportError(undefined);
                show(saved);
                await refresh();
              } catch (err) {
                setImportError((err as Error).message);
              }
            }}
          />
        </div>
      </div>
      {importError && <p className="text-xs text-red-300">{importError}</p>}
      {compare.length === 2 && (
        <Button asChild size="sm" variant="secondary" className="w-full">
          <Link to="/compare" search={{ a: compare[0]!, b: compare[1]! }}>
            <GitCompare /> Compare 2 selected
          </Link>
        </Button>
      )}
      {visible.length === 0 && <p className="text-xs text-slate-500">No saved runs yet. Runs are stored only in this browser (IndexedDB).</p>}
      <ul className="space-y-1">
        {visible.map((r) => (
          <li key={r.id} className={cn('group rounded px-2 py-1', current?.id === r.id ? 'bg-slate-800' : 'hover:bg-slate-900')}>
            <div className="flex items-center gap-2">
              <input type="checkbox" aria-label="Select for comparison" checked={compare.includes(r.id)} onChange={() => toggleCompare(r.id)} />
              <button className="min-w-0 flex-1 text-left" onClick={async () => show(await getRun(r.id))}>
                <div className="truncate text-sm">{r.title || r.config.model}</div>
                <div className="text-[11px] text-slate-500">
                  {formatTime(r.createdAt)} · {r.config.provider}
                </div>
              </button>
              <Badge variant={r.status === 'ok' ? 'success' : 'error'}>{r.status}</Badge>
              <button
                aria-label="Delete run"
                className="text-slate-500 opacity-0 hover:text-red-400 group-hover:opacity-100"
                onClick={async () => {
                  await deleteRun(r.id);
                  if (current?.id === r.id) show(undefined);
                  await refresh();
                }}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            {experiments.length > 0 && (
              <select
                aria-label="Experiment"
                className="mt-1 w-full rounded bg-slate-950 text-[11px] text-slate-400"
                value={r.experimentId ?? ''}
                onChange={async (e) => {
                  await setRunExperiment(r.id, e.target.value || undefined);
                  await refresh();
                }}
              >
                <option value="">No experiment</option>
                {experiments.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.title}
                  </option>
                ))}
              </select>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
