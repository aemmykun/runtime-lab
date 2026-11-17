import type { JsonValue, MockHandler, ToolDefinition } from './types.js';
import { validateJsonSchema } from './jsonSchema.js';
import { jsonEqual } from './json.js';

export type MockOutcome = { ok: true; result: JsonValue } | { ok: false; error: string };

function matches(when: Record<string, JsonValue>, args: Record<string, unknown>): boolean {
  return Object.entries(when).every(([k, v]) => Object.hasOwn(args, k) && jsonEqual(args[k], v));
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Answers a tool call from its declarative JSON mock. No user code is ever executed. */
export function runMock(handler: MockHandler, args: Record<string, unknown>): MockOutcome {
  switch (handler.type) {
    case 'static':
      return { ok: true, result: handler.result };
    case 'error':
      return { ok: false, error: handler.message };
    case 'match': {
      const hit = handler.cases.find((c) => matches(c.when, args));
      if (hit) return { ok: true, result: hit.result };
      if (handler.default !== undefined) return { ok: true, result: handler.default };
      return { ok: false, error: `No mock case matched arguments ${JSON.stringify(args)}` };
    }
  }
}

/** Validates a user-supplied tools JSON document. Returns readable errors rather than throwing. */
export function parseToolDefinitions(json: string): { tools: ToolDefinition[]; errors: string[] } {
  const errors: string[] = [];
  let data: unknown;
  try {
    data = JSON.parse(json || '[]');
  } catch (e) {
    return { tools: [], errors: [`Tools JSON is not valid JSON: ${(e as Error).message}`] };
  }
  if (!Array.isArray(data)) return { tools: [], errors: ['Tools JSON must be an array of tool definitions'] };
  const names = new Set<string>();
  data.forEach((t, i) => {
    const tool = t as Partial<ToolDefinition>;
    const where = `tools[${i}]`;
    if (!tool || typeof tool !== 'object') return errors.push(`${where} must be an object`);
    if (typeof tool.name !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(tool.name)) errors.push(`${where}.name must match ^[A-Za-z0-9_-]{1,64}$`);
    else if (names.has(tool.name)) errors.push(`${where}.name "${tool.name}" is duplicated`);
    else names.add(tool.name);
    if (!tool.parameters || !isRecord(tool.parameters)) errors.push(`${where}.parameters must be a JSON Schema object`);
    const m = tool.mock as MockHandler | undefined;
    if (!isRecord(m) || !['static', 'match', 'error'].includes((m as { type?: string }).type ?? '')) errors.push(`${where}.mock.type must be "static", "match" or "error"`);
    else if (m.type === 'static' && !Object.hasOwn(m, 'result')) errors.push(`${where}.mock.result is required`);
    else if (m.type === 'match') {
      if (!Array.isArray(m.cases)) errors.push(`${where}.mock.cases must be an array`);
      else m.cases.forEach((c, j) => {
        if (!isRecord(c)) errors.push(`${where}.mock.cases[${j}] must be an object`);
        else {
          if (!isRecord(c.when)) errors.push(`${where}.mock.cases[${j}].when must be an object`);
          if (!Object.hasOwn(c, 'result')) errors.push(`${where}.mock.cases[${j}].result is required`);
        }
      });
    } else if (m.type === 'error' && typeof m.message !== 'string') errors.push(`${where}.mock.message must be a string`);
    if (tool.description !== undefined && typeof tool.description !== 'string') errors.push(`${where}.description must be a string`);
    if (tool.mockLatencyMs !== undefined && (typeof tool.mockLatencyMs !== 'number' || !Number.isFinite(tool.mockLatencyMs) || tool.mockLatencyMs < 0))
      errors.push(`${where}.mockLatencyMs must be a non-negative number`);
    return undefined;
  });
  return { tools: errors.length ? [] : (data as ToolDefinition[]), errors };
}

/** Parses and schema-checks model-produced tool arguments. */
export function checkToolArguments(tool: ToolDefinition, raw: string): { args?: Record<string, unknown>; errors: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw || '{}');
  } catch (e) {
    return { errors: [`Arguments are not valid JSON: ${(e as Error).message}`] };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { errors: ['Arguments must be a JSON object'] };
  const issues = validateJsonSchema(parsed, tool.parameters);
  return { args: parsed as Record<string, unknown>, errors: issues.map((i) => `${i.path} ${i.message}`) };
}
