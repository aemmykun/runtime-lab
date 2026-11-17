import { describe, expect, it } from 'vitest';
import { renderTraceCardSvg } from '../src/card.js';
import { diffLines, diffRuns } from '../src/diff.js';
import { BlockedRequestError, guardedFetch, isAllowedUrl } from '../src/network.js';
import { ALLOWED_ORIGINS, PROVIDERS } from '../src/providers.js';
import { SAMPLE_RUN } from '../src/sample.js';
import { summarizeTrace } from '../src/traceEngine.js';
import { validateRun } from '../src/share.js';

describe('network guard', () => {
  it('allows only provider origins', async () => {
    for (const p of Object.values(PROVIDERS)) expect(isAllowedUrl(`${p.baseUrl}/x`)).toBe(true);
    expect(isAllowedUrl('https://evil.example/collect')).toBe(false);
    expect(isAllowedUrl('https://api.openai.com.evil.example/')).toBe(false);
    expect(isAllowedUrl('not a url')).toBe(false);
    let called = 0;
    const f = guardedFetch(async () => {
      called++;
      return new Response('{}');
    });
    await expect(f('https://telemetry.example/')).rejects.toBeInstanceOf(BlockedRequestError);
    await f('https://api.anthropic.com/v1/messages');
    expect(called).toBe(1);
  });
  it('every provider base URL is in the allow-list', () => {
    for (const p of Object.values(PROVIDERS)) expect(ALLOWED_ORIGINS).toContain(new URL(p.baseUrl).origin);
  });
});

describe('diff', () => {
  it('line diff', () => {
    expect(diffLines('a\nb\nc', 'a\nc\nd')).toEqual([
      { op: 'same', text: 'a' },
      { op: 'remove', text: 'b' },
      { op: 'same', text: 'c' },
      { op: 'add', text: 'd' },
    ]);
  });
  it('run diff reports config changes and metric deltas', () => {
    const b = { ...SAMPLE_RUN, config: { ...SAMPLE_RUN.config, model: 'other' }, trace: { ...SAMPLE_RUN.trace, totalLatencyMs: 100, output: 'changed' } };
    const d = diffRuns(SAMPLE_RUN, b);
    expect(d.config).toEqual([{ field: 'model', a: 'gpt-5-mini', b: 'other' }]);
    expect(d.metrics.find((m) => m.metric === 'latencyMs')!.delta).toBe(100 - SAMPLE_RUN.trace.totalLatencyMs);
    expect(d.output.some((l) => l.op === 'add' && l.text === 'changed')).toBe(true);
  });
});

describe('trace card', () => {
  it('renders metrics only and escapes text', () => {
    const svg = renderTraceCardSvg({ ...SAMPLE_RUN, title: '<script>x</script>' }, 'Runtime Lab');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).not.toContain('<script>');
    expect(svg).not.toContain(SAMPLE_RUN.trace.output);
    expect(svg).toContain('gpt-5-mini');
  });
});

describe('sample trace fixture', () => {
  it('is a valid run, labelled synthetic, with consistent totals', () => {
    expect(validateRun(SAMPLE_RUN)).toBe(SAMPLE_RUN);
    expect(SAMPLE_RUN.source).toMatch(/synthetic/);
    const again = summarizeTrace(SAMPLE_RUN.trace.steps, SAMPLE_RUN.trace.output, 'ok', SAMPLE_RUN.trace.id);
    expect(again).toEqual(SAMPLE_RUN.trace);
    expect(SAMPLE_RUN.trace.costUsd).toBeCloseTo(0.00026975, 10);
  });
});
