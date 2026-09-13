-- Row-Level-Security behaviour tests.
--
--   supabase start && supabase test db
--
-- These assert the *policies*, not the schema. Every migration declares RLS and
-- an `auth.uid() = user_id` policy, but a policy that exists is not a policy
-- that works: a missing WITH CHECK, an over-broad USING, or a GRANT to the
-- wrong role all leave data reachable while the DDL still reads correctly.
--
-- Method: PostgREST authenticates by setting `role` and `request.jwt.claims`.
-- These tests do the same, so they exercise the code path a real anon-key
-- client hits rather than running as a superuser that bypasses RLS entirely.

begin;
select plan(35);

-- ---------------------------------------------------------------------------
-- Fixtures. RLS is meaningless without a second identity to be excluded from.
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email)
values
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@example.test'),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@example.test')
on conflict (id) do nothing;

set local role service_role;
insert into public.profiles (user_id, onboarding) values
  ('11111111-1111-4111-8111-111111111111', '{"age":30}'),
  ('22222222-2222-4222-8222-222222222222', '{"age":31}');
insert into public.scans (user_id, id, captured_at, payload) values
  ('11111111-1111-4111-8111-111111111111', 'scan-a', now(), '{"findings":[]}'),
  ('22222222-2222-4222-8222-222222222222', 'scan-b', now(), '{"findings":[]}');
insert into public.routines (user_id, payload) values
  ('11111111-1111-4111-8111-111111111111', '{}'),
  ('22222222-2222-4222-8222-222222222222', '{}');
insert into public.routine_logs (user_id, data) values
  ('11111111-1111-4111-8111-111111111111', '{}'),
  ('22222222-2222-4222-8222-222222222222', '{}');
insert into public.checkins (user_id, id, created_at, payload) values
  ('11111111-1111-4111-8111-111111111111', '2026-08-18', now(), '{}'),
  ('22222222-2222-4222-8222-222222222222', '2026-08-18', now(), '{}');
insert into public.reminders (user_id, data) values
  ('11111111-1111-4111-8111-111111111111', '{}'),
  ('22222222-2222-4222-8222-222222222222', '{}');
