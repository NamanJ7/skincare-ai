-- Separate the analysis quota for anonymous identities from real accounts.
--
-- Why: the app signs in anonymously at boot (apps/mobile/src/state/session.tsx)
-- so the pre-account funnel carries a real auth.uid() to meter against. That is
-- the right design, but it means a per-user cap is only as strong as the cost of
-- minting a user — and an anonymous user is free. `daily_cap_per_user = 3` was
-- therefore never a bound on a scripted attacker; the only real ceiling was
-- `global_daily_cap`, i.e. the entire deployment budget (2000/day, roughly
-- $3.4k at $1.70 a scan).
--
-- A converted account is a much higher bar: it needs a deliverable email or an
-- Apple ID. So anonymous devices get a smaller allowance — enough for the one
-- free onboarding scan the product actually promises (apps/mobile/src/lib/gate.ts)
-- — and a signed-up user gets the full cap.
--
-- Anonymous callers additionally share a dedicated deployment-wide sub-cap, so
-- farming identities cannot consume the budget reserved for real accounts.

alter table public.service_flags
  add column if not exists anon_daily_cap_per_user int not null default 1
    check (anon_daily_cap_per_user >= 0),
  add column if not exists anon_global_daily_cap int not null default 300
    check (anon_global_daily_cap >= 0);

-- Anonymous debits are tracked in their own daily row so the sub-cap is
-- independent of the overall deployment counter. `kind` distinguishes them.
alter table public.analysis_global_usage
  add column if not exists anon_used int not null default 0;

-- Replaces the 3-argument version. The old signature is dropped so a stale
-- deployment cannot keep calling an unmetered variant.
drop function if exists public.claim_analysis_slot(uuid, text, text);

create or replace function public.claim_analysis_slot(
  p_user_id uuid,
  p_request_hash text,
  p_ip_hash text default null,
  p_is_anonymous boolean default true
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
  v_cap int;
begin
  select * into v_flags from public.service_flags where id = 1;
  -- No config row means the breaker state is unknown. Unknown is not "open for
  -- business" on a path that spends money.
  if not found or not v_flags.analysis_enabled then
    return query select 'disabled'::text, 0;
    return;
  end if;

  -- Default to the anonymous cap when the caller does not say. A caller that
  -- forgets to pass the flag must get the *stricter* limit, never the looser
  -- one — this is the direction an omission has to fail.
  v_cap := case
    when coalesce(p_is_anonymous, true) then v_flags.anon_daily_cap_per_user
    else v_flags.daily_cap_per_user
  end;

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

  -- Per-user daily debit, against whichever cap applies to this identity.
  insert into public.analysis_usage (user_id, day, used)
  values (p_user_id, v_today, 1)
  on conflict (user_id, day) do update
    set used = analysis_usage.used + 1,
        updated_at = now()
    where analysis_usage.used < v_cap
  returning used into v_used;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    delete from public.analysis_requests
      where user_id = p_user_id and request_hash = p_request_hash;
    return query select 'quota_exceeded'::text, 0;
    return;
  end if;

  -- Deployment-wide debit. Anonymous callers must satisfy BOTH the overall cap
  -- and their own sub-cap, so identity farming cannot eat the whole budget.
  insert into public.analysis_global_usage (day, used, anon_used)
  values (v_today, 1, case when coalesce(p_is_anonymous, true) then 1 else 0 end)
  on conflict (day) do update
    set used = analysis_global_usage.used + 1,
        anon_used = analysis_global_usage.anon_used
          + case when coalesce(p_is_anonymous, true) then 1 else 0 end,
        updated_at = now()
    where analysis_global_usage.used < v_flags.global_daily_cap
      and (
        not coalesce(p_is_anonymous, true)
        or analysis_global_usage.anon_used < v_flags.anon_global_daily_cap
      );
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

  return query select 'allowed'::text, greatest(0, v_cap - v_used);
end;
$$;

-- Refunds must return the anonymous sub-counter too, or a refunded anonymous
-- request would permanently consume a slot in the sub-cap.
create or replace function public.release_analysis_slot(
  p_user_id uuid,
  p_request_hash text,
  p_status text,
  p_is_anonymous boolean default true
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
      set used = greatest(0, used - 1),
          anon_used = case
            when coalesce(p_is_anonymous, true) then greatest(0, anon_used - 1)
            else anon_used
          end,
          updated_at = now()
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

-- Same grant discipline as migration 8: EXECUTE defaults to PUBLIC on a newly
-- created function, so revoke first and grant service_role explicitly.
revoke all on function public.claim_analysis_slot(uuid, text, text, boolean)
  from public, anon, authenticated;
revoke all on function public.release_analysis_slot(uuid, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.claim_analysis_slot(uuid, text, text, boolean)
  to service_role;
grant execute on function public.release_analysis_slot(uuid, text, text, boolean)
  to service_role;

-- The 3-arg release_analysis_slot still exists from migration 8; drop it so
-- there is exactly one entry point and no unmetered legacy path.
drop function if exists public.release_analysis_slot(uuid, text, text);
