import { describe, expect, it } from 'vitest';
import { validateJsonSchema } from '../src/jsonSchema.js';

describe('validateJsonSchema', () => {
  const schema = {
    type: 'object' as const,
    properties: {
      name: { type: 'string' as const, minLength: 2, pattern: '^[A-Z]' },
      age: { type: 'integer' as const, minimum: 0, maximum: 150 },
      tags: { type: 'array' as const, items: { type: 'string' as const }, maxItems: 2 },
      kind: { enum: ['a', 'b'] },
    },
    required: ['name'],
    additionalProperties: false,
  };

  it('accepts a valid document', () => {
    expect(validateJsonSchema({ name: 'Ann', age: 3, tags: ['x'], kind: 'a' }, schema)).toEqual([]);
  });

  it('reports every issue with a path', () => {
    const issues = validateJsonSchema({ name: 'a', age: 1.5, tags: ['x', 2, 'z'], kind: 'c', extra: 1 }, schema);
    const paths = issues.map((i) => i.path);
    expect(paths).toContain('$.name');
    expect(paths).toContain('$.age');
    expect(paths).toContain('$.tags');
    expect(paths).toContain('$.tags[1]');
    expect(paths).toContain('$.kind');
    expect(paths).toContain('$.extra');
  });

  it('requires required keys and checks top-level type', () => {
    expect(validateJsonSchema({}, schema)[0]).toEqual({ path: '$.name', message: 'is required' });
    expect(validateJsonSchema([], schema)[0]?.message).toMatch(/expected object, got array/);
  });
});
