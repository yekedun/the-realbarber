---
source: supabase-migrations
topic: schema
priority: high
updated: 2026-05-13
---

# Supabase Schema Reference

11 tables across 26 migrations. Last migration: `20260518150000_commission_snapshot_integrity.sql`.

## Table Index

| Table | Defined In | Notes |
|---|---|---|
| shops | 20240101000001_initial.sql | extended by multi_seat, commission |
| barbers | 20240101000001_initial.sql | original single-seat model |
| services | 20240101000001_initial.sql | |
| appointments | 20240101000001_initial.sql | extended by notes, commission migrations |
| blocks | 20240101000001_initial.sql | manual time blocks |
| widget_tokens | 20240101000001_initial.sql | per-shop API tokens |
| appointment_slots | 20240101000001_initial.sql | denorm read table |
| block_slots | 20240101000001_initial.sql | denorm read table |
| customer_profiles | 20240101000005_customer_app.sql | customer mobile app |
| staff | 20260508_multi_seat_and_admin.sql | multi-seat model with role enum |
| staff_schedules | 20260509_staff_schedules.sql | per-staff weekly hours |

## Key Relationships

```
auth.users
  ├── shops.owner_user_id
  ├── barbers.user_id (nullable)
  ├── staff.user_id (nullable)
  └── customer_profiles.user_id

shops
  ├── barbers.shop_id
  ├── services.shop_id
  ├── widget_tokens.shop_id
  └── staff.shop_id

barbers
  ├── appointments.barber_id
  ├── blocks.barber_id
  ├── appointment_slots.barber_id
  └── block_slots.barber_id

staff
  └── staff_schedules.staff_id

appointments
  ├── appointment_slots.appointment_id
  └── (EXCLUDE gist conflict constraint)

blocks
  └── block_slots.block_id
```

## Notable Constraints

- `appointments`: EXCLUDE USING gist on `(barber_id, tstzrange(starts_at, ends_at, '[)'))` WHERE status != 'cancelled' — requires `btree_gist` extension
- `staff_schedules`: UNIQUE (staff_id, day_of_week)
- `services.duration_min`: CHECK > 0 AND <= 480

## Column Additions (ALTER TABLE history)

| Migration | Table | Column(s) Added |
|---|---|---|
| 20260508_multi_seat_and_admin | shops | owner_id, name, address |
| 20260510_appointment_notes_and_cancel | appointments | customer_notes |
| 20260517090000_optional_commission_tracking | shops | commission_enabled |
| 20260517090000_optional_commission_tracking | staff | commission_type, commission_rate_bps |
| 20260517090000_optional_commission_tracking | appointments | final_price_cents, completed_price_cents, completed_commission_type, completed_commission_rate_bps, completed_commission_cents, completed_shop_share_cents, completed_at |
| 20260518150000_commission_snapshot_integrity | appointments | booked_price_cents |

## Enum Types

- `public.staff_role`: used in `staff.role`, DEFAULT 'staff'
- `appointments.status`: text CHECK IN ('confirmed', 'cancelled', 'completed')
- `blocks.reason`: text CHECK IN ('walkin', 'break', 'personal')
- `blocks.created_via`: text CHECK IN ('widget', 'app', 'web')
