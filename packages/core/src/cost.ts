import { PROVIDER_IDS, isProviderId } from './providers.js';
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

function parseSources(value: unknown): PriceTable['sources'] {
  if (!value || typeof value !== 'object') return undefined;
  const out: NonNullable<PriceTable['sources']> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (isProviderId(k) && typeof v === 'string' && /^https:\/\//.test(v)) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export function parsePriceTable(json: string): PriceTable {
  const data: unknown = JSON.parse(json);
  if (!data || typeof data !== 'object') throw new Error('Price table must be an object');
  const { note, prices, checkedAt, sources } = data as { note?: unknown; prices?: unknown; checkedAt?: unknown; sources?: unknown };
  if (!prices || typeof prices !== 'object') throw new Error('Price table needs a "prices" object');
  const out: PriceTable = { note: typeof note === 'string' ? note : '', prices: {} };
  if (typeof checkedAt === 'string' && checkedAt) out.checkedAt = checkedAt;
  const parsedSources = parseSources(sources);
  if (parsedSources) out.sources = parsedSources;
  for (const [k, v] of Object.entries(prices as Record<string, unknown>)) {
    const e = v as Partial<PriceEntry>;
    if (typeof e?.inputPerMTok !== 'number' || typeof e?.outputPerMTok !== 'number' || e.inputPerMTok < 0 || e.outputPerMTok < 0) {
      throw new Error(`Price for "${k}" needs non-negative numbers inputPerMTok and outputPerMTok`);
    }
    out.prices[k] = { inputPerMTok: e.inputPerMTok, outputPerMTok: e.outputPerMTok };
  }
  return out;
}

/** A single editable price-table row. `provider` is empty for a bare model key. */
export interface PriceTableRow {
  provider: ProviderId | '';
  model: string;
  inputPerMTok: number;
  outputPerMTok: number;
}

export function splitPriceKey(key: string): { provider: ProviderId | ''; model: string } {
  const i = key.indexOf(':');
  if (i > 0) {
    const head = key.slice(0, i);
    if (isProviderId(head)) return { provider: head, model: key.slice(i + 1) };
  }
  return { provider: '', model: key };
}

export function makePriceKey(provider: ProviderId | '', model: string): string {
  const m = model.trim();
  return provider ? `${provider}:${m}` : m;
}

const providerOrder = new Map(PROVIDER_IDS.map((id, i) => [id, i]));

/** Rows sorted by provider (known providers first, in PROVIDERS order) then model. */
export function listPriceRows(table: PriceTable): Array<PriceTableRow & { key: string }> {
  const rows = Object.entries(table.prices).map(([key, entry]) => ({
    key,
    ...splitPriceKey(key),
    inputPerMTok: entry.inputPerMTok,
    outputPerMTok: entry.outputPerMTok,
  }));
  rows.sort((a, b) => {
    const pa = a.provider === '' ? PROVIDER_IDS.length + 1 : (providerOrder.get(a.provider) ?? PROVIDER_IDS.length);
    const pb = b.provider === '' ? PROVIDER_IDS.length + 1 : (providerOrder.get(b.provider) ?? PROVIDER_IDS.length);
    if (pa !== pb) return pa - pb;
    return a.model.localeCompare(b.model);
  });
  return rows;
}

export interface PriceRowIssue {
  index: number;
  field: 'provider' | 'model' | 'inputPerMTok' | 'outputPerMTok';
  message: string;
}

export class PriceRowError extends Error {
  readonly issues: PriceRowIssue[];
  constructor(issues: PriceRowIssue[]) {
    super(issues[0]?.message ?? 'Invalid price table');
    this.name = 'PriceRowError';
    this.issues = issues;
  }
}

/** Parse a price field: a finite number >= 0, or a string form of one. */
export function parseNonNegativeNumber(value: number | string): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : undefined;
  const t = value.trim();
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

type PriceRowInput = {
  provider: ProviderId | '';
  model: string;
  inputPerMTok: number | string;
  outputPerMTok: number | string;
};

/** Build a PriceTable from editor rows. Throws PriceRowError when a field is invalid. */
export function priceRowsToTable(rows: PriceRowInput[], meta: Pick<PriceTable, 'note'> & Partial<Pick<PriceTable, 'checkedAt' | 'sources'>>): PriceTable {
  const issues: PriceRowIssue[] = [];
  const prices: PriceTable['prices'] = {};
  rows.forEach((row, index) => {
    const model = row.model.trim();
    if (!model) issues.push({ index, field: 'model', message: 'Model is required' });
    const inputPerMTok = parseNonNegativeNumber(row.inputPerMTok);
    const outputPerMTok = parseNonNegativeNumber(row.outputPerMTok);
    if (inputPerMTok === undefined) issues.push({ index, field: 'inputPerMTok', message: 'Input price must be a non-negative number' });
    if (outputPerMTok === undefined) issues.push({ index, field: 'outputPerMTok', message: 'Output price must be a non-negative number' });
    if (!model || inputPerMTok === undefined || outputPerMTok === undefined) return;
    const key = makePriceKey(row.provider, model);
    if (prices[key]) issues.push({ index, field: 'model', message: `Duplicate entry for ${key}` });
    else prices[key] = { inputPerMTok, outputPerMTok };
  });
  if (issues.length) throw new PriceRowError(issues);
  const out: PriceTable = { note: meta.note, prices };
  if (meta.checkedAt) out.checkedAt = meta.checkedAt;
  if (meta.sources) out.sources = meta.sources;
  return out;
}
