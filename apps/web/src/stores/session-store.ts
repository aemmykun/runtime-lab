import { PROVIDERS, type ProviderId } from '@runtime-lab/core';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { DEFAULT_PROJECT_ID } from '~/db/repo';

export interface Draft {
  provider: ProviderId;
  model: string;
  system: string;
  prompt: string;
  toolsJson: string;
  temperature: string;
  maxTokens: string;
  maxTurns: string;
  title: string;
}

export const DEFAULT_TOOLS_JSON = `[
  {
    "name": "get_weather",
    "description": "Current weather for a city",
    "parameters": {
      "type": "object",
      "properties": { "city": { "type": "string" } },
      "required": ["city"],
      "additionalProperties": false
    },
    "mock": {
      "type": "match",
      "cases": [{ "when": { "city": "Melbourne" }, "result": { "tempC": 21, "sky": "cloudy" } }],
      "default": { "error": "city not in mock data" }
    },
    "mockLatencyMs": 80
  }
]`;

export const initialDraft = (): Draft => ({
  provider: 'openai',
  model: PROVIDERS.openai.exampleModel,
  system: 'You are a concise assistant. Use tools when they help.',
  prompt: 'What is the weather in Melbourne right now?',
  toolsJson: DEFAULT_TOOLS_JSON,
  temperature: '',
  maxTokens: '',
  maxTurns: '5',
  title: '',
});

interface SessionState {
  /** API keys held in memory only. Lost on reload unless the user opted in to remember. */
  keys: Partial<Record<ProviderId, string>>;
  /** Providers whose key the user chose to remember on this device. */
  remembered: Partial<Record<ProviderId, boolean>>;
  draft: Draft;
  activeProjectId: string;
  activeExperimentId?: string;
  running: boolean;
  /** Bumped when a saved run is loaded into the editor, so forms re-initialise. */
  draftVersion: number;
  loadConfig: (d: Draft) => void;
  setKey: (p: ProviderId, key: string) => void;
  setRemembered: (p: ProviderId, on: boolean) => void;
  setDraft: (patch: Partial<Draft>) => void;
  resetDraft: () => void;
  setActiveProject: (id: string) => void;
  setActiveExperiment: (id?: string) => void;
  setRunning: (r: boolean) => void;
  clearKeys: () => void;
}

export const useSessionStore = create<SessionState>()(
  immer((set) => ({
    keys: {},
    remembered: {},
    draft: initialDraft(),
    activeProjectId: DEFAULT_PROJECT_ID,
    activeExperimentId: undefined,
    running: false,
    draftVersion: 0,
    loadConfig: (d) =>
      set((s) => {
        s.draft = d;
        s.draftVersion += 1;
      }),
    setKey: (p, key) =>
      set((s) => {
        s.keys[p] = key;
      }),
    setRemembered: (p, on) =>
      set((s) => {
        s.remembered[p] = on;
      }),
    setDraft: (patch) =>
      set((s) => {
        Object.assign(s.draft, patch);
      }),
    resetDraft: () =>
      set((s) => {
        s.draft = initialDraft();
      }),
    setActiveProject: (id) =>
      set((s) => {
        s.activeProjectId = id;
        s.activeExperimentId = undefined;
      }),
    setActiveExperiment: (id) =>
      set((s) => {
        s.activeExperimentId = id;
      }),
    setRunning: (r) =>
      set((s) => {
        s.running = r;
      }),
    clearKeys: () =>
      set((s) => {
        s.keys = {};
        s.remembered = {};
      }),
  })),
);

/** All keys currently in memory, for scrubbing before anything is stored or shared. */
export const currentSecrets = (): string[] => Object.values(useSessionStore.getState().keys).filter((k): k is string => !!k);

export function configToDraft(c: import('@runtime-lab/core').RunConfig, title = ''): Draft {
  return {
    provider: c.provider,
    model: c.model,
    system: c.system ?? '',
    prompt: c.messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n\n'),
    toolsJson: c.tools?.length ? JSON.stringify(c.tools, null, 2) : '[]',
    temperature: c.temperature === undefined ? '' : String(c.temperature),
    maxTokens: c.maxTokens === undefined ? '' : String(c.maxTokens),
    maxTurns: c.maxTurns === undefined ? '5' : String(c.maxTurns),
    title,
  };
}
