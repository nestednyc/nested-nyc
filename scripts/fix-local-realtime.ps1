#!/usr/bin/env pwsh
# ============================================================================
# Local Supabase parity fixes — run AFTER `supabase db reset` / a fresh start.
#
# Hosted Supabase already has these grants/constraints; the LOCAL CLI stack does
# not (its migrations run as `postgres`, and its realtime schema can drift), so
# without this the app's RLS-scoped reads and live chat silently fail locally —
# DMs/inbox only update on refresh. NEVER needed against prod. Idempotent.
#
# Fix 1 — ambient SELECT grant. Locally `authenticated` has no SELECT on base
#   tables, so direct RLS reads (e.g. getMyBlocks) AND Realtime postgres_changes
#   authorization fail. Grant SELECT (INSERT stays revoked, so the RPC
#   write-path lock still proves out).
# Fix 2 — realtime.subscription unique index. The Realtime server upserts
#   subscriptions with ON CONFLICT (subscription_id, entity, filters,
#   action_filter); if no matching unique index exists the INSERT throws, no
#   subscription registers, and postgres_changes delivers nothing (DMs AND
#   team_members). Create the matching index as the table owner (supabase_admin).
#
# Usage:  pwsh scripts/fix-local-realtime.ps1
# ============================================================================
param(
  [string]$Db = "supabase_db_nested-nyc",  # local Postgres container name
  [string]$AdminPassword = "postgres"       # supabase_admin password (CLI local default)
)
$ErrorActionPreference = "Stop"

Write-Host "==> [1/2] GRANT SELECT on messages/blocks to authenticated (local RLS-read + realtime auth parity)"
docker exec $Db psql -U postgres -v ON_ERROR_STOP=1 -c `
  "GRANT SELECT ON public.messages TO authenticated; GRANT SELECT ON public.blocks TO authenticated;"

Write-Host "==> [2/2] Ensure realtime.subscription ON CONFLICT unique index (postgres_changes live delivery)"
docker exec -e PGPASSWORD=$AdminPassword $Db psql -U supabase_admin -h 127.0.0.1 -d postgres -v ON_ERROR_STOP=1 -c `
  "CREATE UNIQUE INDEX IF NOT EXISTS subscription_subid_entity_filters_action_key ON realtime.subscription (subscription_id, entity, filters, action_filter);"

Write-Host "==> Done. RLS-scoped reads + Realtime postgres_changes (live DMs) should now work locally."
