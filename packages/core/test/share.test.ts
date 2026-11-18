import { describe, expect, it } from 'vitest';
import { SAMPLE_RUN } from '../src/sample.js';
import { SYSTEM_REMOVED, decodeShareFragment, encodeShareLink, exportRunJson, importRunJson, sanitizeRunForShare } from '../src/share.js';
import type { Run } from '../src/types.js';
import { TEST_KEY } from './helpers.js';

const leaky: Run = {
  ...SAMPLE_RUN,
  notes: 'private note',
  config: { ...SAMPLE_RUN.config, system: 'TOP SECRET SYSTEM PROMPT', messages: [{ role: 'user', content: `here is my key ${TEST_KEY}` }] },
};

describe('share', () => {
  it('round-trips a run through a URL fragment link', () => {
    const link = encodeShareLink(SAMPLE_RUN, 'https://example.test/app#old', { includeSystemPrompt: true });
    expect(link.startsWith('https://example.test/app#share=')).toBe(true);
    const back = decodeShareFragment(new URL(link).hash);
    expect(back.config.model).toBe(SAMPLE_RUN.config.model);
    expect(back.trace.steps).toHaveLength(SAMPLE_RUN.trace.steps.length);
    expect(back.trace.steps.every((s) => s.http === undefined)).toBe(true); // raw payloads off by default
  });

  it('strips the system prompt by default, keys and notes always', () => {
    const link = encodeShareLink(leaky, 'https://example.test/', { secrets: [TEST_KEY] });
    const back = decodeShareFragment(new URL(link).hash);
    const json = JSON.stringify(back);
    expect(json).not.toContain('TOP SECRET');
    expect(back.config.system).toBe(SYSTEM_REMOVED);
    expect(json).not.toContain(TEST_KEY);
    expect(link).not.toContain(TEST_KEY);
    expect(back.notes).toBeUndefined();
  });

  it('removes copies of the redacted system prompt from the trace', () => {
    const secretPrompt = 'confidential custom system phrase 99887';
    const run: Run = {
      ...SAMPLE_RUN,
      config: { ...SAMPLE_RUN.config, system: secretPrompt },
      trace: {
        ...SAMPLE_RUN.trace,
        steps: SAMPLE_RUN.trace.steps.map((step) =>
          step.type === 'system' ? { ...step, input: { prompt: secretPrompt }, output: secretPrompt } : step,
        ),
      },
    };
    const link = encodeShareLink(run, 'https://example.test/', { secrets: [secretPrompt] });
    const shared = JSON.stringify(decodeShareFragment(new URL(link).hash));
    expect(shared).not.toContain(secretPrompt);
    expect(shared).toContain(SYSTEM_REMOVED);
  });

  it('JSON export keeps raw payloads but never keys', () => {
    const json = exportRunJson(leaky, { secrets: [TEST_KEY] });
    expect(json).not.toContain(TEST_KEY);
    expect(importRunJson(json).trace.steps.some((s) => s.http)).toBe(true);
    expect(sanitizeRunForShare(leaky).config.messages[0]!.content).toContain('[REDACTED]');
  });

  it('rejects malformed imports', () => {
    expect(() => importRunJson('{')).toThrow(/Not valid JSON/);
    expect(() => importRunJson('{"schema":"x"}')).toThrow(/Invalid run file/);
    expect(() => decodeShareFragment('#share=!!!')).toThrow(/corrupted/);
    expect(() => decodeShareFragment('#nothing')).toThrow(/No shared run/);
  });

  it('rejects runs missing required config, trace, step, and metric fields', () => {
    const invalid = {
      schema: 'runtime-lab/run@1',
      id: 'broken',
      config: { model: 'm' },
      trace: { steps: [] },
    };
    expect(() => importRunJson(JSON.stringify(invalid))).toThrow(/createdAt[\s\S]*config.provider[\s\S]*config.messages[\s\S]*trace.id[\s\S]*trace.totalTokens/);

    const invalidStep = {
      ...SAMPLE_RUN,
      trace: { ...SAMPLE_RUN.trace, steps: [{ type: 'model' }] },
    };
    expect(() => importRunJson(JSON.stringify(invalidStep))).toThrow(/trace.steps\[0\] is invalid/);
  });

  it('handles non-ASCII text', () => {
    const thai: Run = { ...SAMPLE_RUN, title: 'ทดสอบ ✓' };
    expect(decodeShareFragment(new URL(encodeShareLink(thai, 'https://x.test/')).hash).title).toBe('ทดสอบ ✓');
  });
});
