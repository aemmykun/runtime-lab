import { PROVIDERS, type ProviderId } from '@runtime-lab/core';
import { useForm } from '@tanstack/react-form';
import { Loader2, Play } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input, Label, Textarea } from '~/components/ui/input';
import { ProviderSelect } from '~/features/providers/ProviderSelect';
import { runDraft } from '~/services/trace-engine';
import { PRODUCT_NAME } from '~/lib/config';
import { useSessionStore, type Draft } from '~/stores/session-store';
import { useTraceStore } from '~/stores/trace-store';
import { ToolConfig } from './ToolConfig';

type FormValues = Omit<Draft, 'toolsJson'>;

export function PromptEditor({ onRan }: { onRan?: () => void }) {
  const draft = useSessionStore((s) => s.draft);
  const setDraft = useSessionStore((s) => s.setDraft);
  const running = useSessionStore((s) => s.running);
  const lastError = useTraceStore((s) => s.lastError);
  const { toolsJson: _t, ...defaults } = draft;

  const form = useForm({
    defaultValues: defaults as FormValues,
    onSubmit: async ({ value }) => {
      setDraft(value);
      await runDraft();
      onRan?.();
    },
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="provider">
        {(field) => (
          <ProviderSelect
            provider={field.state.value}
            onProvider={(p: ProviderId) => {
              field.handleChange(p);
              form.setFieldValue('model', PROVIDERS[p].exampleModel);
              setDraft({ provider: p, model: PROVIDERS[p].exampleModel });
            }}
          />
        )}
      </form.Field>

      <form.Field name="model" validators={{ onChange: ({ value }) => (!value.trim() ? 'Model id is required' : undefined) }}>
        {(field) => (
          <div className="space-y-1">
            <Label htmlFor="model">Model id</Label>
            <Input
              id="model"
              value={field.state.value}
              placeholder="Exact model id from your provider's docs"
              onChange={(e) => {
                field.handleChange(e.target.value);
                setDraft({ model: e.target.value });
              }}
            />
            {field.state.meta.errors.length > 0 && <p className="text-xs text-red-300">{String(field.state.meta.errors[0])}</p>}
          </div>
        )}
      </form.Field>

      <form.Field name="system">
        {(field) => (
          <div className="space-y-1">
            <Label htmlFor="system">System prompt</Label>
            <Textarea
              id="system"
              rows={3}
              value={field.state.value}
              onChange={(e) => {
                field.handleChange(e.target.value);
                setDraft({ system: e.target.value });
              }}
            />
          </div>
        )}
      </form.Field>

      <form.Field name="prompt" validators={{ onChange: ({ value }) => (!value.trim() ? 'Prompt is required' : undefined) }}>
        {(field) => (
          <div className="space-y-1">
            <Label htmlFor="prompt">Prompt</Label>
            <Textarea
              id="prompt"
              rows={5}
              value={field.state.value}
              onChange={(e) => {
                field.handleChange(e.target.value);
                setDraft({ prompt: e.target.value });
              }}
            />
            {field.state.meta.errors.length > 0 && <p className="text-xs text-red-300">{String(field.state.meta.errors[0])}</p>}
          </div>
        )}
      </form.Field>

      <ToolConfig />

      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ['temperature', 'Temperature', 'provider default'],
            ['maxTokens', 'Max tokens', 'default'],
            ['maxTurns', 'Max turns', '5'],
          ] as const
        ).map(([name, label, ph]) => (
          <form.Field key={name} name={name}>
            {(field) => (
              <div className="space-y-1">
                <Label htmlFor={name}>{label}</Label>
                <Input
                  id={name}
                  inputMode="decimal"
                  placeholder={ph}
                  value={field.state.value}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                    setDraft({ [name]: e.target.value });
                  }}
                />
              </div>
            )}
          </form.Field>
        ))}
      </div>

      <form.Field name="title">
        {(field) => (
          <div className="space-y-1">
            <Label htmlFor="title">Run title (optional)</Label>
            <Input
              id="title"
              value={field.state.value}
              onChange={(e) => {
                field.handleChange(e.target.value);
                setDraft({ title: e.target.value });
              }}
            />
          </div>
        )}
      </form.Field>

      {lastError && (
        <pre className="whitespace-pre-wrap rounded-md border border-red-900 bg-red-950/50 p-2 text-xs text-red-200" role="alert">
          {lastError}
        </pre>
      )}

      <Button type="submit" className="w-full" disabled={running}>
        {running ? <Loader2 className="animate-spin" /> : <Play />} {running ? 'Running…' : 'Run and trace'}
      </Button>
      <p className="text-center text-xs text-slate-500">The request goes from this browser straight to {PROVIDERS[draft.provider].label}. Nothing passes through a {PRODUCT_NAME} server; there isn&apos;t one.</p>
    </form>
  );
}
