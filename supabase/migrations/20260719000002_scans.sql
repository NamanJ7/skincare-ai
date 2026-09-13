-- Scan history: one row per completed scan (mirrors the mobile ScanRecord and
-- the ScanRecordContract in packages/shared/src/types/contracts.ts).
-- The photo bytes live in the scan-photos storage bucket; photo_keys holds the
-- object paths ({user_id}/{scan_id}/{name}) so deletes can cascade to storage.
--
-- Primary key is (user_id, id): scan ids are client-generated (createdAt
-- timestamps), so uniqueness is only guaranteed per user.

create table public.scans (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  captured_at timestamptz not null,
  status text not null default 'analyzed',
  -- Full ScanRecord snapshot (findings, assessment, comparison metadata, ...).
  payload jsonb not null,
  photo_keys text[] not null default '{}',
  delete_after timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.scans enable row level security;

create policy "scans_select_own" on public.scans
  for select using (auth.uid() = user_id);
create policy "scans_insert_own" on public.scans
  for insert with check (auth.uid() = user_id);
create policy "scans_update_own" on public.scans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "scans_delete_own" on public.scans
  for delete using (auth.uid() = user_id);

create trigger scans_set_updated_at
  before update on public.scans
  for each row execute function public.set_updated_at();

create index scans_user_captured_at on public.scans (user_id, captured_at);
