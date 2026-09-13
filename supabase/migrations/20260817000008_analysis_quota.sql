-- Server-authoritative abuse controls for the paid analysis path, plus fixes to
-- three policy/function gaps found in the earlier migrations.
--
-- Why this exists: /api/plan spends two Opus vision/routine calls per request.
-- Before this migration the only control was an in-process token bucket keyed on
-- a client-spoofable header, so the free-scan rule (apps/mobile/src/lib/gate.ts)
-- was pure UI and the endpoint had no durable, shared, race-safe limit at all.
--
-- Everything here is written for the service role only. The tables carry RLS
-- with *no* policies, which is deliberate: service_role bypasses RLS, and any
-- anon/authenticated client therefore sees zero rows and can write nothing.

-- ---------------------------------------------------------------------------
-- 1. Abuse state
-- ---------------------------------------------------------------------------

-- Per-user daily debit. (user_id, day) primary key makes the conditional upsert
-- below atomic, which is what stops concurrent requests each reading "1 left".
create table public.analysis_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  used int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.analysis_usage enable row level security;

-- Whole-deployment daily ceiling: the backstop for "attacker farms N accounts".
-- Per-user limits alone cannot bound total spend when signup is cheap.
create table public.analysis_global_usage (
  day date primary key,
  used int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.analysis_global_usage enable row level security;

-- Idempotency ledger, audit trail and cost log in one table. The unique
-- constraint is the replay gate: a captured request body cannot be re-spent.
create table public.analysis_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- sha256(user_id | sessionId | the three ordered content digests).
  request_hash text not null,
  status text not null default 'in_flight'
    check (status in ('in_flight', 'succeeded', 'failed')),
  -- Salted hash only. A raw IP is personal data we have no reason to retain.
  ip_hash text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, request_hash)
);

alter table public.analysis_requests enable row level security;

create index analysis_requests_created_at on public.analysis_requests (created_at desc);

-- Circuit breaker + tunable caps. Single row; edit it to stop spend immediately
-- without a redeploy (the whole point of a breaker is that it is reachable at
-- 3am from a SQL console).
create table public.service_flags (
  id int primary key default 1 check (id = 1),
  analysis_enabled boolean not null default true,
  daily_cap_per_user int not null default 3 check (daily_cap_per_user >= 0),
  global_daily_cap int not null default 2000 check (global_daily_cap >= 0),
  updated_at timestamptz not null default now()
);

alter table public.service_flags enable row level security;

