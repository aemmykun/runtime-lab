import type { JsonSchema } from './types.js';
import { jsonEqual } from './json.js';

/**
 * A deliberately small, eval-free JSON Schema validator. Runtime Lab ships a
 * strict Content-Security-Policy without 'unsafe-eval', so code-generating
 * validators (such as Ajv) cannot run in the browser.
 *
 * Supported keywords: type, properties, required, additionalProperties (boolean),
 * items, enum, const, minimum, maximum, minLength, maxLength, minItems,
 * maxItems, pattern. Anything else is ignored.
 */
export interface SchemaIssue {
  path: string;
  message: string;
}

function typeOf(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function matchesType(v: unknown, t: string): boolean {
  switch (t) {
    case 'integer':
      return typeof v === 'number' && Number.isInteger(v);
    case 'number':
      return typeof v === 'number' && Number.isFinite(v);
    case 'object':
      return typeOf(v) === 'object';
    default:
      return typeOf(v) === t;
  }
}

export function validateJsonSchema(value: unknown, schema: JsonSchema, path = '$'): SchemaIssue[] {
  const issues: SchemaIssue[] = [];
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => matchesType(value, t))) {
      issues.push({ path, message: `expected ${types.join(' | ')}, got ${typeOf(value)}` });
      return issues;
    }
  }
  if (schema.const !== undefined && !jsonEqual(value, schema.const)) {
    issues.push({ path, message: `expected const ${JSON.stringify(schema.const)}` });
  }
  if (schema.enum && !schema.enum.some((e) => jsonEqual(e, value))) {
    issues.push({ path, message: `expected one of ${JSON.stringify(schema.enum)}` });
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) issues.push({ path, message: `must be >= ${schema.minimum}` });
    if (schema.maximum !== undefined && value > schema.maximum) issues.push({ path, message: `must be <= ${schema.maximum}` });
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) issues.push({ path, message: `length must be >= ${schema.minLength}` });
    if (schema.maxLength !== undefined && value.length > schema.maxLength) issues.push({ path, message: `length must be <= ${schema.maxLength}` });
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) issues.push({ path, message: `must match /${schema.pattern}/` });
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) issues.push({ path, message: `must have >= ${schema.minItems} items` });
    if (schema.maxItems !== undefined && value.length > schema.maxItems) issues.push({ path, message: `must have <= ${schema.maxItems} items` });
    if (schema.items) value.forEach((item, i) => issues.push(...validateJsonSchema(item, schema.items!, `${path}[${i}]`)));
  }
  if (typeOf(value) === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(obj, key)) issues.push({ path: `${path}.${key}`, message: 'is required' });
    }
    for (const [key, sub] of Object.entries(schema.properties ?? {})) {
      if (Object.hasOwn(obj, key)) issues.push(...validateJsonSchema(obj[key], sub, `${path}.${key}`));
    }
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties ?? {}));
      for (const key of Object.keys(obj)) {
        if (!allowed.has(key)) issues.push({ path: `${path}.${key}`, message: 'is not allowed' });
      }
    }
  }
  return issues;
}
