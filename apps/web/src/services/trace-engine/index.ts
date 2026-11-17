import { executeRun, parseToolDefinitions, type FetchLike, type Run, type RunConfig } from '@runtime-lab/core';
import { saveRun } from '~/db/repo';
import { getBrowserAdapter } from '~/services/adapters';
import { currentSecrets, useSessionStore, type Draft } from '~/stores/session-store';
import { useSettingsStore } from '~/stores/settings-store';
import { useTraceStore } from '~/stores/trace-store';

export class DraftError extends Error {}

const optNum = (s: string, name: string, int = false): number | undefined => {
  if (!s.trim()) return undefined;
  const n = Number(s);
  if (!Number.isFinite(n) || (int && !Number.isInteger(n)) || n < 0) throw new DraftError(`${name} must be a ${int ? 'whole ' : ''}non-negative number`);
  return n;
};

export function draftToConfig(d: Draft): RunConfig {
  const { tools, errors } = parseToolDefinitions(d.toolsJson.trim() || '[]');
  if (errors.length) throw new DraftError(errors.join('\n'));
  return {
    provider: d.provider,
    model: d.model.trim(),
    system: d.system.trim() || undefined,
    messages: [{ role: 'user', content: d.prompt }],
    tools: tools.length ? tools : undefined,
    temperature: optNum(d.temperature, 'Temperature'),
    maxTokens: optNum(d.maxTokens, 'Max tokens', true),
    maxTurns: optNum(d.maxTurns, 'Max turns', true),
  };
}

/** Runs the current draft in the browser, streams steps to the timeline and saves the run locally. */
export async function runDraft(inner?: FetchLike): Promise<Run | undefined> {
  const session = useSessionStore.getState();
  const traces = useTraceStore.getState();
  let config: RunConfig;
  try {
    config = draftToConfig(session.draft);
  } catch (e) {
    traces.setError((e as Error).message);
    return undefined;
  }
  session.setRunning(true);
  traces.beginLive();
  try {
    const run = await executeRun(config, {
      adapter: getBrowserAdapter(config.provider, session.keys[config.provider], inner),
      priceTable: useSettingsStore.getState().priceTable,
      onStep: (s) => useTraceStore.getState().pushLive(s),
      title: session.draft.title.trim() || undefined,
    });
    run.projectId = session.activeProjectId;
    run.experimentId = session.activeExperimentId;
    const saved = await saveRun(run, currentSecrets());
    useTraceStore.getState().show(saved);
    return saved;
  } finally {
    useSessionStore.getState().setRunning(false);
  }
}
