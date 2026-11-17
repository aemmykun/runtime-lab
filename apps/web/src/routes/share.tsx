import { newId, type Run } from '@runtime-lab/core';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Button } from '~/components/ui/button';
import { saveRun } from '~/db/repo';
import { TraceView } from '~/features/traces/TraceView';
import { decodeShareFragment } from '~/services/exporters';
import { currentSecrets, useSessionStore } from '~/stores/session-store';
import { useTraceStore } from '~/stores/trace-store';

function SharePage() {
  const [run, setRun] = useState<Run>();
  const [error, setError] = useState<string>();
  const navigate = useNavigate();
  useEffect(() => {
    try {
      setRun(decodeShareFragment(window.location.hash));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  if (error) return <p className="p-8 text-red-300">{error}</p>;
  if (!run) return <p className="p-8 text-slate-400">Loading shared run…</p>;
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <div className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900 p-3 text-sm">
        <span>Shared run, decoded locally from the link. Nothing was downloaded from a server.</span>
        <Button
          size="sm"
          onClick={async () => {
            const saved = await saveRun({ ...run, id: newId('run'), projectId: useSessionStore.getState().activeProjectId, experimentId: undefined }, currentSecrets(), 'import');
            useTraceStore.getState().show(saved);
            await navigate({ to: '/lab' });
          }}
        >
          Save to my lab
        </Button>
      </div>
      <TraceView run={run} editable={false} />
    </div>
  );
}

export const Route = createFileRoute('/share')({ component: SharePage });