insert into public.entitlements (user_id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');
insert into storage.objects (bucket_id, name, owner)
  values ('scan-photos', '11111111-1111-4111-8111-111111111111/scan-a/front.jpg',
          '11111111-1111-4111-8111-111111111111')
  on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 1. An owner sees exactly one row (their own) on every table.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select is((select count(*)::int from public.profiles),     1, 'profiles: owner sees only their row');
select is((select count(*)::int from public.scans),        1, 'scans: owner sees only their row');
select is((select count(*)::int from public.routines),     1, 'routines: owner sees only their row');
select is((select count(*)::int from public.routine_logs), 1, 'routine_logs: owner sees only their row');
select is((select count(*)::int from public.checkins),     1, 'checkins: owner sees only their row');
select is((select count(*)::int from public.reminders),    1, 'reminders: owner sees only their row');
select is((select count(*)::int from public.entitlements), 1, 'entitlements: owner sees only their row');

-- ---------------------------------------------------------------------------
-- 2. Cross-user SELECT. RLS filters silently, so zero rows is the pass.
-- ---------------------------------------------------------------------------
select is((select count(*)::int from public.profiles     where user_id = '22222222-2222-4222-8222-222222222222'), 0, 'profiles: cannot read another user');
select is((select count(*)::int from public.scans        where user_id = '22222222-2222-4222-8222-222222222222'), 0, 'scans: cannot read another user');
select is((select count(*)::int from public.routines     where user_id = '22222222-2222-4222-8222-222222222222'), 0, 'routines: cannot read another user');
select is((select count(*)::int from public.routine_logs where user_id = '22222222-2222-4222-8222-222222222222'), 0, 'routine_logs: cannot read another user');
select is((select count(*)::int from public.checkins     where user_id = '22222222-2222-4222-8222-222222222222'), 0, 'checkins: cannot read another user');
select is((select count(*)::int from public.reminders    where user_id = '22222222-2222-4222-8222-222222222222'), 0, 'reminders: cannot read another user');
select is((select count(*)::int from public.entitlements where user_id = '22222222-2222-4222-8222-222222222222'), 0, 'entitlements: cannot read another user');

-- ---------------------------------------------------------------------------
-- 3. Cross-user UPDATE / DELETE must affect zero rows.
-- ---------------------------------------------------------------------------
update public.profiles set onboarding = '{"pwned":true}' where user_id = '22222222-2222-4222-8222-222222222222';
delete from public.scans where user_id = '22222222-2222-4222-8222-222222222222';
delete from public.checkins where user_id = '22222222-2222-4222-8222-222222222222';

set local role service_role;
reset request.jwt.claims;
select is((select count(*)::int from public.profiles
             where user_id = '22222222-2222-4222-8222-222222222222'
               and onboarding ? 'pwned'), 0,
  'profiles: a cross-user UPDATE changed nothing');
select is((select count(*)::int from public.scans
             where user_id = '22222222-2222-4222-8222-222222222222'), 1,
  'scans: a cross-user DELETE removed nothing');
select is((select count(*)::int from public.checkins
             where user_id = '22222222-2222-4222-8222-222222222222'), 1,
  'checkins: a cross-user DELETE removed nothing');

-- ---------------------------------------------------------------------------
-- 4. WITH CHECK: a row cannot be created under, or moved to, another uid.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select throws_ok(
  $q$insert into public.profiles (user_id, onboarding) values ('22222222-2222-4222-8222-222222222222', '{}')$q$,
  '42501', null,
  'profiles: cannot insert a row owned by someone else');
select throws_ok(
  $q$insert into public.scans (user_id, id, captured_at, payload) values ('22222222-2222-4222-8222-222222222222', 'x', now(), '{}')$q$,
  '42501', null,
  'scans: cannot insert a row owned by someone else');
select throws_ok(
  $q$update public.profiles set user_id = '22222222-2222-4222-8222-222222222222' where user_id = '11111111-1111-4111-8111-111111111111'$q$,
  '42501', null,
  'profiles: cannot reassign your own row to another user');

-- ---------------------------------------------------------------------------
-- 5. Entitlement escalation: what entitlements_guard exists to stop.
-- ---------------------------------------------------------------------------
select throws_ok(
  $q$update public.entitlements set plan = 'plus' where user_id = auth.uid()$q$,
  null, null,
  'entitlements: a client cannot grant itself Plus');
select throws_ok(
  $q$update public.entitlements set unlocked_at = now() where user_id = auth.uid()$q$,
  null, null,
  'entitlements: a client cannot backdate its own unlock');
select throws_ok(
  $q$insert into public.entitlements (user_id, plan) values ('11111111-1111-4111-8111-111111111111', 'plus')$q$,
  null, null,
  'entitlements: delete-and-reinsert is not a way around the guard');
select lives_ok(
  $q$update public.entitlements set compatibility_usage = '{"month":"2026-08"}' where user_id = auth.uid()$q$,
  'entitlements: a client may still record its own free-tier usage');

-- ---------------------------------------------------------------------------
-- 6. Unauthenticated access.
-- ---------------------------------------------------------------------------
set local role anon;
reset request.jwt.claims;

select is((select count(*)::int from public.profiles), 0, 'anon: reads no profiles');
select is((select count(*)::int from public.scans),    0, 'anon: reads no scans');
select throws_ok(
  $q$insert into public.profiles (user_id, onboarding) values ('11111111-1111-4111-8111-111111111111', '{}')$q$,
  '42501', null,
  'anon: cannot insert a profile');

-- ---------------------------------------------------------------------------
-- 7. Abuse-control tables: RLS on with zero policies == service role only.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select is((select count(*)::int from public.analysis_usage),    0, 'analysis_usage: invisible to a signed-in user');
select is((select count(*)::int from public.analysis_requests), 0, 'analysis_requests: invisible to a signed-in user');
select is((select count(*)::int from public.service_flags),     0, 'service_flags: invisible to a signed-in user');
select is((select count(*)::int from public.waitlist),          0, 'waitlist: invisible to a signed-in user');

-- If either of these stops throwing, a client can mint or refund its own paid
-- analysis slots and the whole quota system becomes decorative.
select throws_ok(
  $q$select public.claim_analysis_slot('11111111-1111-4111-8111-111111111111', 'hash', null, true)$q$,
  '42501', null,
  'claim_analysis_slot: not executable by an authenticated client');
select throws_ok(
  $q$select public.release_analysis_slot('11111111-1111-4111-8111-111111111111', 'hash', 'refunded', true)$q$,
  '42501', null,
  'release_analysis_slot: not executable by an authenticated client');

-- ---------------------------------------------------------------------------
-- 8. Storage objects are namespaced by owner uid.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

select is(
  (select count(*)::int from storage.objects
     where bucket_id = 'scan-photos'
       and name like '11111111-1111-4111-8111-111111111111/%'),
  0,
  'storage: cannot list another user''s scan photos');

-- The rename-into-another-namespace hole that migration 8 closed by adding the
-- missing WITH CHECK to scan_photos_update_own.
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select throws_ok(
  $q$update storage.objects set name = '22222222-2222-4222-8222-222222222222/stolen.jpg'
       where bucket_id = 'scan-photos'
         and name = '11111111-1111-4111-8111-111111111111/scan-a/front.jpg'$q$,
  '42501', null,
  'storage: cannot rename an object into another user''s namespace');

select * from finish();
rollback;
