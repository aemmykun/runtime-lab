import { describe, expect, it } from 'vitest';
import { estimateCost, formatUsd, listPriceRows, parsePriceTable, priceRowsToTable, PriceRowError } from '../src/cost.js';
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
    expect(DEFAULT_PRICE_TABLE.note).toMatch(/guide only/);
    expect(DEFAULT_PRICE_TABLE.note).toMatch(/no affiliation/);
    expect(DEFAULT_PRICE_TABLE.checkedAt).toBe('2026-11-18');
    expect(DEFAULT_PRICE_TABLE.sources?.openai).toMatch(/developers\.openai\.com/);
    expect(DEFAULT_PRICE_TABLE.sources?.anthropic).toMatch(/platform\.claude\.com/);
  });
});

describe('price rows', () => {
  it('lists the default table grouped by provider, then model, without changing values', () => {
    const rows = listPriceRows(DEFAULT_PRICE_TABLE);
    expect(rows.find((r) => r.key === 'openai:gpt-5-mini')).toEqual({
      key: 'openai:gpt-5-mini',
      provider: 'openai',
      model: 'gpt-5-mini',
      inputPerMTok: 0.25,
      outputPerMTok: 2,
    });
    expect(rows[0]!.provider).toBe('openai');
    const openai = rows.filter((r) => r.provider === 'openai');
    const anthropic = rows.filter((r) => r.provider === 'anthropic');
    expect(openai.length).toBeGreaterThan(0);
    expect(anthropic.length).toBeGreaterThan(0);
    expect(rows.map((r) => r.provider).indexOf('anthropic')).toBeGreaterThan(rows.map((r) => r.provider).lastIndexOf('openai'));
    expect(openai.map((r) => r.model)).toEqual([...openai.map((r) => r.model)].sort((a, b) => a.localeCompare(b)));
    expect(priceRowsToTable(rows, DEFAULT_PRICE_TABLE)).toEqual(DEFAULT_PRICE_TABLE);
  });

  it('rejects missing models, negative numbers and duplicates with field issues', () => {
    expect(() => priceRowsToTable([{ provider: 'openai', model: '', inputPerMTok: 1, outputPerMTok: 1 }], { note: '' })).toThrow(PriceRowError);
    try {
      priceRowsToTable([{ provider: 'openai', model: 'm', inputPerMTok: -1, outputPerMTok: 'x' }], { note: '' });
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(PriceRowError);
      const fields = (e as PriceRowError).issues.map((i) => i.field);
      expect(fields).toContain('inputPerMTok');
      expect(fields).toContain('outputPerMTok');
    }
    try {
      priceRowsToTable(
        [
          { provider: 'openai', model: 'm', inputPerMTok: 1, outputPerMTok: 1 },
          { provider: 'openai', model: 'm', inputPerMTok: 2, outputPerMTok: 2 },
        ],
        { note: '' },
      );
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(PriceRowError);
      expect((e as PriceRowError).issues.some((i) => i.field === 'model' && /Duplicate/.test(i.message))).toBe(true);
    }
  });

  it('accepts a bare model key and string numbers', () => {
    const table = priceRowsToTable([{ provider: '', model: ' local-m ', inputPerMTok: '1.5', outputPerMTok: '0' }], { note: 'n' });
    expect(table).toEqual({ note: 'n', prices: { 'local-m': { inputPerMTok: 1.5, outputPerMTok: 0 } } });
    expect(parsePriceTable(JSON.stringify(DEFAULT_PRICE_TABLE)).sources).toEqual(DEFAULT_PRICE_TABLE.sources);
    expect(listPriceRows(table)[0]).toMatchObject({ provider: '', model: 'local-m' });
  });
});
