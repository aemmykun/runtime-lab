# Security model

Runtime Lab is a static single-page app. There is no Runtime Lab server.

## Guarantees in this build (enforced by code and tests)

| Guarantee | How | Test |
| --- | --- | --- |
| The page can only connect to provider APIs | CSP `connect-src` lists only provider origins; `default-src 'none'` | `apps/web/test/no-network.test.ts`, `npm run smoke` (Chrome blocks `fetch('https://example.com')`) |
| All app requests go through one guarded fetch | `services/adapters` wraps fetch with a host allow-list; source scan forbids other network APIs | `no-network.test.ts` |
| No eval | CSP has no `unsafe-eval`; JSON Schema checks use a small hand-written validator instead of Ajv | `no-network.test.ts` |
| Keys are not written to IndexedDB unless you opt in | Keys live in a Zustand store in memory; `saveRun` scrubs in-memory keys before writing | `keys-never-stored.test.ts`, smoke test inspects real IndexedDB/localStorage |
| Recorded payloads are redacted | Secret headers (`authorization`, `x-api-key`, `x-goog-api-key`, …) and key-shaped strings are replaced with `[REDACTED]` | `packages/core/test/redact.test.ts`, `adapters.test.ts` |
| Share links never contain keys or notes; system prompt is stripped by default | `sanitizeRunForShare` | `share.test.ts`, `keys-never-stored.test.ts` |
| No telemetry | No analytics code; CSP would block it anyway | as above |

## What it does NOT protect against

- **The provider sees your prompts and key.** That is the point of calling it.
- **Cross-site scripting or a malicious browser extension** on the same
  origin could read in-memory keys or a remembered key. The CSP reduces XSS
  risk but cannot remove it.
- **Remembered keys are stored unencrypted** in IndexedDB. Encrypting them with
  a key that also lives in the browser would add little real protection, so we
  say so instead. Use restricted, low-limit keys.
- **A meta-tag CSP cannot set `frame-ancestors`** or other header-only
  directives. [vercel.json](../vercel.json) sends `frame-ancestors 'none'` and
  `X-Frame-Options: DENY` as HTTP headers, plus `nosniff`, `no-referrer` and a
  locked-down `Permissions-Policy`. The script-src hashes stay in the meta tag,
  because they change every build.
- **The dev server (`npm run dev`) has no CSP**, because Vite's dev tooling
  needs inline scripts. Only the production build is hardened.
- **Ollama** is reached over plain `http://localhost:11434`; that only works if
  you set `OLLAMA_ORIGINS` to allow the page's origin.

## Reporting

Please open a private security advisory on the GitHub repository.
