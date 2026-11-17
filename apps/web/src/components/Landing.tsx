import { Link } from '@tanstack/react-router';
import { Activity, Bug, Code2, Gauge, Lock } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { PRODUCT_NAME, PRODUCT_TAGLINE } from '~/lib/config';

const capabilities = [
  { icon: Activity, title: 'Trace Every Execution', body: 'Inspect every step of an AI workflow, including prompts, tool calls, outputs, and intermediate execution states.' },
  { icon: Bug, title: 'Debug Failures Faster', body: 'See exact provider errors, validation failures, and malformed tool arguments without digging through logs.' },
  { icon: Gauge, title: 'Measure Production Readiness', body: 'Track latency, token consumption, estimated costs, and bottlenecks for every step of a run.' },
  { icon: Code2, title: 'Export with Confidence', body: 'Turn a traced experiment into starting-point TypeScript (OpenAI SDK or Vercel AI SDK) and Python code.' },
];

const facts = [
  'No backend: this is a static site. Requests go from your browser straight to the provider you choose.',
  'A Content-Security-Policy only allows connections to provider APIs, so the page cannot send data anywhere else.',
  'API keys stay in memory by default. Saving a key on this device is opt-in.',
  'Runs, traces and experiments are stored locally in your browser (IndexedDB). No telemetry.',
  'Raw requests and responses are shown with secrets redacted.',
];

export function Landing() {
  return (
    <div className="space-y-16 px-4 py-16">
      <section className="mx-auto max-w-3xl space-y-6 text-center">
        <p className="text-sm font-medium text-sky-400">
          {PRODUCT_NAME} · {PRODUCT_TAGLINE}
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Your AI Worked. But Do You Know Why?</h1>
        <p className="text-lg text-slate-300">
          {PRODUCT_NAME} reveals the full execution path behind every model response. Trace prompts, tool calls, errors, latency, and costs in real time while keeping your API keys
          under your control.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/lab">Open {PRODUCT_NAME}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/sample">Inspect Sample Trace</Link>
          </Button>
        </div>
        <p className="text-xs text-slate-500">No sign-up. Paste a key and run, or open the sample trace without one.</p>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2">
        {capabilities.map((c) => (
          <div key={c.title} className="rounded-lg border border-slate-800 bg-slate-900/50 p-5">
            <c.icon className="mb-3 size-5 text-sky-400" />
            <h2 className="font-semibold">{c.title}</h2>
            <p className="mt-1 text-sm text-slate-400">{c.body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-5xl rounded-xl border border-emerald-900 bg-emerald-950/20 p-8">
        <div className="flex items-center gap-2">
          <Lock className="size-5 text-emerald-400" />
          <h2 className="text-2xl font-bold">Full Observability. Zero Trust.</h2>
        </div>
        <p className="mt-2 text-slate-300">
          {PRODUCT_NAME} keeps secrets under your control while giving you complete visibility into prompts, tool calls, provider responses, errors, latency, and token usage.
        </p>
        <ul className="mt-4 grid gap-2 text-sm text-slate-400 sm:grid-cols-2">
          {facts.map((f) => (
            <li key={f} className="flex gap-2">
              <span className="text-emerald-400">✓</span>
              {f}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
