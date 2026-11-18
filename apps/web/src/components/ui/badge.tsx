import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '~/lib/utils';

const badgeVariants = cva('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', {
  variants: {
    variant: {
      default: 'bg-slate-800 text-slate-200',
      success: 'bg-emerald-950 text-emerald-300 ring-1 ring-emerald-800',
      error: 'bg-red-950 text-red-300 ring-1 ring-red-800',
      warn: 'bg-amber-950 text-amber-300 ring-1 ring-amber-800',
      info: 'bg-sky-950 text-sky-300 ring-1 ring-sky-800',
      tool: 'bg-violet-950 text-violet-300 ring-1 ring-violet-800',
    },
  },
  defaultVariants: { variant: 'default' },
});

export function Badge({ className, variant, ...p }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...p} />;
}
