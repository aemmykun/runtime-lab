import { SAMPLE_RUN } from '@runtime-lab/core';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LAB_SETUP_BUTTON_LABEL, SampleTraceDemo } from '~/features/traces/SampleTraceDemo';
import { SAMPLE_REPLAY_STEP_MS, sliceSampleRun } from '~/features/traces/sampleReplay';
import { freshDb } from './helpers';

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router');
  return {
    ...actual,
    Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
  };
});

describe('sliceSampleRun', () => {
  it('recomputes metrics from only the revealed steps and hides the final output until complete', () => {
    const two = sliceSampleRun(SAMPLE_RUN, 2);
    expect(two.trace.steps).toHaveLength(2);
    expect(two.trace.steps.map((s) => s.label)).toEqual(['Run started', 'Model turn 1']);
    expect(two.trace.output).toBe('');
    expect(two.trace.inputTokens).toBe(112);
    expect(two.trace.outputTokens).toBe(21);
    expect(two.trace.costUsd).toBe(0.00007);
    expect(two.trace.status).toBe('ok');

    const mid = sliceSampleRun(SAMPLE_RUN, 3);
    expect(mid.trace.steps).toHaveLength(3);
    expect(mid.trace.steps[2]!.error?.source).toBe('validation');
    expect(mid.trace.output).toBe('');

    const full = sliceSampleRun(SAMPLE_RUN, SAMPLE_RUN.trace.steps.length);
    expect(full.trace.steps).toHaveLength(SAMPLE_RUN.trace.steps.length);
    expect(full.trace.output).toBe(SAMPLE_RUN.trace.output);
    expect(full.trace.inputTokens).toBe(SAMPLE_RUN.trace.inputTokens);
    expect(full.trace.costUsd).toBe(SAMPLE_RUN.trace.costUsd);
  });

  it('clamps a revealed count that is out of range', () => {
    expect(sliceSampleRun(SAMPLE_RUN, 0).trace.steps).toHaveLength(0);
    expect(sliceSampleRun(SAMPLE_RUN, 99).trace.steps).toHaveLength(SAMPLE_RUN.trace.steps.length);
  });
});

describe('Play demo replay', () => {
  beforeEach(() => {
    freshDb();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the full example until Play demo is clicked, then reveals steps on a timer without fetching', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<SampleTraceDemo />);

    expect(screen.getByRole('button', { name: 'Play demo' })).toBeTruthy();
    expect(screen.getByRole('link', { name: LAB_SETUP_BUTTON_LABEL })).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(SAMPLE_RUN.trace.steps.length);
    expect(screen.getByText(SAMPLE_RUN.trace.output)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Play demo' }));

    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Replay' })).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('Run started')).toBeTruthy();
    expect(screen.queryByText('Model turn 1')).toBeNull();
    expect(screen.queryByText(SAMPLE_RUN.trace.output)).toBeNull();
    expect(screen.getByTestId('replay-status').textContent).toMatch(/hand-written example replay/);
    expect(screen.getByTestId('replay-status').textContent).toMatch(/not a real provider call/);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SAMPLE_REPLAY_STEP_MS);
    });
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Model turn 1')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByRole('button', { name: 'Play demo' })).toBeTruthy();
    expect(screen.getByTestId('replay-status').textContent).toMatch(/^Paused/);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SAMPLE_REPLAY_STEP_MS * 3);
    });
    expect(screen.getAllByRole('listitem')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Play demo' }));
    for (let i = 2; i < SAMPLE_RUN.trace.steps.length; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SAMPLE_REPLAY_STEP_MS);
      });
    }
    expect(screen.getAllByRole('listitem')).toHaveLength(SAMPLE_RUN.trace.steps.length);
    expect(screen.getByText(SAMPLE_RUN.trace.output)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Play demo' })).toBeTruthy();
    expect(screen.getByTestId('replay-status').textContent).toMatch(/^Finished the hand-written example replay/);

    fireEvent.click(screen.getByRole('button', { name: 'Replay' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
