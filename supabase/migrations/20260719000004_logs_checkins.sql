-- Routine check-off log (snapshot per user — the local RoutineLog is a single
-- per-day map, so a snapshot column stays in lockstep with the client shape)
-- and weekly check-ins (one row per local calendar day, mirroring CheckIn).

create table public.routine_logs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- RoutineLog envelope: { days, revision?, stepOwnership? }.
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.routine_logs enable row level security;

create policy "routine_logs_select_own" on public.routine_logs
  for select using (auth.uid() = user_id);
create policy "routine_logs_insert_own" on public.routine_logs
  for insert with check (auth.uid() = user_id);
create policy "routine_logs_update_own" on public.routine_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "routine_logs_delete_own" on public.routine_logs
  for delete using (auth.uid() = user_id);

create trigger routine_logs_set_updated_at
  before update on public.routine_logs
  for each row execute function public.set_updated_at();

-- Check-ins: id is the local date key (YYYY-MM-DD) — one entry per day, a
-- same-day re-entry replaces (mirrors addCheckIn in the mobile app).
create table public.checkins (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  created_at timestamptz not null,
  -- Full CheckIn snapshot (skinFeel, breakouts, irritationSigns, ...).
  payload jsonb not null,
  photo_keys text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.checkins enable row level security;

create policy "checkins_select_own" on public.checkins
  for select using (auth.uid() = user_id);
create policy "checkins_insert_own" on public.checkins
  for insert with check (auth.uid() = user_id);
create policy "checkins_update_own" on public.checkins
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "checkins_delete_own" on public.checkins
  for delete using (auth.uid() = user_id);

create trigger checkins_set_updated_at
  before update on public.checkins
  for each row execute function public.set_updated_at();
