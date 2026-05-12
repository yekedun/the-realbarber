# Active Feature

Customer booking availability compatibility

# Current Task

- Fixed customer app availability failures caused by deployed `get-availability` expecting legacy `slug` while the app sent `shop_slug`.
- Customer booking params now normalize Expo Router array/scalar values before passing `sid`, `staff`, `date`, and slot data between steps.
- Customer service list now scopes active services to the configured shop slug's `shop_id`.
- Web and customer availability calls send both `shop_slug` and `slug` for backwards compatibility.
- Remote Supabase `get-availability` was deployed to version 3 on project `yvxjandwfkaiwhbeslen` and returns slots for `test-berber`.
- Customer Android app was reinstalled/launched against Metro; booking step 3 renders slots for `test-berber` (`12 Mayis 2026`, `18:30`).

# Current Problems

- Supabase advisors still report non-scheduling warnings: RLS performance, multiple permissive policies outside scheduling, `btree_gist` public extension, and intentional public availability RPC warnings
- test data exists on remote for slug `test-berber`
- Supabase CLI remote query may need `--dns-resolver https`; native DNS timed out during staging smoke.
- remote/local migration history has unrelated drift around older `20260512*` and `20260517100000` local migrations; do not bulk push without reviewing migration history.
- if a device still shows the old availability error, reinstall/reload Expo or leave/re-enter the booking flow to clear the old bundle/screen state.

# Active Files

- `apps/customer/app/(auth)/login.tsx`
- `apps/customer/app/(app)/index.tsx`
- `apps/customer/app/booking/step2-barber.tsx`
- `apps/customer/app/booking/step3-slot.tsx`
- `apps/customer/app/booking/step4-confirm.tsx`
- `apps/web/src/app/[slug]/BookingFlow.tsx`
- `supabase/functions/get-availability/index.ts`

# Rotation Rule

If `current.md` exceeds 80 lines:

- move historical content to summaries
- keep only active execution context
