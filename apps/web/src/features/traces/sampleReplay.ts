import { summarizeTrace, type Run } from '@runtime-lab/core';
import { useCallback, useEffect, useState } from 'react';

/** Interval between revealed steps while the sample demo is playing. */
export const SAMPLE_REPLAY_STEP_MS = 1000;

/**
 * Returns a copy of `run` whose trace contains only the first `revealed` steps,
 * with totals recomputed so metrics and the graph match what is on screen.
 * The final output and overall status appear only once every step is revealed.
 */
export function sliceSampleRun(run: Run, revealed: number): Run {
  const total = run.trace.steps.length;
  const n = Math.max(0, Math.min(revealed, total));
  const steps = run.trace.steps.slice(0, n);
  const complete = n === total && total > 0;
  return {
    ...run,
    trace: summarizeTrace(steps, complete ? run.trace.output : '', complete ? run.trace.status : 'ok', run.trace.id),
  };
}

export type SampleReplayPhase = 'idle' | 'playing' | 'paused' | 'done';

export function useSampleReplay(run: Run, stepMs = SAMPLE_REPLAY_STEP_MS) {
  const total = run.trace.steps.length;
  const [phase, setPhase] = useState<SampleReplayPhase>('idle');
  const [revealed, setRevealed] = useState(total);

  useEffect(() => {
    if (phase !== 'playing') return;
    if (revealed >= total) {
      setPhase('done');
      return;
    }
    const id = window.setTimeout(() => {
      setRevealed((n) => Math.min(n + 1, total));
    }, stepMs);
    return () => window.clearTimeout(id);
  }, [phase, revealed, total, stepMs]);

  const play = useCallback(() => {
    if (phase === 'idle' || phase === 'done') {
      setRevealed(1);
      setPhase('playing');
    } else if (phase === 'paused') {
      setPhase('playing');
    }
  }, [phase]);

  const pause = useCallback(() => {
    if (phase === 'playing') setPhase('paused');
  }, [phase]);

  const replay = useCallback(() => {
    setRevealed(1);
    setPhase('playing');
  }, []);

  const visibleRun = phase === 'idle' ? run : sliceSampleRun(run, revealed);

  return { phase, revealed, total, visibleRun, play, pause, replay };
}
