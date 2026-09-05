-- Run this once against DATABASE_URL before relying on the parental-consent
-- gate in production (apps/web/lib/consent-store.ts falls back to an
-- in-memory store otherwise, which doesn't survive a restart/redeploy and
-- isn't shared across serverless instances).
--
--   psql "$DATABASE_URL" -f apps/web/lib/db/schema.sql

create table if not exists parental_consents (
  id uuid primary key,
  token text not null unique,
  parent_email text not null,
  child_age integer not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
