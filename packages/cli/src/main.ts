import {
  DEFAULT_PRICE_TABLE,
  PROVIDERS,
  createAdapter,
  guardedFetch,
  parsePriceTable,
  parseSuite,
  runSuite,
  testToRunConfig,
  formatUsd,
  redactDeep,
  redactString,
  type FetchLike,
  type PriceTable,
  type ProviderId,
  type SuiteResult,
} from '@runtime-lab/core';

export const VERSION = '0.1.0';

export interface CliIO {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, data: string) => Promise<void>;
  fetch: FetchLike;
  env: Record<string, string | undefined>;
}

export const HELP = `runtimes-lab ${VERSION}

Usage:
  runtimes-lab run <suite.json> [--json] [--out results.json] [--prices prices.json]
  runtimes-lab validate <suite.json>
  runtimes-lab --help | --version

API keys are read from environment variables only:
${Object.values(PROVIDERS)
  .map((p) => `  ${p.label.padEnd(16)} ${p.keyEnv}${p.requiresKey ? '' : ' (optional)'}`)
  .join('\n')}

Exit codes: 0 all tests passed, 1 one or more tests failed, 2 usage or configuration error.
Requests go only to the provider APIs; there is no telemetry.`;

interface Parsed {
  cmd?: string;
  file?: string;
  json: boolean;
  out?: string;
  prices?: string;
}

function parseArgs(argv: string[]): Parsed | { error: string } | { help: true } | { version: true } {
  const p: Parsed = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--help' || a === '-h') return { help: true };
    if (a === '--version' || a === '-v') return { version: true };
    if (a === '--json') p.json = true;
    else if (a === '--out' || a === '--prices') {
      const v = argv[++i];
      if (!v) return { error: `${a} needs a file path` };
      if (a === '--out') p.out = v;
      else p.prices = v;
    } else if (a.startsWith('-')) return { error: `Unknown option ${a}` };
    else if (!p.cmd) p.cmd = a;
    else if (!p.file) p.file = a;
    else return { error: `Unexpected argument ${a}` };
  }
  return p;
}

export async function main(argv: string[], io: CliIO): Promise<number> {
  const args = parseArgs(argv);
  if ('help' in args) {
    io.stdout(HELP);
    return 0;
  }
  if ('version' in args) {
    io.stdout(VERSION);
    return 0;
  }
  if ('error' in args) {
    io.stderr(`${args.error}\n\n${HELP}`);
    return 2;
  }
  if (!args.cmd || !['run', 'validate'].includes(args.cmd) || !args.file) {
    io.stderr(HELP);
    return 2;
  }

  let suite;
  try {
    suite = parseSuite(await io.readFile(args.file));
  } catch (e) {
    io.stderr(`${(e as Error).message}`);
    return 2;
  }
  if (args.cmd === 'validate') {
    io.stdout(`OK: suite "${suite.name}" with ${suite.tests.length} test(s) is valid.`);
    return 0;
  }

  let priceTable: PriceTable = DEFAULT_PRICE_TABLE;
  if (args.prices) {
    try {
      priceTable = parsePriceTable(await io.readFile(args.prices));
    } catch (e) {
      io.stderr(`Invalid price table: ${(e as Error).message}`);
      return 2;
    }
  }

  const needed = new Set(suite.tests.map((t) => testToRunConfig(suite, t).provider));
  const missing = [...needed].filter((p) => PROVIDERS[p].requiresKey && !io.env[PROVIDERS[p].keyEnv]);
  if (missing.length) {
    io.stderr(`Missing API key environment variable(s): ${missing.map((p) => PROVIDERS[p].keyEnv).join(', ')}`);
    return 2;
  }
  const secrets = [...needed].map((p) => io.env[PROVIDERS[p].keyEnv]).filter((key): key is string => !!key);

  const fetch = guardedFetch(io.fetch);
  const getAdapter = (p: ProviderId) => createAdapter(p, { apiKey: io.env[PROVIDERS[p].keyEnv], fetch });
  if (!args.json) io.stdout(redactString(`Running suite "${suite.name}" (${suite.tests.length} test(s))`, secrets));
  const result: SuiteResult = await runSuite(suite, {
    getAdapter,
    priceTable,
    onResult: (r) => {
      if (args.json) return;
      const t = r.run.trace;
      io.stdout(redactString(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  (${Math.round(t.totalLatencyMs)} ms, ${t.totalTokens} tokens, ${formatUsd(t.costUsd)})`, secrets));
      for (const a of r.assertions) if (!a.pass) io.stdout(redactString(`      ✗ ${a.type}: ${a.message}`, secrets));
    },
  });

  const summary = redactDeep({
    name: result.name,
    passed: result.passed,
    failed: result.failed,
    results: result.results.map((r) => ({
      name: r.name,
      pass: r.pass,
      assertions: r.assertions,
      latencyMs: r.run.trace.totalLatencyMs,
      totalTokens: r.run.trace.totalTokens,
      costUsd: r.run.trace.costUsd,
      output: r.run.trace.output,
      errors: r.run.trace.steps.filter((s) => s.error).map((s) => s.error),
    })),
  }, secrets);
  if (args.out) await io.writeFile(args.out, JSON.stringify(summary, null, 2));
  if (args.json) io.stdout(JSON.stringify(summary, null, 2));
  else io.stdout(`\n${result.passed} passed, ${result.failed} failed`);
  return result.failed > 0 ? 1 : 0;
}
