import { PROVIDERS, type ProviderId } from '@runtime-lab/core';
import { KeyRound, ShieldAlert } from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import { Input, Label, Select } from '~/components/ui/input';
import { forgetKey, rememberKey } from '~/db/repo';
import { useSessionStore } from '~/stores/session-store';

export function ProviderSelect({ provider, onProvider }: { provider: ProviderId; onProvider: (p: ProviderId) => void }) {
  const info = PROVIDERS[provider];
  const key = useSessionStore((s) => s.keys[provider] ?? '');
  const remembered = useSessionStore((s) => !!s.remembered[provider]);
  const setKey = useSessionStore((s) => s.setKey);
  const setRemembered = useSessionStore((s) => s.setRemembered);

  const onKey = (v: string) => {
    setKey(provider, v);
    if (remembered) void (v ? rememberKey(provider, v) : forgetKey(provider));
  };
  const onRemember = (on: boolean) => {
    setRemembered(provider, on);
    void (on && key ? rememberKey(provider, key) : forgetKey(provider));
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="provider">Provider</Label>
      <Select id="provider" value={provider} onChange={(e) => onProvider(e.target.value as ProviderId)}>
        {Object.values(PROVIDERS).map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
            {p.browser === 'local-cors-required' ? ' (local, needs CORS)' : ''}
          </option>
        ))}
      </Select>
      <p className="text-xs text-slate-400">
        <Badge variant={info.browser === 'supported' ? 'success' : 'warn'} className="mr-1">
          {info.browser === 'supported' ? 'browser direct' : 'local only'}
        </Badge>
        {info.browserNote}
      </p>
      {info.requiresKey && (
        <div className="space-y-1">
          <Label htmlFor="apikey" className="flex items-center gap-1">
            <KeyRound className="size-3" /> {info.label} API key
          </Label>
          <Input
            id="apikey"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={`Paste your ${info.label} key`}
            value={key}
            onChange={(e) => onKey(e.target.value)}
          />
          <label className="flex items-start gap-2 text-xs text-slate-400">
            <input type="checkbox" className="mt-0.5" checked={remembered} onChange={(e) => onRemember(e.target.checked)} />
            <span>
              Remember on this device. <ShieldAlert className="inline size-3 text-amber-400" /> Off by default: the key lives in memory and is gone when you close the tab. If you
              turn this on, the key is stored unencrypted in this browser&apos;s IndexedDB, where any script running on this origin or anyone with access to this browser
              profile can read it. Use a restricted, low-limit key.
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
