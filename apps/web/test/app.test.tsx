import { SAMPLE_RUN } from '@runtime-lab/core';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { getRun, listRuns, saveExperiment, listExperiments, deleteRun } from '~/db/repo';
import { buildGraph } from '~/features/traces/AgentGraph';
import { ExecutionTimeline } from '~/features/traces/ExecutionTimeline';
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

  it('reports a missing key as a traced error without any network call', async () => {
    const { fetch, urls } = spyFetch();
    const run = (await runDraft(fetch))!;
    expect(run.trace.status).toBe('error');
    expect(run.trace.steps.at(-1)!.error?.message).toMatch(/No API key/);
    expect(urls).toEqual([]);
  });
});

describe('trace UI', () => {
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
});
