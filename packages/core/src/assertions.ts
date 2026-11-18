import { validateJsonSchema } from './jsonSchema.js';
import type { JsonSchema, Run } from './types.js';

export type Assertion =
  | { type: 'contains'; value: string; caseSensitive?: boolean }
  | { type: 'not-contains'; value: string; caseSensitive?: boolean }
  | { type: 'regex'; pattern: string; flags?: string }
  | { type: 'json-schema'; schema: JsonSchema }
  | { type: 'max-latency'; ms: number }
  | { type: 'max-tokens'; tokens: number }
  | { type: 'max-cost'; usd: number }
  | { type: 'tool-called'; name: string }
  | { type: 'no-errors' };

export interface AssertionResult {
  type: Assertion['type'];
  pass: boolean;
  message: string;
}

const norm = (s: string, cs?: boolean) => (cs ? s : s.toLowerCase());

export function evaluateAssertion(a: Assertion, run: Run): AssertionResult {
  const out = run.trace.output;
  const t = run.trace;
  switch (a.type) {
    case 'contains': {
      const pass = norm(out, a.caseSensitive).includes(norm(a.value, a.caseSensitive));
      return { type: a.type, pass, message: pass ? `output contains "${a.value}"` : `output does not contain "${a.value}"` };
    }
    case 'not-contains': {
      const pass = !norm(out, a.caseSensitive).includes(norm(a.value, a.caseSensitive));
      return { type: a.type, pass, message: pass ? `output does not contain "${a.value}"` : `output contains forbidden "${a.value}"` };
    }
    case 'regex': {
      let re: RegExp;
      try {
        re = new RegExp(a.pattern, a.flags);
      } catch (e) {
        return { type: a.type, pass: false, message: `invalid regex: ${(e as Error).message}` };
      }
      const pass = re.test(out);
      return { type: a.type, pass, message: pass ? `output matches /${a.pattern}/${a.flags ?? ''}` : `output does not match /${a.pattern}/${a.flags ?? ''}` };
    }
    case 'json-schema': {
      let data: unknown;
      try {
        data = JSON.parse(out);
      } catch (e) {
        return { type: a.type, pass: false, message: `output is not valid JSON: ${(e as Error).message}` };
      }
      const issues = validateJsonSchema(data, a.schema);
      return {
        type: a.type,
        pass: issues.length === 0,
        message: issues.length ? issues.map((i) => `${i.path} ${i.message}`).join('; ') : 'output matches JSON schema',
      };
    }
    case 'max-latency': {
      const pass = t.totalLatencyMs <= a.ms;
      return { type: a.type, pass, message: `latency ${t.totalLatencyMs}ms ${pass ? '<=' : '>'} ${a.ms}ms` };
    }
    case 'max-tokens': {
      const pass = t.totalTokens <= a.tokens;
      return { type: a.type, pass, message: `tokens ${t.totalTokens} ${pass ? '<=' : '>'} ${a.tokens}` };
    }
    case 'max-cost': {
      if (t.costUsd === null) return { type: a.type, pass: false, message: 'cost unknown (model missing from price table)' };
      const pass = t.costUsd <= a.usd;
      return { type: a.type, pass, message: `estimated cost $${t.costUsd} ${pass ? '<=' : '>'} $${a.usd}` };
    }
    case 'tool-called': {
      const pass = t.steps.some((s) => s.type === 'tool' && (s.input as { name?: string })?.name === a.name);
      return { type: a.type, pass, message: pass ? `tool "${a.name}" was called` : `tool "${a.name}" was not called` };
    }
    case 'no-errors': {
      const errs = t.steps.filter((s) => s.error);
      return { type: a.type, pass: errs.length === 0, message: errs.length ? `${errs.length} step error(s): ${errs[0]!.error!.message}` : 'no step errors' };
    }
    default: {
      const unknown = a as { type?: string };
      return { type: unknown.type as Assertion['type'], pass: false, message: `unknown assertion type "${unknown.type}"` };
    }
  }
}

export const ASSERTION_TYPES: Assertion['type'][] = [
  'contains',
  'not-contains',
  'regex',
  'json-schema',
  'max-latency',
  'max-tokens',
  'max-cost',
  'tool-called',
  'no-errors',
];
