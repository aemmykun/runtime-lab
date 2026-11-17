import { SAMPLE_RUN } from '@runtime-lab/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { FormEvent } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRun, listRuns, saveExperiment, listExperiments, deleteRun, saveRun } from '~/db/repo';
import { Button } from '~/components/ui/button';
import { buildGraph } from '~/features/traces/AgentGraph';
import { ExecutionTimeline } from '~/features/traces/ExecutionTimeline';
import { TraceView } from '~/features/traces/TraceView';
import { CREATOR, PRODUCT_NAME, REPO_URL, SPONSOR_URL } from '~/lib/config';
import { DraftError, draftToConfig, runDraft } from '~/services/trace-engine';
import { initialDraft, useSessionStore } from '~/stores/session-store';
import { useTraceStore } from '~/stores/trace-store';
import { FAKE_KEY, freshDb, spyFetch } from './helpers';

describe('config', () => {
  it('uses one product-name constant and the public links', () => {
    expect(PRODUCT_NAME).toBe('Runtime Lab');
    expect(REPO_URL).toBe('https://github.com/aemmykun/runtime-lab');
    expect(SPONSOR_URL).toBe('https://github.com/sponsors/aemmykun');
    expect(CREATOR.project.name).toBe('TenantSage™');
    expect(JSON.stringify(CREATOR)).not.toMatch(/@|\+61|\d{3} \d{3} \d{3}/); // no email or phone
  });
});

describe('draftToConfig', () => {
  it('builds a run config from the editor', () => {
    const c = draftToConfig({ ...initialDraft(), temperature: '0.3', maxTokens: '200' });
    expect(c).toMatchObject({ provider: 'openai', temperature: 0.3, maxTokens: 200, maxTurns: 5 });
    expect(c.tools?.[0]?.name).toBe('get_weather');
  });
  it('rejects bad tools JSON and bad numbers with readable errors', () => {
    expect(() => draftToConfig({ ...initialDraft(), toolsJson: '{' })).toThrow(DraftError);
    expect(() => draftToConfig({ ...initialDraft(), maxTokens: '1.5' })).toThrow(/whole non-negative/);
  });
});

describe('lab flow (IndexedDB)', () => {
  beforeEach(freshDb);

  it('runs, streams steps, saves the run and attaches it to the active experiment', async () => {
    const exp = await saveExperiment({ title: 'Shorter prompt', hypothesis: 'fewer tokens', notes: '' });
    useSessionStore.getState().setActiveExperiment(exp.id);
    useSessionStore.getState().setKey('openai', FAKE_KEY);
    const run = (await runDraft(spyFetch().fetch))!;
    expect(useTraceStore.getState().current?.id).toBe(run.id);
    expect(run.trace.steps.map((s) => s.type)).toEqual(['system', 'model', 'tool', 'model']);
    expect((await listRuns()).map((r) => r.id)).toEqual([run.id]);
    expect((await getRun(run.id))?.trace.totalTokens).toBe(39);
    expect((await listExperiments())[0]!.traces).toEqual([run.id]);
    await deleteRun(run.id);
    expect(await listRuns()).toEqual([]);
    expect((await listExperiments())[0]!.traces).toEqual([]);
  });

  it('gives each imported run exclusive ownership of its trace', async () => {
    const first = await saveRun({ ...SAMPLE_RUN, id: 'import-a' });
    const second = await saveRun({ ...SAMPLE_RUN, id: 'import-b' });
    expect(second.trace.id).not.toBe(first.trace.id);
    await deleteRun(first.id);
    expect(await getRun(second.id)).toBeDefined();
  });

  it('keeps an edited experiment in its original project with its run associations', async () => {
    const original = await saveExperiment({ title: 'original', hypothesis: '', notes: '', projectId: 'project-a', traces: ['run-a'] });
    const updated = await saveExperiment({ id: original.id, title: 'updated', hypothesis: '', notes: '', projectId: 'project-b', traces: ['run-b'] });
    expect(updated.projectId).toBe('project-a');
    expect(updated.traces).toEqual(['run-a']);
  });

  it('reports a missing key as a traced error without any network call', async () => {
    const { fetch, urls } = spyFetch();
    const run = (await runDraft(fetch))!;
    expect(run.trace.status).toBe('error');
    expect(run.trace.steps.at(-1)!.error?.message).toMatch(/No API key/);
    expect(urls).toEqual([]);
  });
});

describe('trace UI', () => {
  beforeEach(freshDb);

  it('timeline shows every step and opens errors by default', () => {
    render(<ExecutionTimeline steps={SAMPLE_RUN.trace.steps} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(SAMPLE_RUN.trace.steps.length);
    expect(screen.getByText(/must match/)).toBeTruthy();
  });

  it('agent graph links prompt → model turns → tools → output', () => {
    const { nodes, edges } = buildGraph(SAMPLE_RUN.trace);
    expect(nodes[0]!.id).toBe('prompt');
    expect(nodes.at(-1)!.id).toBe('output');
    expect(edges.some((e) => e.source === 'step_5' && e.target === 'step_6')).toBe(true);
    expect(nodes.filter((n) => n.id.startsWith('step_')).length).toBe(5);
  });

  it('keeps saved notes when switching tabs', async () => {
    const run = await saveRun({ ...SAMPLE_RUN, id: 'notes-ui' });
    useTraceStore.getState().show(run);
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <TraceView run={run} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Notes' }));
    fireEvent.change(screen.getByPlaceholderText('What did you change? What did you learn?'), { target: { value: 'saved note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save notes' }));
    await waitFor(() => expect(useTraceStore.getState().current?.notes).toBe('saved note'));
    fireEvent.click(screen.getByRole('tab', { name: 'Timeline' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Notes' }));
    expect((screen.getByPlaceholderText('What did you change? What did you learn?') as HTMLTextAreaElement).value).toBe('saved note');
  });

  it('defaults non-submit buttons to button while preserving explicit submit', () => {
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button>Example</Button>
        <Button type="submit">Run</Button>
      </form>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Example' }));
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});
