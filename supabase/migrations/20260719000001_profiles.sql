-- Profiles: one row per user holding the client's persisted snapshots that are
-- singletons per account (onboarding/profile, appearance preference, consent).
-- Shapes mirror the mobile app's AsyncStorage envelopes; jsonb keeps the
-- client the schema owner while RLS enforces ownership.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- OnboardingData envelope: intake answers, generated plan, analysis status,
  -- consent + guardian authorization records ride inside (see
  -- packages/shared/src/types/contracts.ts for the record contracts).
  onboarding jsonb,
  -- AppearancePreference envelope (theme choice).
  appearance jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = user_id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
