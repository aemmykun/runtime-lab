import { useEffect, useState } from 'react';
import { cn } from '~/lib/utils';
import { applyTheme, persistThemePreference, readThemePreference, type ThemePreference } from '~/lib/theme';

const OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>('system');

  useEffect(() => {
    const initial = readThemePreference();
    setPreference(initial);
    applyTheme(initial);
    if (initial !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const choose = (next: ThemePreference) => {
    setPreference(next);
    persistThemePreference(next);
  };

  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-md border border-border bg-card p-0.5 text-xs">
      {OPTIONS.map((opt) => {
        const selected = preference === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => choose(opt.value)}
            className={cn(
              'rounded px-2 py-1 font-medium',
              selected ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
