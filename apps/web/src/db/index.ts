import Dexie, { type EntityTable } from 'dexie';
import type { Experiment, Project, ProviderId, Run, RunConfig, Trace } from '@runtime-lab/core';

/** Run metadata; the trace itself lives in the traces table. */
export interface RunRecord {
  id: string;
  createdAt: string;
  title?: string;
  projectId?: string;
  experimentId?: string;
  config: RunConfig;
  traceId: string;
  notes?: string;
  source?: string;
  status: 'ok' | 'error';
}

export interface TraceRecord extends Trace {
  runId: string;
}

/** Only written when the user explicitly opts in to "remember on this device". */
export interface ApiKeyRecord {
  provider: ProviderId;
  key: string;
  savedAt: string;
}

export interface HistoryRecord {
  id?: number;
  at: string;
  action: 'run' | 'import' | 'delete' | 'experiment' | 'note' | 'clear';
  refId?: string;
  summary: string;
}

export interface SettingRecord {
  key: string;
  value: unknown;
}

export type ExperimentRecord = Experiment & { createdAt: string };

export class RuntimeLabDB extends Dexie {
  projects!: EntityTable<Project, 'id'>;
  experiments!: EntityTable<ExperimentRecord, 'id'>;
  runs!: EntityTable<RunRecord, 'id'>;
  traces!: EntityTable<TraceRecord, 'id'>;
  apiKeys!: EntityTable<ApiKeyRecord, 'provider'>;
  history!: EntityTable<HistoryRecord, 'id'>;
  settings!: EntityTable<SettingRecord, 'key'>;

  constructor(name = 'runtime-lab') {
    super(name);
    this.version(1).stores({
      projects: 'id, createdAt',
      experiments: 'id, projectId, createdAt',
      runs: 'id, createdAt, projectId, experimentId, traceId',
      traces: 'id, runId',
      apiKeys: 'provider',
      history: '++id, at',
      settings: 'key',
    });
  }
}

let instance: RuntimeLabDB | null = null;
export function getDb(): RuntimeLabDB {
  if (!instance) instance = new RuntimeLabDB();
  return instance;
}
/** Tests only. */
export function setDb(db: RuntimeLabDB | null) {
  instance = db;
}

export function toRecords(run: Run): { run: RunRecord; trace: TraceRecord } {
  return {
    run: {
      id: run.id,
      createdAt: run.createdAt,
      title: run.title,
      projectId: run.projectId,
      experimentId: run.experimentId,
      config: run.config,
      traceId: run.trace.id,
      notes: run.notes,
      source: run.source,
      status: run.trace.status,
    },
    trace: { ...run.trace, runId: run.id },
  };
}

export function fromRecords(r: RunRecord, t: TraceRecord): Run {
  const { runId: _runId, ...trace } = t;
  return {
    schema: 'runtime-lab/run@1',
    id: r.id,
    createdAt: r.createdAt,
    title: r.title,
    projectId: r.projectId,
    experimentId: r.experimentId,
    config: r.config,
    trace,
    notes: r.notes,
    source: r.source,
  };
}
