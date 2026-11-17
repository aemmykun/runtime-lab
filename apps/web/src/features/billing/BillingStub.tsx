import { CreditCard } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { PRODUCT_NAME } from '~/lib/config';

/**
 * Placeholder for future paid tiers. There is NO backend, account system or
 * billing in this build. See docs/SUPABASE_SCHEMA.md for the planned design.
 */
export const BILLING_ENABLED = false;

export function BillingStub() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="size-4" /> Plans
        </CardTitle>
        <CardDescription>{PRODUCT_NAME} is free and runs entirely in your browser. There are no accounts, no billing and no backend in this build.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-slate-400">
        Team sync, scheduled regression runs and enterprise tool mocks are on the roadmap as possible paid tiers. They are not built yet. The planned design keeps API keys and prompt
        history out of any server.
      </CardContent>
    </Card>
  );
}
