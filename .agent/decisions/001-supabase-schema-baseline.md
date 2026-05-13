# ADR-001: Supabase Schema Baseline

## Status: ACCEPTED

## Context

Initial schema decisions for the barber appointment system. Tables were established across migrations starting from `20240101000001_initial.sql` and extended through multi-seat, staff scheduling, customer app, and commission tracking migrations.

## Decision

The following tables form the baseline schema:

### shops
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | gen_random_uuid() |
| owner_user_id | UUID FK auth.users | ON DELETE CASCADE |
| owner_id | UUID FK auth.users | added in multi_seat migration |
| slug | TEXT UNIQUE | |
| display_name | TEXT | |
| name | TEXT | added in multi_seat migration |
| bio | TEXT | |
| avatar_url | TEXT | |
| address | TEXT | added in multi_seat migration |
| timezone | TEXT | DEFAULT 'Europe/Istanbul' |
| working_hours | JSONB | DEFAULT '{}' |
| commission_enabled | BOOLEAN | DEFAULT false; added in commission migration |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### barbers
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| shop_id | UUID FK shops | ON DELETE CASCADE |
| user_id | UUID UNIQUE FK auth.users | ON DELETE SET NULL |
| display_name | TEXT | |
| avatar_url | TEXT | |
| invite_email | TEXT | |
| is_active | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### services
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| shop_id | UUID FK shops | ON DELETE CASCADE |
| name | TEXT | |
| duration_min | INTEGER | CHECK > 0 AND <= 480 |
| price_cents | INTEGER | CHECK >= 0 |
| display_order | INTEGER | DEFAULT 0 |
| is_active | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMPTZ | |

### appointments
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| barber_id | UUID FK barbers | ON DELETE CASCADE |
| service_id | UUID FK services | nullable |
| customer_name | TEXT | CHECK length >= 2 |
| customer_phone | TEXT | |
| customer_notes | TEXT | added in notes migration |
| starts_at | TIMESTAMPTZ | |
| ends_at | TIMESTAMPTZ | CHECK > starts_at |
| status | TEXT | DEFAULT 'confirmed'; IN ('confirmed','cancelled','completed') |
| notes | TEXT | |
| final_price_cents | INTEGER | commission tracking |
| booked_price_cents | INTEGER | commission snapshot integrity |
| completed_price_cents | INTEGER | commission tracking |
| completed_commission_type | TEXT | commission tracking |
| completed_commission_rate_bps | INTEGER | commission tracking |
| completed_commission_cents | INTEGER | commission tracking |
| completed_shop_share_cents | INTEGER | commission tracking |
| completed_at | TIMESTAMPTZ | commission tracking |
| created_at | TIMESTAMPTZ | |
| EXCLUDE USING gist | | barber_id + tstzrange WHERE status != 'cancelled' |

### blocks
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| barber_id | UUID FK barbers | ON DELETE CASCADE |
| starts_at | TIMESTAMPTZ | |
| ends_at | TIMESTAMPTZ | CHECK > starts_at |
| reason | TEXT | DEFAULT 'walkin'; IN ('walkin','break','personal') |
| created_via | TEXT | DEFAULT 'app'; IN ('widget','app','web') |
| created_at | TIMESTAMPTZ | |

### widget_tokens
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| shop_id | UUID FK shops | ON DELETE CASCADE |
| token_hash | TEXT UNIQUE | |
| label | TEXT | DEFAULT 'Widget' |
| last_used_at | TIMESTAMPTZ | nullable |
| expires_at | TIMESTAMPTZ | nullable |
| created_at | TIMESTAMPTZ | |

### appointment_slots (denorm view table)
| Column | Type | Notes |
|---|---|---|
| appointment_id | UUID PK FK appointments | ON DELETE CASCADE |
| barber_id | UUID | |
| starts_at | TIMESTAMPTZ | |
| ends_at | TIMESTAMPTZ | |

### block_slots (denorm view table)
| Column | Type | Notes |
|---|---|---|
| block_id | UUID PK FK blocks | ON DELETE CASCADE |
| barber_id | UUID | |
| starts_at | TIMESTAMPTZ | |
| ends_at | TIMESTAMPTZ | |

### staff
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | uuid_generate_v4() |
| shop_id | UUID FK shops | ON DELETE CASCADE |
| user_id | UUID FK auth.users | ON DELETE SET NULL; nullable |
| name | TEXT | |
| role | staff_role enum | DEFAULT 'staff' |
| is_active | BOOLEAN | DEFAULT true |
| commission_type | TEXT | DEFAULT 'none'; added in commission migration |
| commission_rate_bps | INTEGER | nullable; added in commission migration |
| created_at | TIMESTAMPTZ | |

### staff_schedules
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | uuid_generate_v4() |
| staff_id | UUID FK staff | ON DELETE CASCADE |
| day_of_week | INTEGER | CHECK BETWEEN 0 AND 6 |
| is_working | BOOLEAN | DEFAULT true |
| work_start | TIME | DEFAULT '09:00' |
| work_end | TIME | DEFAULT '19:00' |
| break_start | TIME | nullable |
| break_end | TIME | nullable |
| UNIQUE | | (staff_id, day_of_week) |

### customer_profiles
| Column | Type | Notes |
|---|---|---|
| user_id | UUID PK FK auth.users | ON DELETE CASCADE |
| full_name | TEXT | DEFAULT '' |
| phone | TEXT | nullable |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

## Consequences

- All future schema changes must be recorded as new ADRs
- Conflict exclusion constraint on `appointments` requires `btree_gist` extension
- `barbers` and `staff` are two separate concepts: `barbers` is the original single-seat model; `staff` was added for multi-seat and has a `role` enum
- Commission columns on `appointments` are nullable snapshots recorded at completion time
