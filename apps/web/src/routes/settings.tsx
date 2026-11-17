import { PROVIDERS, parsePriceTable } from '@runtime-lab/core';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Textarea } from '~/components/ui/input';
import { clearAllData, ensureDefaultProject, forgetAllKeys, DEFAULT_PROJECT_ID } from '~/db/repo';
import { useHistory } from '~/lib/queries';
import { formatTime } from '~/lib/utils';
import { useSessionStore } from '~/stores/session-store';
import { useSettingsStore } from '~/stores/settings-store';
import { useTraceStore } from '~/stores/trace-store';

function SettingsPage() {
  const table = useSettingsStore((s) => s.priceTable);
  const [text, setText] = useState(() => JSON.stringify(table, null, 2));
  const [msg, setMsg] = useState<string>();
  const remembered = useSessionStore((s) => s.remembered);
  const running = useSessionStore((s) => s.running);
  const { data: history = [] } = useHistory();
  const qc = useQueryClient();
  useEffect(() => setText(JSON.stringify(table, null, 2)), [table]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Price table (estimates)</CardTitle>
          <CardDescription>{table.note}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea rows={14} value={text} onChange={(e) => setText(e.target.value)} aria-label="Price table JSON" />
          <p className="text-xs text-slate-500">
            Keys are <code>provider:model</code> or a bare model id. Values are USD per 1M input/output tokens. Models not listed show cost as n/a.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={async () => {
                try {
                  await useSettingsStore.getState().setPriceTable(parsePriceTable(text));
                  setMsg('Saved.');
                } catch (e) {
                  setMsg((e as Error).message);
                }
              }}
            >
              Save prices
            </Button>
            <Button size="sm" variant="outline" onClick={() => void useSettingsStore.getState().resetPriceTable()}>
              Reset to defaults
            </Button>
            {msg && <span className="text-xs text-slate-400">{msg}</span>}
          </div>
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
