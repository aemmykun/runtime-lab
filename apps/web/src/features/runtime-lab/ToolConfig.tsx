import { parseToolDefinitions } from '@runtime-lab/core';
import { Wrench } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '~/components/ui/button';
import { Label, Textarea } from '~/components/ui/input';
import { DEFAULT_TOOLS_JSON, useSessionStore } from '~/stores/session-store';

export function ToolConfig() {
  const toolsJson = useSessionStore((s) => s.draft.toolsJson);
  const setDraft = useSessionStore((s) => s.setDraft);
  const parsed = useMemo(() => parseToolDefinitions(toolsJson.trim() || '[]'), [toolsJson]);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="tools" className="flex items-center gap-1">
          <Wrench className="size-3" /> Tool config (JSON definitions + mock handlers)
        </Label>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => setDraft({ toolsJson: DEFAULT_TOOLS_JSON })}>
            Example
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDraft({ toolsJson: '[]' })}>
            No tools
          </Button>
        </div>
      </div>
      <Textarea id="tools" rows={12} spellCheck={false} value={toolsJson} onChange={(e) => setDraft({ toolsJson: e.target.value })} />
      {parsed.errors.length ? (
        <ul className="space-y-0.5 text-xs text-red-300" role="alert">
          {parsed.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-500">
          {parsed.tools.length} tool(s). Mocks answer tool calls: <code>static</code>, <code>match</code> (first case whose <code>when</code> fields equal the arguments) or{' '}
          <code>error</code>. No code is executed. Arguments are checked against <code>parameters</code> (a JSON Schema subset).
        </p>
      )}
    </div>
  );
}
