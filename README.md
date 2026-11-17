# Runtime Lab

**The Runtime Debugger & Lab Notebook for LLM Engineers.**

> Your AI Worked. But Do You Know Why?

Runtime Lab reveals the full execution path behind every model response. Trace
prompts, tool calls, errors, latency, token usage and estimated costs while
keeping your API keys under your control.

It is an observability tool, not a chat UI: you run a prompt (with tools
answered by JSON mocks) and get a step-by-step trace you can inspect, compare,
annotate, export to code and share.

- **Local-first and zero-trust.** A static site with no backend. Your browser
  calls the provider directly with your own key. A Content-Security-Policy only
  allows connections to provider APIs. No telemetry.
- **Guest mode by default.** No sign-up. Paste a key and run, or open the
  built-in sample trace without any key.

Source: <https://github.com/aemmykun/runtime-lab> · Licence: MIT · Status: v0.1 (first PR)

---

## Contents

- [What works today](#what-works-today)
- [Quick start](#quick-start)
- [Architecture](#architecture)
- [Security model](#security-model)
- [Providers](#providers)
- [Test suites and the CLI](#test-suites-and-the-cli)
- [Export and share](#export-and-share)
- [Honest limitations](#honest-limitations)
- [Roadmap](#roadmap)
- [Deploying](#deploying)
- [About the creator](#about-the-creator)
- [Support / Sponsor](#support--sponsor)

## What works today

| Area | Status |
| --- | --- |
| Provider execution from the browser: OpenAI, Anthropic, OpenRouter, Groq, Mistral, Gemini; Ollama locally | Done |
| Tool calling with JSON tool definitions and declarative mock handlers (`static`, `match`, `error`), multi-turn tool loop | Done |
| Execution timeline: system / model / tool / validation steps, per-step latency, tokens, estimated cost | Done |
| Raw request/response payloads with secrets redacted | Done |
| Exact provider errors (HTTP status, provider code, raw body), network/CORS errors, tool-argument validation errors | Done |
| Metrics charts (latency per step, tokens per turn, cumulative cost) | Done |
| Agent/tool graph (React Flow) | Done |
| Saved traces in IndexedDB, projects, experiments (title, hypothesis, notes), run notes, history | Done |
| Compare two runs: config diff, metric deltas, output line diff, step sequence | Done |
| Export to TypeScript (official SDK), Vercel AI SDK `generateText`, Python | Done |
| Run JSON import/export, URL-fragment share links, static SVG trace card | Done |
| Editable price table (estimates, clearly labelled) | Done |
| JSON test suites + `runtime-lab` CLI (exit non-zero on failure) | Done (not published to npm) |
| Built-in sample trace (synthetic fixture) | Done |
| PNG trace cards, embeddable live cards | Roadmap |
| In-app suite runner, scheduled regression runs, MCP, GitHub Action | Roadmap |
| Accounts, teams, billing (Supabase) | Design only: [docs/SUPABASE_SCHEMA.md](docs/SUPABASE_SCHEMA.md) |

## Quick start

Requires Node.js 22.18+ (the build scripts use Node's built-in TypeScript type stripping; CI uses Node 24).

```bash
npm ci
npm run dev          # http://localhost:3000 (dev server has no CSP)
npm run build        # static site in apps/web/dist/client
npm run preview      # serve the built site on http://127.0.0.1:4173
npm run check        # lint + typecheck + tests + build
npm run smoke        # browser smoke test of the built site (needs Chrome; set CHROME_PATH)
```

## Architecture

```
apps/web/                 Static SPA (TanStack Start in SPA mode)
  src/routes/             /, /lab, /sample, /share, /compare, /settings, /about
  src/components/         App shell, landing, about sections, shadcn-style UI primitives
  src/features/
    runtime-lab/          Lab page: prompt editor (TanStack Form), tool config, projects
    traces/               Execution timeline, metrics (Recharts), agent graph (React Flow), diff
    experiments/          Experiment notebook
    providers/            Provider + key selection
    exports/              Code export, JSON, share links, SVG card
    billing/              Stub only (no backend)
  src/stores/             Zustand + immer: trace-store, session-store, settings-store
  src/services/
    trace-engine/         Runs the editor draft, streams steps, saves locally
    adapters/             The only network entry point (guarded fetch)
    exporters/            Export/share re-exports
  src/db/                 Dexie (IndexedDB): projects, experiments, runs, traces, apiKeys, history, settings
  src/lib/                Config (product name, links), CSP, queries (TanStack Query), utils
  scripts/                postbuild (CSP hashes), static server, Chrome smoke test
packages/core/            Framework-free TypeScript shared by the web app and the CLI
packages/cli/             `runtime-lab` CLI
docs/                     Security model, Supabase design, CI template (docs/ci/ci.yml)
examples/suite.json       Example regression suite
```

The pure logic (provider adapters, trace engine, cost, redaction, assertions,
suites, exporters, share encoding, diff) lives in `packages/core` so the
browser and the CLI run exactly the same code. `apps/web/src/services/*` wrap
it for the browser.

### Provider adapters

```ts
interface ProviderAdapter {
  readonly id: ProviderId;
  execute(request: ModelRequest): Promise<ModelResponse>;
}
```

Three wire protocols cover all providers: OpenAI-compatible chat completions
(OpenAI, OpenRouter, Groq, Mistral, Ollama), Anthropic Messages, and Gemini
`generateContent`. Errors are thrown as `ProviderError` carrying the provider's
own message, HTTP status, code and raw (redacted) body.

### Trace model

```ts
interface Trace {
  id: string; startedAt: number; completedAt: number;
  totalLatencyMs: number; totalTokens: number; costUsd: number | null;
  steps: TraceStep[];
  // extensions: inputTokens, outputTokens, status, output
}
interface TraceStep {
  id: string; type: 'model' | 'tool' | 'system' | 'validation';
  startedAt: number; endedAt: number; input: unknown; output: unknown; error?: StepError;
  // extensions: label, latencyMs, usage, costUsd, http (redacted raw exchange)
}
interface Experiment { id: string; title: string; hypothesis: string; notes: string; traces: string[] }
```

`traces` in an experiment holds run ids; each run owns exactly one trace.

### Run flow

1. The editor draft becomes a `RunConfig` (tools JSON is validated first).
2. The trace engine records a `system` step, calls the adapter, records a
   `model` step, answers each tool call from its mock (after validating the
   arguments against the tool's JSON Schema), records `tool` or `validation`
   steps, and feeds results back until the model stops or `maxTurns` is hit.
3. Steps stream into the timeline as they happen. The finished run is scrubbed
   of in-memory keys and saved to IndexedDB.

## Security model

Summary (details and test mapping in [docs/SECURITY.md](docs/SECURITY.md)):

- No backend, no proxy, no telemetry. Requests go from the browser straight to the provider.
- The production build ships a CSP with `default-src 'none'` and a
  `connect-src` that lists only provider API origins. Inline bootstrap scripts
  are allowed by SHA-256 hash only. No `unsafe-eval`.
- API keys are held in memory. "Remember on this device" is opt-in per
  provider and stores the key **unencrypted** in IndexedDB; the UI says so.
- Recorded payloads redact secret headers and key-shaped strings.
- Share links and exports never include keys or notes; the system prompt is
  stripped from links unless you tick the box.

Tests prove the network and key-storage claims: `apps/web/test/no-network.test.ts`,
`apps/web/test/keys-never-stored.test.ts`, and `npm run smoke`, which loads the
built site in Chrome, runs a traced tool call against an intercepted provider
endpoint, checks that Chrome's CSP blocks a foreign host, and inspects the real
IndexedDB and localStorage for the key.

## Providers

CORS was checked with a preflight from a foreign origin on 18 Nov 2026 (AEDT).
Providers can change this at any time; there is deliberately no proxy fallback.

| Provider | Browser | Notes |
| --- | --- | --- |
| OpenAI | Direct | `https://api.openai.com/v1/chat/completions` |
| Anthropic | Direct | Sends `anthropic-dangerous-direct-browser-access: true` |
| OpenRouter | Direct | OpenAI-compatible |
| Groq | Direct | OpenAI-compatible |
| Mistral | Direct | OpenAI-compatible chat completions |
| Gemini | Direct | Native `generateContent` with `x-goog-api-key` |
| Ollama | Local only | `http://localhost:11434/v1`; set `OLLAMA_ORIGINS` to allow the page's origin |

Model ids are free text. The example ids pre-filled in the editor were taken
from the providers' public docs and pricing pages on 18 Nov 2026; verify them
for your account.

## Test suites and the CLI

A suite is JSON:

```json
{
  "schema": "runtime-lab/suite@1",
  "name": "support-agent-regression",
  "defaults": { "provider": "openai", "model": "gpt-5-mini", "tools": [] },
  "tests": [
    { "name": "mentions carrier", "prompt": "Where is ORD-1042?",
      "assertions": [{ "type": "contains", "value": "AusPost" }, { "type": "max-latency", "ms": 30000 }] }
  ]
}
```

Assertions: `contains`, `not-contains`, `regex`, `json-schema`, `max-latency`,
`max-tokens`, `max-cost`, `tool-called`, `no-errors`. A run that fails (for
example a provider error) fails its test even if the assertions would pass.

```bash
npm run build                       # builds core and the CLI
export OPENAI_API_KEY=...           # keys come from env vars only
npx --no-install runtime-lab validate examples/suite.json
npx --no-install runtime-lab run examples/suite.json [--json] [--out results.json] [--prices prices.json]
```

Exit codes: `0` all passed, `1` a test failed, `2` usage or configuration
error (including a missing key variable). Env vars: `OPENAI_API_KEY`,
`ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `MISTRAL_API_KEY`,
`GEMINI_API_KEY`, `OLLAMA_API_KEY` (optional).

**`npx runtime-lab run` from outside this repo does not work yet**: the
package is not published to npm. Until it is, run it inside the repo as shown
above (`--no-install` stops npx from looking it up on the registry).

## Export and share

- **Code export** uses the run's actual provider and model: TypeScript with the
  official SDK (`openai`, or `@anthropic-ai/sdk` for Anthropic; Gemini via its
  OpenAI-compatible endpoint), Vercel AI SDK `generateText` (tools wired to
  your mock results), and Python (`openai` / `anthropic`). Keys are read from
  environment variables. Treat the output as a starting point.
- **Run JSON** export/import (raw payloads included, keys and notes removed).
- **Share links** put the run in the URL fragment (`/share#share=…`), which
  browsers never send to a server. Raw payloads are left out to keep links
  short; very long links may be truncated by chat apps.
- **SVG trace card**: a static image with metrics only (no prompt or output).

## Honest limitations

- **Costs are estimates** from an editable price table copied from public
  pricing pages on 18 Nov 2026. Caching, batch, long-context and regional
  pricing are not modelled. Unknown models show `n/a`.
- **Latency is measured in the browser** around each HTTP call, so it includes
  your network.
- **Tools are mocks.** Runtime Lab never executes your code. Mock latency is simulated.
- **No streaming**: each model turn is one non-streaming request; steps appear per turn.
- **JSON Schema support is a subset** (type, properties, required,
  additionalProperties, items, enum, const, min/max, minLength/maxLength,
  minItems/maxItems, pattern), because the CSP forbids eval-based validators.
- **The sample trace is a hand-written synthetic fixture**, not a recording of a real call.
- **Gemini tool-call ids** are generated locally (the API does not return them).
- **Single-user, single-browser.** No sync between devices; clearing site data deletes everything.
- **Only text prompts**; no images or files yet.

## Roadmap

Sprints 4–5 (not in this PR unless marked above): in-app suite runner,
prompt evaluation, trace comparison across many runs, an MCP server, a
GitHub Action wrapping the CLI, PNG and embeddable cards, publishing the CLI to npm.

Possible future paid tiers (not built): **team sync**, **scheduled regression
runs**, **enterprise tool mocks**. The planned Supabase design (users,
organizations, projects, billing_subscriptions) keeps API keys and prompt
history out of the server: [docs/SUPABASE_SCHEMA.md](docs/SUPABASE_SCHEMA.md).

## Deploying

`apps/web/dist/client` is a plain static site. Any static host works.
Configure an SPA fallback so unknown paths serve `index.html` (a Netlify /
Cloudflare Pages `_redirects` file is included). Recommended response headers:
the same CSP as the meta tag plus `frame-ancestors 'none'`,
`X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`.

Nothing is deployed by this PR.

CI: a GitHub Actions template is in [docs/ci/ci.yml](docs/ci/ci.yml); copy it to
`.github/workflows/ci.yml` to enable it.

## About the creator

**Arthit (Arty) Pukhampuang**, Melbourne, Australia.

Arty is a hospitality operations leader turned governance architect. He spent
nearly a decade in Melbourne hospitality, most recently as Executive
Housekeeping Manager at Quest Southbank (Nov 2021 – Feb 2026), where he
planned an operating budget of over A$1M, grew a team of 8 into a stable team
of more than 20, and designed automated rostering and linen-forecasting tools.

As Governance Architect he built [TenantSage™](https://tenantsage.org), an
authority-native governance system for enterprise AI adoption that treats
authority, policy, audit and isolation as the primary product, with retrieval
and generation strictly downstream of governance decisions. He has filed a
patent covering identity-derived access scoping, pre-retrieval governance
enforcement and injection-resistant, deterministic context handling.

He holds a Bachelor of Science (Physiotherapy) from Chiang Mai University and a
Diploma of Leadership & Management (ALTEC).

## Support / Sponsor

Runtime Lab is free and open source. If it saves you debugging time, you can
support its development through GitHub Sponsors:
<https://github.com/sponsors/aemmykun>

You can also star the repo, open issues and send pull requests at
<https://github.com/aemmykun/runtime-lab>.

## Licence

[MIT](LICENSE) © 2026 Arthit (Arty) Pukhampuang
