-- Entitlements: server-truth subscription state (EntitlementContract).
-- Clients may read their row and write only the usage/interest columns.
-- plan / term / unlocked_at are writable exclusively by the service role —
-- i.e. the RevenueCat webhook — so a client can never grant itself Plus.
-- This is the database half of the app's "entitlement is never fabricated"
-- invariant (see apps/mobile/src/state/entitlement.tsx).

create table public.entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'plus')),
  term text check (term in ('monthly', 'annual')),
  unlocked_at timestamptz,
  -- Free-tier compatibility check quota ({ month, productIds }).
  compatibility_usage jsonb,
  -- Honest interest recording from the interest-only paywall.
  plus_interest jsonb,
  source text,
  updated_at timestamptz not null default now()
);

alter table public.entitlements enable row level security;

create policy "entitlements_select_own" on public.entitlements
  for select using (auth.uid() = user_id);
create policy "entitlements_insert_own" on public.entitlements
  for insert with check (auth.uid() = user_id);
create policy "entitlements_update_own" on public.entitlements
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "entitlements_delete_own" on public.entitlements
  for delete using (auth.uid() = user_id);

create trigger entitlements_set_updated_at
  before update on public.entitlements
  for each row execute function public.set_updated_at();

-- Guard: non-service-role writes cannot touch the billing-managed columns.
create or replace function public.entitlements_guard()
returns trigger
language plpgsql
security definer
as $$
begin
  if auth.role() is distinct from 'service_role' then
    if tg_op = 'INSERT' then
      if new.plan is distinct from 'free'
        or new.term is not null
        or new.unlocked_at is not null then
        raise exception 'plan, term and unlocked_at are managed by the billing service';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.plan is distinct from old.plan
        or new.term is distinct from old.term
        or new.unlocked_at is distinct from old.unlocked_at then
        raise exception 'plan, term and unlocked_at are managed by the billing service';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger entitlements_guard
  before insert or update on public.entitlements
  for each row execute function public.entitlements_guard();
