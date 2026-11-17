/// <reference types="vite/client" />
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router';
import { useEffect, useState, type ReactNode } from 'react';
import { AppShell } from '~/components/AppShell';
import { loadRememberedKeys } from '~/db/repo';
import { CSP_PLACEHOLDER } from '~/lib/csp';
import { PRODUCT_NAME, PRODUCT_TAGLINE } from '~/lib/config';
import { useSessionStore } from '~/stores/session-store';
import { useSettingsStore } from '~/stores/settings-store';
import appCss from '~/styles.css?url';

const description =
  'Trace prompts, tool calls, errors, latency, token usage and estimated costs. A local-first runtime debugger and lab notebook for LLM engineers. Runs in your browser with your own key.';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      // Only in the prerendered shell: scripts/postbuild.ts replaces the placeholder with the real
      // policy (including hashes of the inline bootstrap scripts). The browser applies it once at load.
      ...(typeof window === 'undefined' ? [{ httpEquiv: 'Content-Security-Policy', content: CSP_PLACEHOLDER }] : []),
      { name: 'referrer', content: 'no-referrer' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: `${PRODUCT_NAME} | ${PRODUCT_TAGLINE}` },
      { name: 'description', content: description },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: RootComponent,
});

/** Client-only boot: loads settings and any keys the user explicitly chose to remember. */
function Boot() {
  useEffect(() => {
    void useSettingsStore.getState().load();
    void loadRememberedKeys().then((keys) => {
      const s = useSessionStore.getState();
      for (const k of keys) {
        s.setKey(k.provider, k.key);
        s.setRemembered(k.provider, true);
      }
    });
  }, []);
  return null;
}

function RootComponent() {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 5_000, retry: false } } }));
  return (
    <Doc>
      <QueryClientProvider client={qc}>
        <Boot />
        <AppShell>
          <Outlet />
        </AppShell>
      </QueryClientProvider>
    </Doc>
  );
}

function Doc({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-slate-950">
        {children}
        <Scripts />
      </body>
    </html>
  );
}
