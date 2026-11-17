import { useQueryClient } from '@tanstack/react-query';
import { FlaskConical, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Input, Textarea } from '~/components/ui/input';
import { saveExperiment } from '~/db/repo';
import type { ExperimentRecord } from '~/db';
import { useExperiments } from '~/lib/queries';
import { cn } from '~/lib/utils';
import { currentSecrets, useSessionStore } from '~/stores/session-store';

function ExperimentEditor({ initial, projectId, onDone }: { initial?: ExperimentRecord; projectId: string; onDone: () => void }) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [hypothesis, setHypothesis] = useState(initial?.hypothesis ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const qc = useQueryClient();
  return (
    <div className="space-y-2 rounded-md border border-slate-800 p-2">
      <Input placeholder="Experiment title" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Experiment title" />
      <Textarea className="font-sans" rows={2} placeholder="Hypothesis (e.g. a shorter system prompt keeps tool accuracy and cuts tokens)" value={hypothesis} onChange={(e) => setHypothesis(e.target.value)} aria-label="Hypothesis" />
      <Textarea className="font-sans" rows={3} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Experiment notes" />
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!title.trim()}
          onClick={async () => {
            await saveExperiment({ id: initial?.id, title: title.trim(), hypothesis, notes, projectId }, currentSecrets());
            await qc.invalidateQueries({ queryKey: ['experiments'] });
            onDone();
          }}
        >
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function ExperimentsSection() {
  const projectId = useSessionStore((s) => s.activeProjectId);
  const active = useSessionStore((s) => s.activeExperimentId);
  const setActive = useSessionStore((s) => s.setActiveExperiment);
  const { data: experiments = [] } = useExperiments(projectId);
  const [editing, setEditing] = useState<ExperimentRecord | 'new' | null>(null);
  const current = experiments.find((e) => e.id === active);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <FlaskConical className="size-3" /> Experiments
        </h3>
        <Button variant="ghost" size="sm" onClick={() => setEditing('new')} aria-label="New experiment">
          <Plus />
        </Button>
      </div>
      {editing && <ExperimentEditor initial={editing === 'new' ? undefined : editing} projectId={projectId} onDone={() => setEditing(null)} />}
      <ul className="space-y-1">
        <li>
          <button className={cn('w-full rounded px-2 py-1 text-left text-sm', !active ? 'bg-slate-800' : 'hover:bg-slate-900')} onClick={() => setActive(undefined)}>
            No experiment
          </button>
        </li>
        {experiments.map((e) => (
          <li key={e.id}>
            <button className={cn('w-full rounded px-2 py-1 text-left text-sm', active === e.id ? 'bg-slate-800' : 'hover:bg-slate-900')} onClick={() => setActive(e.id)}>
              {e.title} <span className="text-xs text-slate-500">· {e.traces.length} run(s)</span>
            </button>
          </li>
        ))}
      </ul>
      {current && !editing && (
        <div className="space-y-1 rounded-md bg-slate-900 p-2 text-xs">
          <div className="font-semibold">Hypothesis</div>
          <p className="whitespace-pre-wrap text-slate-300">{current.hypothesis || '—'}</p>
          <div className="font-semibold">Notes</div>
          <p className="whitespace-pre-wrap text-slate-300">{current.notes || '—'}</p>
          <Button size="sm" variant="ghost" onClick={() => setEditing(current)}>
            Edit
          </Button>
          <p className="text-slate-500">New runs are added to this experiment.</p>
        </div>
      )}
    </section>
  );
}
