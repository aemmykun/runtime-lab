import type { PriceTable, ProviderId } from './types.js';

/** Official public pricing pages used to check the default table. */
export const PRICE_SOURCES: Partial<Record<ProviderId, string>> = {
  openai: 'https://developers.openai.com/api/docs/pricing',
  anthropic: 'https://platform.claude.com/docs/en/about-claude/pricing',
};

/**
 * Default price table. Guide only: standard (non-batch, short-context,
 * uncached) USD list prices per 1M tokens, checked against each provider's
 * public pricing page on 2026-11-18 (AEDT). Runtime Lab is independent and
 * has no affiliation with or stake in any provider. Always confirm current
 * prices on the provider's site. Caching, batch, long-context and regional
 * pricing are not modelled. Claude Haiku 5.5 uses the official rate for
 * prompts up to 100,000 tokens. Users can edit this table in Settings.
 */
export const DEFAULT_PRICE_TABLE: PriceTable = {
  note:
    "Prices are a guide only, checked against each provider's public pricing page on 18 Nov 2026 AEDT. Runtime Lab is independent and has no affiliation with or stake in any provider. Always confirm current prices on the provider's site.",
  checkedAt: '2026-11-18',
  sources: { ...PRICE_SOURCES },
  prices: {
    'openai:gpt-5-mini': { inputPerMTok: 0.25, outputPerMTok: 2.0 },
    'openai:gpt-5-nano': { inputPerMTok: 0.05, outputPerMTok: 0.4 },
    'openai:gpt-5': { inputPerMTok: 1.25, outputPerMTok: 10.0 },
    'openai:gpt-4.1-mini': { inputPerMTok: 0.4, outputPerMTok: 1.6 },
    'openai:gpt-4o-mini': { inputPerMTok: 0.15, outputPerMTok: 0.6 },
    'anthropic:claude-haiku-5-5': { inputPerMTok: 0.1, outputPerMTok: 0.5 },
    'anthropic:claude-sonnet-5-5': { inputPerMTok: 2.0, outputPerMTok: 10.0 },
    'anthropic:claude-opus-5-5': { inputPerMTok: 4.0, outputPerMTok: 20.0 },
  },
};
