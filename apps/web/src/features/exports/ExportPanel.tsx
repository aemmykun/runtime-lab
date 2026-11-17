import type { Run } from '@runtime-lab/core';
import { Check, Copy, Download, Link2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '~/components/ui/button';
import { Tabs } from '~/components/ui/tabs';
import { PRODUCT_NAME } from '~/lib/config';
import { downloadText } from '~/lib/utils';
import { EXPORT_TARGETS, SHARE_URL_WARN_LENGTH, encodeShareLink, exportRun, exportRunJson, renderTraceCardSvg, type ExportTarget } from '~/services/exporters';
import { currentSecrets } from '~/stores/session-store';

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
    >
      {done ? <Check /> : <Copy />} {done ? 'Copied' : 'Copy'}
    </Button>
  );
}

export function ExportPanel({ run }: { run: Run }) {
  const [target, setTarget] = useState<ExportTarget>('typescript-openai');
  const [includeSystem, setIncludeSystem] = useState(false);
  const code = useMemo(() => exportRun(run.config, target), [run, target]);
  const file = EXPORT_TARGETS.find((t) => t.id === target)!;
  const shareLink = useMemo(
    () => (typeof window === 'undefined' ? '' : encodeShareLink(run, `${window.location.origin}/share`, { includeSystemPrompt: includeSystem, secrets: currentSecrets() })),
    [run, includeSystem],
  );
  const svg = useMemo(() => renderTraceCardSvg(run, PRODUCT_NAME), [run]);

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h4 className="text-sm font-semibold">Export to code</h4>
        <Tabs value={target} onChange={setTarget} items={EXPORT_TARGETS.map((t) => ({ value: t.id, label: t.label }))} />
        <pre className="max-h-96 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-200">{code}</pre>
        <div className="flex gap-2">
          <CopyButton text={code} />
          <Button variant="outline" size="sm" onClick={() => downloadText(file.filename, code)}>
            <Download /> {file.filename}
          </Button>
        </div>
        <p className="text-xs text-slate-500">Generated from this run&apos;s provider, model, prompt and tool definitions. Keys are read from environment variables; tool results are your JSON mocks until you replace them.</p>
      </section>

      <section className="space-y-2">
        <h4 className="text-sm font-semibold">Share</h4>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input type="checkbox" checked={includeSystem} onChange={(e) => setIncludeSystem(e.target.checked)} /> Include system prompt in the link (off by default)
        </label>
        <div className="flex flex-wrap gap-2">
          <CopyButton text={shareLink} />
          <Button variant="outline" size="sm" onClick={() => downloadText(`${run.id}.json`, exportRunJson(run, { includeSystemPrompt: includeSystem, secrets: currentSecrets() }), 'application/json')}>
            <Download /> Run JSON
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadText(`${run.id}-card.svg`, svg, 'image/svg+xml')}>
            <Download /> SVG trace card
          </Button>
        </div>
        <p className="flex items-start gap-1 text-xs text-slate-500">
          <Link2 className="mt-0.5 size-3 shrink-0" />
          The link carries the run in the URL fragment (after #), which browsers do not send to servers. Keys and notes are always removed; raw HTTP payloads are left out of links
          (they stay in the JSON file). Link length: {shareLink.length.toLocaleString()} characters
          {shareLink.length > SHARE_URL_WARN_LENGTH ? ' – long links may be cut off by some apps; share the JSON file instead.' : '.'}
        </p>
        <img alt="Trace card preview" className="max-w-sm rounded border border-slate-800" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} />
      </section>
    </div>
  );
}
