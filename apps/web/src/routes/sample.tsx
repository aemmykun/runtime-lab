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
        <span className="flex-1">
          This sample is a hand-written, synthetic trace bundled with the app. It shows what a traced run looks like (including a validation error the model recovers from). It
          was not produced by a real provider call.
        </span>
        <Button asChild size="sm" variant="secondary" onClick={() => loadConfig(configToDraft(SAMPLE_RUN.config, 'Sample (re-run)'))}>
          <Link to="/lab">Re-run it with your key</Link>
        </Button>
      </div>
      <TraceView run={SAMPLE_RUN} editable={false} />
    </div>
  );
}

export const Route = createFileRoute('/sample')({ component: SamplePage });
