import { PROVIDERS } from '@runtime-lab/core';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { clearAllData, ensureDefaultProject, forgetAllKeys, DEFAULT_PROJECT_ID } from '~/db/repo';
import { PriceTableEditor } from '~/features/settings/PriceTableEditor';
import { useHistory } from '~/lib/queries';
import { formatTime } from '~/lib/utils';
import { useSessionStore } from '~/stores/session-store';
import { useTraceStore } from '~/stores/trace-store';

function SettingsPage() {
  const remembered = useSessionStore((s) => s.remembered);
  const running = useSessionStore((s) => s.running);
  const { data: history = [] } = useHistory();
  const qc = useQueryClient();

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Price table (estimates)</CardTitle>
          <CardDescription>Edit the estimated cost of each model. Changes apply on this device after you save.</CardDescription>
        </CardHeader>
        <CardContent>
          <PriceTableEditor />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API keys</CardTitle>
          <CardDescription>Keys are kept in memory unless you ticked “Remember on this device” for a provider.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Remembered on this device:{' '}
            {Object.entries(remembered)
              .filter(([, on]) => on)
              .map(([p]) => PROVIDERS[p as keyof typeof PROVIDERS].label)
              .join(', ') || 'none'}
          </p>
          <Button
            size="sm"
            variant="destructive"
            onClick={async () => {
              await forgetAllKeys();
              useSessionStore.getState().clearKeys();
            }}
          >
            Forget all keys
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Local data</CardTitle>
          <CardDescription>Everything lives in this browser&apos;s IndexedDB. Clearing it cannot be undone.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            size="sm"
            variant="destructive"
            disabled={running}
            onClick={async () => {
              if (!window.confirm('Delete all projects, experiments, runs, history, settings and remembered keys from this browser?')) return;
              if (useSessionStore.getState().running) return;
              await clearAllData();
              await ensureDefaultProject();
              useSessionStore.getState().clearKeys();
              useSessionStore.getState().setActiveProject(DEFAULT_PROJECT_ID);
              useTraceStore.getState().show(undefined);
              useTraceStore.getState().clearCompare();
              await qc.invalidateQueries();
            }}
          >
            Delete all local data
          </Button>
          <div>
            <h3 className="mb-1 text-sm font-semibold">History</h3>
            <ul className="max-h-64 space-y-1 overflow-auto text-xs text-slate-400">
              {history.map((h) => (
                <li key={h.id}>
                  {formatTime(h.at)} · {h.summary}
                </li>
              ))}
              {history.length === 0 && <li>No history yet.</li>}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createFileRoute('/settings')({ component: SettingsPage });
