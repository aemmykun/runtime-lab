import { ASSERTION_TYPES, evaluateAssertion, type Assertion, type AssertionResult } from './assertions.js';
import { parseToolDefinitions } from './mockTools.js';
import { isProviderId } from './providers.js';
import { executeRun } from './traceEngine.js';
import type { PriceTable, ProviderAdapter, ProviderId, Run, RunConfig, ToolDefinition } from './types.js';

export interface SuiteTest {
  name: string;
  prompt: string;
  provider?: ProviderId;
  model?: string;
  system?: string;
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  maxTurns?: number;
  assertions: Assertion[];
}

export interface Suite {
  schema?: 'runtime-lab/suite@1';
  name: string;
  defaults?: Partial<Omit<SuiteTest, 'name' | 'prompt' | 'assertions'>>;
  tests: SuiteTest[];
}

export interface TestResult {
  name: string;
  pass: boolean;
  assertions: AssertionResult[];
  run: Run;
}

export interface SuiteResult {
  name: string;
  passed: number;
  failed: number;
  results: TestResult[];
}

export function parseSuite(json: string): Suite {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (e) {
    throw new Error(`Suite is not valid JSON: ${(e as Error).message}`, { cause: e });
  }
  const s = data as Partial<Suite>;
  const errors: string[] = [];
  if (!s || typeof s !== 'object') throw new Error('Suite must be a JSON object');
  if (typeof s.name !== 'string' || !s.name) errors.push('"name" is required');
  if (!Array.isArray(s.tests) || s.tests.length === 0) errors.push('"tests" must be a non-empty array');
  (s.tests ?? []).forEach((t, i) => {
    const where = `tests[${i}]`;
    if (typeof t?.name !== 'string' || !t.name) errors.push(`${where}.name is required`);
    if (typeof t?.prompt !== 'string' || !t.prompt) errors.push(`${where}.prompt is required`);
    const provider = t?.provider ?? s.defaults?.provider;
    const model = t?.model ?? s.defaults?.model;
    if (!isProviderId(provider)) errors.push(`${where}: provider must be set (in the test or defaults) to a known provider`);
    if (typeof model !== 'string' || !model) errors.push(`${where}: model must be set (in the test or defaults)`);
    if (!Array.isArray(t?.assertions) || t.assertions.length === 0) errors.push(`${where}.assertions must be a non-empty array`);
    (t?.assertions ?? []).forEach((a, j) => {
      if (!ASSERTION_TYPES.includes((a as Assertion)?.type)) errors.push(`${where}.assertions[${j}].type "${(a as { type?: string })?.type}" is not supported`);
    });
    const tools = t?.tools ?? s.defaults?.tools;
    if (tools !== undefined) {
      const parsed = parseToolDefinitions(JSON.stringify(tools));
      errors.push(...parsed.errors.map((e) => `${where}: ${e}`));
    }
  });
  if (errors.length) throw new Error(`Invalid suite:\n- ${errors.join('\n- ')}`);
  return s as Suite;
}

export function testToRunConfig(suite: Suite, test: SuiteTest): RunConfig {
  const d = suite.defaults ?? {};
  return {
    provider: (test.provider ?? d.provider) as ProviderId,
    model: (test.model ?? d.model) as string,
    system: test.system ?? d.system,
    messages: [{ role: 'user', content: test.prompt }],
    tools: test.tools ?? d.tools,
    temperature: test.temperature ?? d.temperature,
    maxTokens: test.maxTokens ?? d.maxTokens,
    maxTurns: test.maxTurns ?? d.maxTurns,
  };
}

export interface SuiteRunOptions {
  getAdapter: (provider: ProviderId) => ProviderAdapter;
  priceTable: PriceTable;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  onResult?: (r: TestResult) => void;
}

export async function runSuite(suite: Suite, opts: SuiteRunOptions): Promise<SuiteResult> {
  const results: TestResult[] = [];
  for (const test of suite.tests) {
    const config = testToRunConfig(suite, test);
    const run = await executeRun(config, { adapter: opts.getAdapter(config.provider), priceTable: opts.priceTable, now: opts.now, sleep: opts.sleep, title: test.name });
    const assertions = test.assertions.map((a) => evaluateAssertion(a, run));
    if (run.trace.status === 'error') {
      const err = run.trace.steps.find((s) => s.error)?.error;
      assertions.unshift({ type: 'no-errors', pass: false, message: `run failed: ${err?.message ?? 'unknown error'}` });
    }
    const r: TestResult = { name: test.name, pass: assertions.every((a) => a.pass), assertions, run };
    results.push(r);
    opts.onResult?.(r);
  }
  const passed = results.filter((r) => r.pass).length;
  return { name: suite.name, passed, failed: results.length - passed, results };
}
