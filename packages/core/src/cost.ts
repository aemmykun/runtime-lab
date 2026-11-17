import type { PriceEntry, PriceTable, ProviderId, TokenUsage } from './types.js';

export function lookupPrice(table: PriceTable, provider: ProviderId, model: string): PriceEntry | undefined {
  return table.prices[`${provider}:${model}`] ?? table.prices[model];
}

/** Estimated USD cost, or null when the model is not in the price table. */
export function estimateCost(table: PriceTable, provider: ProviderId, model: string, usage: TokenUsage): number | null {
  const p = lookupPrice(table, provider, model);
  if (!p) return null;
  const cost = (usage.inputTokens * p.inputPerMTok + usage.outputTokens * p.outputPerMTok) / 1_000_000;
  return Math.round(cost * 1e8) / 1e8;
}

export function formatUsd(cost: number | null | undefined): string {
  if (cost === null || cost === undefined) return 'n/a (no price entry)';
  if (cost === 0) return '$0';
  if (cost < 0.0001) return `$${cost.toExponential(2)}`;
  return `$${cost.toFixed(cost < 0.01 ? 6 : 4)}`;
}

export function parsePriceTable(json: string): PriceTable {
  const data: unknown = JSON.parse(json);
  if (!data || typeof data !== 'object') throw new Error('Price table must be an object');
  const { note, prices } = data as { note?: unknown; prices?: unknown };
  if (!prices || typeof prices !== 'object') throw new Error('Price table needs a "prices" object');
  const out: PriceTable = { note: typeof note === 'string' ? note : '', prices: {} };
  for (const [k, v] of Object.entries(prices as Record<string, unknown>)) {
    const e = v as Partial<PriceEntry>;
    if (typeof e?.inputPerMTok !== 'number' || typeof e?.outputPerMTok !== 'number' || e.inputPerMTok < 0 || e.outputPerMTok < 0) {
      throw new Error(`Price for "${k}" needs non-negative numbers inputPerMTok and outputPerMTok`);
    }
    out.prices[k] = { inputPerMTok: e.inputPerMTok, outputPerMTok: e.outputPerMTok };
  }
  return out;
}
