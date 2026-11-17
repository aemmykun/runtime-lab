import { formatUsd } from './cost.js';
import { PROVIDERS } from './providers.js';
import type { Run } from './types.js';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * A static SVG summary card for a run (no prompt or output text, only metrics),
 * suitable for embedding in a README or post-mortem.
 */
export function renderTraceCardSvg(run: Run, productName: string): string {
  const t = run.trace;
  const tools = t.steps.filter((s) => s.type === 'tool').length;
  const errors = t.steps.filter((s) => s.error).length;
  const ok = t.status === 'ok';
  const rows: Array<[string, string]> = [
    ['Provider', PROVIDERS[run.config.provider]?.label ?? run.config.provider],
    ['Model', run.config.model],
    ['Latency', `${Math.round(t.totalLatencyMs)} ms`],
    ['Tokens', `${t.inputTokens} in / ${t.outputTokens} out`],
    ['Est. cost', formatUsd(t.costUsd)],
    ['Steps', `${t.steps.length} (${tools} tool calls, ${errors} errors)`],
  ];
  const title = trunc(run.title || 'Runtime trace', 48);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 600 300" role="img" aria-label="${esc(`${productName} trace card: ${title}`)}">
  <rect width="600" height="300" rx="16" fill="#0b1020"/>
  <text x="28" y="44" font-family="ui-sans-serif,system-ui,sans-serif" font-size="14" fill="#94a3b8">${esc(productName)} · trace card</text>
  <text x="28" y="76" font-family="ui-sans-serif,system-ui,sans-serif" font-size="22" font-weight="700" fill="#f8fafc">${esc(title)}</text>
  <rect x="470" y="26" width="102" height="28" rx="14" fill="${ok ? '#14532d' : '#7f1d1d'}"/>
  <text x="521" y="45" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="13" font-weight="700" fill="${ok ? '#86efac' : '#fca5a5'}">${ok ? 'OK' : 'ERROR'}</text>
${rows
  .map(
    ([k, v], i) =>
      `  <text x="28" y="${118 + i * 28}" font-family="ui-monospace,monospace" font-size="14" fill="#64748b">${esc(k)}</text>\n  <text x="150" y="${118 + i * 28}" font-family="ui-monospace,monospace" font-size="14" fill="#e2e8f0">${esc(trunc(v, 52))}</text>`,
  )
  .join('\n')}
</svg>`;
}
