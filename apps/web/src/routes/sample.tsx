import { SAMPLE_RUN } from '@runtime-lab/core';
import { Link, createFileRoute } from '@tanstack/react-router';
import { Info } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { TraceView } from '~/features/traces/TraceView';
import { configToDraft, useSessionStore } from '~/stores/session-store';

function SamplePage() {
  const loadConfig = useSessionStore((s) => s.loadConfig);
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-900 bg-amber-950/30 p-3 text-sm text-amber-200">
        <Info className="size-4 shrink-0" />
        <div className="flex-1 space-y-1">
          <p className="font-medium">This is an example trace, so you can see what Runtime Lab records. No API key needed.</p>
          <p>
            A customer asks <em>"Where is my order 1042?"</em>. The model calls the <code>get_order_status</code> tool with the wrong ID format
            (<code>1042</code> instead of <code>ORD-1042</code>), Runtime Lab catches it as a validation error, the model retries with the right ID, the
            tool answers, and the model replies.
          </p>
          <p className="opacity-80">
            Read the timeline top to bottom: each row is one step, with its time, tokens and cost. Click a step to see exactly what was sent and
            received. This example is written by hand; it did not call a real AI provider.
          </p>
        </div>
        <Button asChild size="sm" variant="secondary" onClick={() => loadConfig(configToDraft(SAMPLE_RUN.config, 'Sample (re-run)'))}>
          <Link to="/lab">Re-run it with your key</Link>
        </Button>
      </div>
      <TraceView run={SAMPLE_RUN} editable={false} />
    </div>
  );
}

export const Route = createFileRoute('/sample')({ component: SamplePage });
