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

  it('handles non-ASCII text', () => {
    const thai: Run = { ...SAMPLE_RUN, title: 'ทดสอบ ✓' };
    expect(decodeShareFragment(new URL(encodeShareLink(thai, 'https://x.test/')).hash).title).toBe('ทดสอบ ✓');
  });
});
