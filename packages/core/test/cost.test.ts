import { describe, expect, it } from 'vitest';
import { estimateCost, formatUsd, parsePriceTable } from '../src/cost.js';
import { DEFAULT_PRICE_TABLE } from '../src/prices.js';

const table = { note: 't', prices: { 'openai:m': { inputPerMTok: 2, outputPerMTok: 10 }, bare: { inputPerMTok: 1, outputPerMTok: 1 } } };

describe('cost', () => {
  it('multiplies tokens by per-million prices', () => {
    expect(estimateCost(table, 'openai', 'm', { inputTokens: 1_000_000, outputTokens: 500_000 })).toBe(7);
    expect(estimateCost(table, 'openai', 'm', { inputTokens: 1000, outputTokens: 100 })).toBeCloseTo(0.003, 10);
  });
  it('falls back to bare model id, and returns null when unknown', () => {
    expect(estimateCost(table, 'groq', 'bare', { inputTokens: 1e6, outputTokens: 0 })).toBe(1);
    expect(estimateCost(table, 'openai', 'nope', { inputTokens: 1, outputTokens: 1 })).toBeNull();
  });
  it('formats and parses', () => {
    expect(formatUsd(null)).toMatch(/n\/a/);
    expect(formatUsd(0.5)).toBe('$0.5000');
    expect(() => parsePriceTable('{"prices":{"x":{"inputPerMTok":-1,"outputPerMTok":1}}}')).toThrow(/non-negative/);
    expect(parsePriceTable(JSON.stringify(DEFAULT_PRICE_TABLE)).prices['openai:gpt-5-mini']).toEqual({ inputPerMTok: 0.25, outputPerMTok: 2 });
  });
  it('default table is labelled as estimates', () => {
    expect(DEFAULT_PRICE_TABLE.note).toMatch(/Estimates only/);
  });
});
