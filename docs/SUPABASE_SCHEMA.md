# Planned Supabase design (NOT BUILT)

Status: design only. This PR contains **no backend**, no Supabase client, no
auth and no billing. Guest mode is the only mode and needs no server. The
`apps/web/src/features/billing` folder is a stub that renders a "not
available" card.

## Principles

1. **Keys never go server-side.** Provider API keys stay in the browser (memory
   by default, IndexedDB only on opt-in). No table below has a column for a
   provider key, and none may be added.
2. **Prompt history never goes server-side by default.** Traces, prompts,
   outputs and experiments stay in IndexedDB. A future "team sync" feature
   would have to be explicit opt-in per project, and ideally end-to-end
   encrypted so the server only stores ciphertext.
3. **Guest mode keeps working without the backend.** The backend only adds
   accounts, organisations, projects metadata and billing state.
4. **Row Level Security on every table.** Access is derived from
   `organization_members`; no table is readable with the anon key alone.

## Tables

```sql
-- Supabase Auth owns auth.users. This is the public profile.
create table public.users (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now()
);

create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_by uuid not null references public.users (id),
  created_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references public.users (id) on delete cascade,
  role            text not null check (role in ('owner', 'admin', 'member')),
  created_at      timestamptz not null default now(),
  primary key (organization_id, user_id)
);

-- Project METADATA only (name, settings). No prompts, traces or keys.
create table public.projects (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null,
  created_at      timestamptz not null default now()
);

-- Mirrors the payment provider's subscription state (e.g. Stripe), written
-- only by a server-side webhook using the service role.
create table public.billing_subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null unique references public.organizations (id) on delete cascade,
  plan                     text not null check (plan in ('free', 'team', 'enterprise')),
  status                   text not null check (status in ('active', 'trialing', 'past_due', 'canceled')),
  provider_customer_id     text,
  provider_subscription_id text,
  current_period_end       timestamptz,
  updated_at               timestamptz not null default now()
);

alter table public.users                 enable row level security;
alter table public.organizations         enable row level security;
alter table public.organization_members  enable row level security;
alter table public.projects              enable row level security;
alter table public.billing_subscriptions enable row level security;

-- Example policy: members can read their organisation's projects.
create policy "members read projects" on public.projects
  for select using (
    exists (
      select 1 from public.organization_members m
      where m.organization_id = projects.organization_id and m.user_id = auth.uid()
    )
  );
```

## What this enables later (paid tiers, roadmap)

- **Team sync**: share project metadata and (opt-in, encrypted) trace bundles.
- **Scheduled regression runs**: would need a runner that holds a key, which
  conflicts with principle 1. Options: run in the customer's own CI with the
  `runtimes-lab` CLI (works today), or a customer-hosted runner. A hosted
  runner holding customer keys is explicitly out of scope until there is a
  security design for it.
- **Enterprise tool mocks**: shared, versioned mock libraries per organisation.

## CSP impact

Adding Supabase would require adding the project's `https://<ref>.supabase.co`
origin to `connect-src` in `apps/web/src/lib/csp.ts`, and updating the
network tests, which currently prove that only provider APIs are reachable.
