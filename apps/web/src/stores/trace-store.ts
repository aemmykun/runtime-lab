import type { Run, TraceStep } from '@runtime-lab/core';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface TraceState {
  /** The run shown in the Execution Timeline. */
  current?: Run;
  /** Steps streamed in while a run executes. */
  liveSteps: TraceStep[];
  /** Run ids picked for side-by-side comparison. */
  compare: string[];
  lastError?: string;
  show: (run?: Run) => void;
  beginLive: () => void;
  pushLive: (s: TraceStep) => void;
  toggleCompare: (id: string) => void;
  clearCompare: () => void;
  setError: (e?: string) => void;
}

export const useTraceStore = create<TraceState>()(
  immer((set) => ({
    current: undefined,
    liveSteps: [],
    compare: [],
    lastError: undefined,
    show: (run) =>
      set((s) => {
        s.current = run;
        s.liveSteps = [];
      }),
    beginLive: () =>
      set((s) => {
        s.current = undefined;
        s.liveSteps = [];
        s.lastError = undefined;
      }),
    pushLive: (step) =>
      set((s) => {
        s.liveSteps.push(step);
      }),
    toggleCompare: (id) =>
      set((s) => {
        if (s.compare.includes(id)) s.compare = s.compare.filter((x) => x !== id);
        else s.compare = [...s.compare, id].slice(-2);
      }),
    clearCompare: () =>
      set((s) => {
        s.compare = [];
      }),
    setError: (e) =>
      set((s) => {
        s.lastError = e;
      }),
  })),
);
