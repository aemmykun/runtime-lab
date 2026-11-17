import { describe, expect, it } from 'vitest';
import { main, type CliIO } from '../src/main.js';

const suite = {
  name: 'smoke',
  defaults: { provider: 'openai', model: 'gpt-5-mini' },
  tests: [
    { name: 'greets', prompt: 'hi', assertions: [{ type: 'contains', value: 'hello' }] },
    { name: 'short', prompt: 'hi', assertions: [{ type: 'max-tokens', tokens: 100 }] },
  ],
};

function io(responses: string[], files: Record<string, string> = { 'suite.json': JSON.stringify(suite) }, env: Record<string, string> = { OPENAI_API_KEY: 'sk-test-cli-0000000000000000' }) {
  const out: string[] = [];
  const err: string[] = [];
  const urls: string[] = [];
  const written: Record<string, string> = {};
  let i = 0;
  const x: CliIO = {
    stdout: (s) => out.push(s),
    stderr: (s) => err.push(s),
    readFile: async (p) => {
      if (!(p in files)) throw new Error(`ENOENT ${p}`);
      return files[p]!;
    },
    writeFile: async (p, d) => {
      written[p] = d;
    },
    fetch: async (url) => {
      urls.push(url);
      return new Response(JSON.stringify({ choices: [{ message: { content: responses[i++] ?? '' } }], usage: { prompt_tokens: 5, completion_tokens: 5 } }));
    },
    env,
  };
  return { x, out, err, urls, written };
}

describe('runtimes-lab CLI', () => {
  it('exits 0 when every test passes', async () => {
    const t = io(['hello world', 'ok']);
    expect(await main(['run', 'suite.json'], t.x)).toBe(0);
    expect(t.out.join('\n')).toMatch(/2 passed, 0 failed/);
    expect(t.urls.every((u) => u.startsWith('https://api.openai.com/'))).toBe(true);
  });

  it('exits 1 when a test fails and explains why', async () => {
    const t = io(['nope', 'ok']);
    expect(await main(['run', 'suite.json'], t.x)).toBe(1);
    expect(t.out.join('\n')).toMatch(/FAIL {2}greets[\s\S]*output does not contain "hello"/);
  });

  it('exits 2 when the key env var is missing, without calling the network', async () => {
    const t = io([], undefined, {});
    expect(await main(['run', 'suite.json'], t.x)).toBe(2);
    expect(t.err.join('\n')).toMatch(/OPENAI_API_KEY/);
    expect(t.urls).toHaveLength(0);
  });

  it('exits 2 on invalid suites and usage errors', async () => {
    expect(await main(['run', 'missing.json'], io([]).x)).toBe(2);
    expect(await main(['run', 'bad.json'], io([], { 'bad.json': '{"name":"x","tests":[]}' }).x)).toBe(2);
    expect(await main(['frobnicate'], io([]).x)).toBe(2);
    expect(await main(['run', 'suite.json', '--nope'], io([]).x)).toBe(2);
  });

  it('validate, --json and --out', async () => {
    const v = io([]);
    expect(await main(['validate', 'suite.json'], v.x)).toBe(0);
    const t = io(['hello', 'ok']);
    expect(await main(['run', 'suite.json', '--json', '--out', 'r.json'], t.x)).toBe(0);
    const parsed = JSON.parse(t.out.join('\n'));
    expect(parsed).toMatchObject({ passed: 2, failed: 0 });
    expect(JSON.parse(t.written['r.json']!).results).toHaveLength(2);
    expect(t.written['r.json']).not.toContain('sk-test-cli');
  });

  it('prints help and version', async () => {
    const t = io([]);
    expect(await main(['--help'], t.x)).toBe(0);
    expect(t.out[0]).toMatch(/OPENAI_API_KEY[\s\S]*ANTHROPIC_API_KEY/);
  });
});
