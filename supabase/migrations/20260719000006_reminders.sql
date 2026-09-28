-- Reminder preferences: snapshot per user (ReminderPrefs envelope). The live
-- OS notification permission is never persisted — it is re-read on device.

create table public.reminders (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.reminders enable row level security;

create policy "reminders_select_own" on public.reminders
  for select using (auth.uid() = user_id);
create policy "reminders_insert_own" on public.reminders
  for insert with check (auth.uid() = user_id);
create policy "reminders_update_own" on public.reminders
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "reminders_delete_own" on public.reminders
  for delete using (auth.uid() = user_id);

create trigger reminders_set_updated_at
  before update on public.reminders
  for each row execute function public.set_updated_at();
