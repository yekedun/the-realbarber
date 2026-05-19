# Migrations

## Timestamp note

The first 7 migrations use synthetic timestamps (`20240101000001_` through `20240101000007_`):

| File | What it does |
|------|-------------|
| 20240101000001_initial.sql | Schema v1: shops, barbers (pre-staff), services, appointments, blocks, widget_tokens, realtime mirrors |
| 20240101000002_rls_policies.sql | Row-level security policies for all tables |
| 20240101000003_functions.sql | Stored procedures: assign_any_barber, conflict detection, trigger functions |
| 20240101000004_optimizations.sql | Indexes, vacuuming hints |
| 20240101000005_customer_app.sql | Customer-app tables (archived — customer_profiles dropped in 20260520) |
| 20240101000006_remote.sql | Remote state sync (applied before proper timestamping) |
| 20240101000007_customer_v2.sql | Customer app v2 schema |

From `20260507_000000_uuid_ossp.sql` onwards, all migrations use real timestamps.

## Applying

```bash
supabase db reset          # local dev — wipes and re-applies all migrations
supabase db push           # production — applies only pending migrations
```
