# Supabase backend

Database schema, RLS policies, and storage bucket for Pore's account sync.
The mobile app works fully without this backend (placeholder mode); when
`EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` are set, sign-in
unlocks cloud backup/restore on top of the same local-first storage.

## Applying migrations

With the [Supabase CLI](https://supabase.com/docs/guides/cli) installed and a
project created:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push          # applies everything in supabase/migrations/
```

Migrations are plain SQL, ordered by filename. Never edit an applied migration;
add a new one.

## Design notes

- **Snapshot tables** (`profiles`, `routine_logs`, `reminders`): one row per
  user holding the same envelope the mobile app writes to AsyncStorage. The
  client owns the schema of the jsonb payloads; versioning rides inside the
  envelope (`{ v, data }`) exactly as it does on device.
- **Row tables** (`scans`, `checkins`, `routines`): one row per record, with
  `(user_id, id)` primary keys because ids are client-generated.
- **`entitlements`**: readable by the owner, but `plan`/`term`/`unlocked_at`
  are writable only by the service role (RevenueCat webhook). A trigger
  rejects any client write that touches them — the client can never grant
  itself Plus. See `apps/mobile/src/state/entitlement.tsx` for the app half of
  this invariant.
- **`scan-photos` bucket**: private. Object paths are
  `{user_id}/{scan_id}/{name}`; policies check the first path segment against
  `auth.uid()`. No public URLs, ever.
- **RLS**: every table is owner-only (`auth.uid() = user_id`). The service
  role bypasses RLS by design and is used exclusively server-side
  (`apps/web`), never shipped in a client.

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | mobile | project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | mobile | anon (publishable) key |
| `SUPABASE_URL` | web server | token verification, webhook upserts |
| `SUPABASE_SERVICE_ROLE_KEY` | web server | service-role key — server only, never in a client bundle |

See `docs/production-setup.md` for the full setup walkthrough.