insert into public.service_flags (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Atomic claim / release
-- ---------------------------------------------------------------------------

-- Returns exactly one of:
--   allowed        -- proceed to the model
--   duplicate      -- this (user, request_hash) was already claimed; replay
--   quota_exceeded -- per-user daily cap reached
--   global_cap     -- deployment-wide daily cap reached
--   disabled       -- breaker open
--
-- Race safety comes from the conditional upserts, not from an advisory lock:
-- `on conflict do update ... where used < cap` is evaluated under the row lock
-- Postgres already takes for the conflicting row, so N concurrent callers
-- serialize on it and exactly (cap) of them observe a non-zero row_count.
create or replace function public.claim_analysis_slot(
  p_user_id uuid,
  p_request_hash text,
  p_ip_hash text default null
)
returns table (outcome text, remaining int)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_flags public.service_flags%rowtype;
  v_today date := (now() at time zone 'utc')::date;
  v_rows int;
  v_used int;
begin
  select * into v_flags from public.service_flags where id = 1;
  -- No config row means the breaker state is unknown. Unknown is not "open for
  -- business" on a path that spends money.
  if not found or not v_flags.analysis_enabled then
    return query select 'disabled'::text, 0;
    return;
  end if;

  -- Claim the request first: a replay must not debit quota a second time, and
  -- must not reach the model even if the user still has budget left.
  insert into public.analysis_requests (user_id, request_hash, ip_hash)
  values (p_user_id, p_request_hash, p_ip_hash)
  on conflict (user_id, request_hash) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return query select 'duplicate'::text, 0;
    return;
  end if;

  -- Per-user daily debit.
  insert into public.analysis_usage (user_id, day, used)
  values (p_user_id, v_today, 1)
  on conflict (user_id, day) do update
    set used = analysis_usage.used + 1,
        updated_at = now()
    where analysis_usage.used < v_flags.daily_cap_per_user
  returning used into v_used;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    -- Release the claim so the same scan can be retried once the window rolls
    -- over; otherwise a rejected request would be permanently un-retryable.
    delete from public.analysis_requests
      where user_id = p_user_id and request_hash = p_request_hash;
    return query select 'quota_exceeded'::text, 0;
    return;
  end if;

  -- Deployment-wide debit.
  insert into public.analysis_global_usage (day, used)
  values (v_today, 1)
  on conflict (day) do update
    set used = analysis_global_usage.used + 1,
        updated_at = now()
    where analysis_global_usage.used < v_flags.global_daily_cap;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    update public.analysis_usage
      set used = greatest(0, used - 1), updated_at = now()
      where user_id = p_user_id and day = v_today;
    delete from public.analysis_requests
      where user_id = p_user_id and request_hash = p_request_hash;
    return query select 'global_cap'::text, 0;
    return;
  end if;

  return query
    select 'allowed'::text, greatest(0, v_flags.daily_cap_per_user - v_used);
end;
$$;

-- Close out a claimed slot.
--   succeeded -- model ran and returned; keep the debit
--   failed    -- model ran and threw; keep the debit (we were still billed)
--   refunded  -- model was never invoked; give the slot back and allow a retry
create or replace function public.release_analysis_slot(
  p_user_id uuid,
  p_request_hash text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
begin
  if p_status = 'refunded' then
    update public.analysis_usage
      set used = greatest(0, used - 1), updated_at = now()
      where user_id = p_user_id and day = v_today;
    update public.analysis_global_usage
      set used = greatest(0, used - 1), updated_at = now()
      where day = v_today;
    delete from public.analysis_requests
      where user_id = p_user_id and request_hash = p_request_hash;
    return;
  end if;

  if p_status not in ('succeeded', 'failed') then
    raise exception 'unknown release status: %', p_status;
  end if;

  update public.analysis_requests
    set status = p_status, completed_at = now()
    where user_id = p_user_id and request_hash = p_request_hash;
end;
$$;

-- These are service-role entry points. A client holding the anon key must not
-- be able to debit, refund, or probe them.
--
-- Order matters: EXECUTE is granted to PUBLIC by default on a new function, so
-- the revoke has to come first and the service_role grant must be explicit.
-- Relying on service_role inheriting from PUBLIC would break the RPC the moment
-- PUBLIC is revoked — and because the route fails closed, that presents as
-- "analysis disabled for everyone" rather than as a permissions error.
revoke all on function public.claim_analysis_slot(uuid, text, text) from public, anon, authenticated;
revoke all on function public.release_analysis_slot(uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_analysis_slot(uuid, text, text) to service_role;
grant execute on function public.release_analysis_slot(uuid, text, text) to service_role;

-- Same reasoning for the tables: RLS with no policies already denies anon and
-- authenticated, and these grants make the service role's access explicit
-- rather than dependent on default-privilege configuration.
grant select, insert, update, delete on
  public.analysis_usage,
  public.analysis_global_usage,
  public.analysis_requests,
  public.service_flags
  to service_role;

-- ---------------------------------------------------------------------------
-- 3. Fixes to earlier migrations
-- ---------------------------------------------------------------------------

-- H3: scan_photos_update_own had `using` but no `with check` — the only policy
-- of the eight missing its write-side clause. Without it an authenticated user
-- passes the read check on their own object and can then rewrite `name` to
-- another user's {uid}/ prefix, planting content in a victim's namespace.
drop policy if exists "scan_photos_update_own" on storage.objects;
create policy "scan_photos_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'scan-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'scan-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- The client passes its own contentType with upsert:true, so the bucket itself
-- has to be the thing that bounds size and type — not the caller.
update storage.buckets
  set file_size_limit = 8388608,           -- 8 MiB; a guided JPEG is ~1-2 MiB
      allowed_mime_types = array['image/jpeg']
  where id = 'scan-photos';

-- H4: a SECURITY DEFINER function without a pinned search_path is the classic
-- Postgres privilege-escalation surface (Supabase's linter flags it as
-- function_search_path_mutable). Body is unchanged from
-- 20260719000005_entitlements.sql; only the search_path binding is added.
create or replace function public.entitlements_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
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

-- set_updated_at is SECURITY INVOKER so it carries no escalation risk, but it
-- runs on every write to six tables and an unqualified search_path is still a
-- correctness hazard if a caller sets a custom one.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Waitlist (H6)
-- ---------------------------------------------------------------------------

-- /api/waitlist appended name/email/skin-concern/spend to a JSONL file under
-- process.cwd(). That is ephemeral on Vercel (submissions silently lost) and
-- an unbounded disk write driven by unauthenticated input. Service-role only,
-- same no-policy RLS posture as the tables above.
create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  skin_wish text not null,
  monthly_spend text not null,
  tried text[] not null default '{}',
  referral_code text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (email)
);

alter table public.waitlist enable row level security;

grant select, insert, update on public.waitlist to service_role;
