import { Activity } from 'lucide-react';
import { useSessionStore } from '~/stores/session-store';
import { useTraceStore } from '~/stores/trace-store';
import { ExperimentsSection } from '~/features/experiments/ExperimentsSection';
import { ExecutionTimeline } from '~/features/traces/ExecutionTimeline';
import { SavedTraces } from '~/features/traces/SavedTraces';
import { TraceView } from '~/features/traces/TraceView';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { PromptEditor } from './PromptEditor';
import { ProjectsSection } from './ProjectsSection';

export function EmptyTrace() {
  return (
    <div className="flex h-full min-h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-800 p-8 text-center">
      <Activity className="size-8 text-slate-600" />
      <h2 className="text-lg font-semibold">No Trace Yet</h2>
      <p className="max-w-sm text-sm text-slate-400">
        Execute a model request to generate your first trace. Every run captures prompts, tool calls, outputs, errors, latency, and token usage.
      </p>
      <Link to="/sample" className="text-sm text-sky-400 hover:underline">
        Or inspect the sample trace
      </Link>
    </div>
  );
}

export function LabPage() {
  const current = useTraceStore((s) => s.current);
  const live = useTraceStore((s) => s.liveSteps);
  const running = useSessionStore((s) => s.running);
  const version = useSessionStore((s) => s.draftVersion);
  const qc = useQueryClient();
  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[240px_minmax(340px,420px)_1fr]">
      <aside className="space-y-6 lg:sticky lg:top-4 lg:self-start" aria-label="Projects, experiments and saved traces">
        <ProjectsSection />
        <ExperimentsSection />
        <SavedTraces />
      </aside>
      <section aria-label="Prompt editor, tool config and provider selection" className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <PromptEditor
          key={version}
          onRan={() => {
            void qc.invalidateQueries({ queryKey: ['runs'] });
            void qc.invalidateQueries({ queryKey: ['experiments'] });
            void qc.invalidateQueries({ queryKey: ['history'] });
          }}
        />
      </section>
      <section aria-label="Execution timeline" className="min-w-0">
        {running ? (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-300">Running… {live.length} step(s) so far</h2>
            <ExecutionTimeline steps={live} />
          </div>
        ) : current ? (
          <TraceView run={current} />
        ) : (
          <EmptyTrace />
        )}
      </section>
    </div>
  );
}
