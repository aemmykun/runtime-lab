import { cn } from '~/lib/utils';

export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: Array<{ value: T; label: string }>; className?: string }) {
  return (
    <div role="tablist" className={cn('inline-flex flex-wrap gap-1 rounded-md bg-slate-900 p-1', className)}>
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={cn('rounded px-3 py-1 text-xs font-medium', value === it.value ? 'bg-secondary text-foreground' : 'text-slate-400 hover:text-slate-200')}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
