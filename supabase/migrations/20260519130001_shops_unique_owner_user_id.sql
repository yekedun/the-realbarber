-- One-shop-per-owner guard.
--
-- Mobile register flow assumes a single shop per auth user (RouterGuard picks
-- a single row, register.tsx only handles slug collisions on its own insert).
-- Without a uniqueness constraint, a user can INSERT a second shop with their
-- own owner_user_id (allowed by the shops_owner_insert RLS WITH CHECK), and
-- the app silently breaks because lib/user-context.tsx does `.single()` on
-- the owner-by-user lookup and would error if two rows existed.
--
-- This partial unique index lets legacy NULL-owner rows (none in production,
-- but defensive) coexist while enforcing one shop per user going forward.
--
-- Maps PostgreSQL error code 23505 → register.tsx already handles this code
-- on slug collisions, and we'll surface the same 23505 if the user tries to
-- create a second shop, so the existing client error path covers this.

CREATE UNIQUE INDEX IF NOT EXISTS shops_owner_user_id_unique_idx
  ON public.shops (owner_user_id)
  WHERE owner_user_id IS NOT NULL;
