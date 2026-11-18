import { SAMPLE_RUN } from '@runtime-lab/core';
import { Link } from '@tanstack/react-router';
import { Info } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { TraceView } from '~/features/traces/TraceView';
import { configToDraft, useSessionStore } from '~/stores/session-store';
import { useSampleReplay } from './sampleReplay';

export const LAB_SETUP_BUTTON_LABEL = 'Try this setup in the Lab (needs your API key)';

function replayStatus(phase: 'playing' | 'paused' | 'done', revealed: number, total: number): string {
  if (phase === 'playing') {
    return `Playing a hand-written example replay — step ${revealed} of ${total}. No API key, no network; this is not a real provider call.`;
  }
  if (phase === 'paused') {
    return `Paused at step ${revealed} of ${total}. This is a hand-written example replay, not a real provider call.`;
  }
  return 'Finished the hand-written example replay. No API key was used and no network call was made.';
}

/** Sample trace page body: intro, Play demo replay, and the static/live TraceView. */
export function SampleTraceDemo() {
  const loadConfig = useSessionStore((s) => s.loadConfig);
  const { phase, revealed, total, visibleRun, play, pause, replay } = useSampleReplay(SAMPLE_RUN);

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-900 bg-amber-950/30 p-3 text-sm text-amber-200">
        <Info className="size-4 shrink-0" />
        <div className="flex-1 space-y-1">
          <p className="font-medium">This is an example trace, so you can see what Runtime Lab records. No API key needed.</p>
          <p>
            A customer asks <em>&quot;Where is my order 1042?&quot;</em>. The model calls the <code>get_order_status</code> tool with the wrong ID format
            (<code>1042</code> instead of <code>ORD-1042</code>), Runtime Lab catches it as a validation error, the model retries with the right ID, the
            tool answers, and the model replies.
          </p>
          <p className="opacity-80">
            Read the timeline top to bottom: each row is one step, with its time, tokens and cost. Click a step to see exactly what was sent and
            received. This example is written by hand; it did not call a real AI provider.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {phase === 'playing' ? (
          <Button size="sm" variant="secondary" onClick={pause}>
            Pause
          </Button>
        ) : (
          <Button size="sm" onClick={play}>
            Play demo
          </Button>
        )}
        {phase !== 'idle' && (
          <Button size="sm" variant="secondary" onClick={replay}>
            Replay
          </Button>
        )}
        <Button asChild size="sm" variant="secondary" onClick={() => loadConfig(configToDraft(SAMPLE_RUN.config, 'Sample (re-run)'))}>
          <Link to="/lab">{LAB_SETUP_BUTTON_LABEL}</Link>
        </Button>
        {phase !== 'idle' && (
          <p className="w-full text-xs text-slate-400" data-testid="replay-status">
            {replayStatus(phase, revealed, total)}
          </p>
        )}
      </div>
      <TraceView run={visibleRun} editable={false} />
    </div>
  );
}
