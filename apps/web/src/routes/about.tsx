import { createFileRoute } from '@tanstack/react-router';
import { CreatorSection, ProviderSupportTable, SupportSection } from '~/components/AboutSections';
import { BillingStub } from '~/features/billing/BillingStub';
import { PRODUCT_NAME, PRODUCT_TAGLINE, REPO_URL } from '~/lib/config';

function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">About {PRODUCT_NAME}</h1>
        <p className="text-slate-400">{PRODUCT_TAGLINE}. Open source under the MIT licence.</p>
        <p className="text-sm">
          Source code:{' '}
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">
            {REPO_URL}
          </a>
        </p>
      </div>
      <CreatorSection />
      <SupportSection />
      <ProviderSupportTable />
      <BillingStub />
    </div>
  );
}

export const Route = createFileRoute('/about')({ component: AboutPage });
