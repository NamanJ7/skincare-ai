-- Generated routine plans (RoutinePlanContract). Append-only from the client's
-- perspective; the latest row per user is the active plan. Kept separate from
-- profiles so plan history/versioning survives profile edits.

create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Routine + adjustments audit trail as produced by the safety engine.
  payload jsonb not null,
  model_version text,
  prompt_version text,
  created_at timestamptz not null default now()
);

alter table public.routines enable row level security;

create policy "routines_select_own" on public.routines
  for select using (auth.uid() = user_id);
create policy "routines_insert_own" on public.routines
  for insert with check (auth.uid() = user_id);
create policy "routines_delete_own" on public.routines
  for delete using (auth.uid() = user_id);

create index routines_user_created_at on public.routines (user_id, created_at);
