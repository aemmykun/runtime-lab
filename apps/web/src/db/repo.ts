import { newId, redactDeep, redactString, type Experiment, type Project, type ProviderId, type Run } from '@runtime-lab/core';
import { fromRecords, getDb, toRecords, type ApiKeyRecord, type ExperimentRecord, type HistoryRecord, type RunRecord } from './index';

export const DEFAULT_PROJECT_ID = 'project_default';

async function log(action: HistoryRecord['action'], summary: string, refId?: string) {
  await getDb().history.add({ at: new Date().toISOString(), action, summary, refId });
}

export async function ensureDefaultProject(): Promise<Project[]> {
  const db = getDb();
  if ((await db.projects.count()) === 0) await db.projects.add({ id: DEFAULT_PROJECT_ID, name: 'My project', createdAt: new Date().toISOString() });
  return db.projects.orderBy('createdAt').toArray();
}

export async function createProject(name: string): Promise<Project> {
  const p = { id: newId('project'), name, createdAt: new Date().toISOString() };
  await getDb().projects.add(p);
  return p;
}

/**
 * Saves a run. `secrets` are the keys currently in memory: they are scrubbed
 * from everything before it touches IndexedDB, as defence in depth.
 */
export async function saveRun(run: Run, secrets: readonly string[] = [], action: HistoryRecord['action'] = 'run'): Promise<Run> {
  const clean = redactDeep(run, secrets);
  const { run: r, trace } = toRecords(clean);
  const db = getDb();
  await db.transaction('rw', db.runs, db.traces, db.history, db.experiments, async () => {
    await db.runs.put(r);
    await db.traces.put(trace);
    if (clean.experimentId) {
      const ex = await db.experiments.get(clean.experimentId);
      if (ex && !ex.traces.includes(clean.id)) await db.experiments.put({ ...ex, traces: [...ex.traces, clean.id] });
    }
    await log(action, `${action === 'import' ? 'Imported' : 'Ran'} ${clean.config.provider}:${clean.config.model} (${clean.trace.status})`, clean.id);
  });
  return clean;
}

export async function listRuns(projectId?: string): Promise<RunRecord[]> {
  const all = await getDb().runs.orderBy('createdAt').reverse().toArray();
  return projectId ? all.filter((r) => (r.projectId ?? DEFAULT_PROJECT_ID) === projectId) : all;
}

export async function getRun(id: string): Promise<Run | undefined> {
  const db = getDb();
  const r = await db.runs.get(id);
  if (!r) return undefined;
  const t = await db.traces.get(r.traceId);
  return t ? fromRecords(r, t) : undefined;
}

export async function updateRunNotes(id: string, notes: string, secrets: readonly string[] = []) {
  await getDb().runs.update(id, { notes: redactString(notes, secrets) });
}

export async function deleteRun(id: string) {
  const db = getDb();
  const r = await db.runs.get(id);
  if (!r) return;
  await db.transaction('rw', db.runs, db.traces, db.experiments, db.history, async () => {
    await db.runs.delete(id);
    await db.traces.delete(r.traceId);
    const exps = await db.experiments.toArray();
    for (const e of exps) if (e.traces.includes(id)) await db.experiments.put({ ...e, traces: e.traces.filter((x) => x !== id) });
    await log('delete', `Deleted run ${r.title ?? r.id}`, id);
  });
}

export async function listExperiments(projectId?: string): Promise<ExperimentRecord[]> {
  const all = await getDb().experiments.orderBy('createdAt').reverse().toArray();
  return projectId ? all.filter((e) => (e.projectId ?? DEFAULT_PROJECT_ID) === projectId) : all;
}

export async function saveExperiment(e: Omit<Experiment, 'id' | 'traces'> & Partial<Pick<Experiment, 'id' | 'traces'>>): Promise<ExperimentRecord> {
  const db = getDb();
  const existing = e.id ? await db.experiments.get(e.id) : undefined;
  const rec: ExperimentRecord = {
    id: e.id ?? newId('exp'),
    title: e.title,
    hypothesis: e.hypothesis,
    notes: e.notes,
    traces: e.traces ?? existing?.traces ?? [],
    projectId: e.projectId ?? existing?.projectId ?? DEFAULT_PROJECT_ID,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
  await db.experiments.put(rec);
  await log('experiment', `${existing ? 'Updated' : 'Created'} experiment "${rec.title}"`, rec.id);
  return rec;
}

export async function setRunExperiment(runId: string, experimentId: string | undefined) {
  const db = getDb();
  await db.transaction('rw', db.runs, db.experiments, async () => {
    await db.runs.update(runId, { experimentId });
    for (const e of await db.experiments.toArray()) {
      const has = e.traces.includes(runId);
      if (e.id === experimentId && !has) await db.experiments.put({ ...e, traces: [...e.traces, runId] });
      if (e.id !== experimentId && has) await db.experiments.put({ ...e, traces: e.traces.filter((x) => x !== runId) });
    }
  });
}

export async function listHistory(limit = 50): Promise<HistoryRecord[]> {
  return getDb().history.orderBy('at').reverse().limit(limit).toArray();
}

/* ---- API keys: only touched on explicit opt-in ---- */

export async function rememberKey(provider: ProviderId, key: string) {
  await getDb().apiKeys.put({ provider, key, savedAt: new Date().toISOString() });
}
export async function forgetKey(provider: ProviderId) {
  await getDb().apiKeys.delete(provider);
}
export async function forgetAllKeys() {
  await getDb().apiKeys.clear();
}
export async function loadRememberedKeys(): Promise<ApiKeyRecord[]> {
  return getDb().apiKeys.toArray();
}

/* ---- settings ---- */

export async function getSetting<T>(key: string): Promise<T | undefined> {
  return (await getDb().settings.get(key))?.value as T | undefined;
}
export async function setSetting(key: string, value: unknown) {
  await getDb().settings.put({ key, value });
}

export async function clearAllData() {
  const db = getDb();
  await Promise.all([db.projects.clear(), db.experiments.clear(), db.runs.clear(), db.traces.clear(), db.apiKeys.clear(), db.history.clear(), db.settings.clear()]);
}
