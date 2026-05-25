-- #35 · Security & Performance hardening
-- Adds missing staff-table indexes (barbers→staff rename left index names stale)
-- and a shop_slug lookup index used by every public booking request.

-- ── Staff table indexes ──────────────────────────────────────────
-- shop_id + is_active: used by every agenda / team screen load
CREATE INDEX IF NOT EXISTS idx_staff_shop_active
  ON public.staff (shop_id, is_active);

-- user_id: used for auth lookups (login → find staff row)
CREATE INDEX IF NOT EXISTS idx_staff_user_id
  ON public.staff (user_id);

-- push_token: used by send-push edge fn
CREATE INDEX IF NOT EXISTS idx_staff_push_token
  ON public.staff (push_token)
  WHERE push_token IS NOT NULL;

-- ── Appointments indexes ─────────────────────────────────────────
-- NOTE: idx_appointments_barber_starts / idx_appointments_barber_status
-- were created before the barber_id→staff_id rename.
-- PostgreSQL automatically renames the indexed column reference on
-- ALTER TABLE ... RENAME COLUMN, so those indexes still work.
-- We add the canonical names here (IF NOT EXISTS keeps it idempotent).

CREATE INDEX IF NOT EXISTS idx_appointments_staff_starts
  ON public.appointments (staff_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_appointments_staff_status
  ON public.appointments (staff_id, status);

-- ── Blocks indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_blocks_staff_starts
  ON public.blocks (staff_id, starts_at);

-- ── Shops slug lookup ────────────────────────────────────────────
-- Already exists as idx_shops_slug ON shops(slug) — kept for reference.

-- ── Widget tokens ────────────────────────────────────────────────
-- Already exists: idx_widget_tokens_hash, idx_widget_tokens_shop

-- ── Security sanity checks (non-destructive) ────────────────────
-- Ensure RLS is on for every table that holds user data.
-- These are idempotent — enabling an already-enabled table is a no-op.
ALTER TABLE public.staff               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.widget_tokens       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_schedules     ENABLE ROW LEVEL SECURITY;
