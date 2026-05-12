# Next Tasks

1. review remote/local migration history drift before any broad staging push
2. optionally run a manual customer success-screen-to-appointments check on emulator; previous adb synthetic input was unreliable
3. harden remaining non-scheduling database warnings: RLS policy performance, multiple permissive policies, and exposed availability RPC design
4. keep TASK-016 drag/drop UI optimization parked until backend work is stable

# Completed Recently

- customer availability failure fixed and deployed: remote `get-availability` now accepts both `shop_slug` and `slug`
- customer Android app reinstalled/launched and booking step 3 rendered slots for `test-berber` (`12 Mayis 2026`, `18:30`)
- customer booking step params normalized so Expo Router array params do not leak into query construction
- customer home service query scoped services by current shop `shop_id`
- `pnpm --filter @berber/customer type-check` and `pnpm --filter @berber/web type-check` passed
- remote smoke for `get-availability` returned 200 and 3 slots with `shop_slug`, `slug`, and both together
- owner/staff booking visibility fixed locally: customer app uses `staff`; owner staff invariant migration added and local proof passes
- customer local/dev login helper reviewed: gated by `__DEV__` plus explicit dev credentials, no production UI exposure found
- remote backend smoke for `20260516090000_fix_schedule_conflict_ignore.sql` and commission migration passed on staging
- web booking flow at `http://localhost:3000/test-berber` completed via public `book-appointment` edge path and cleanup was verified
- Android owner/mobile smoke passed in Pixel_7 after starting mobile Metro on port 8083 with cache clear
   - note: customer app success CTA verification via `adb` synthetic input is unreliable on emulator; one attempt produced ANR (`Application does not have a focused window`)
   - note: missing Android deep link schemes in `apps/customer/android/app/src/main/AndroidManifest.xml` were fixed and app was reinstalled; keep one manual success-screen-to-appointments check in scope

# Rotation Rule

If `next.md` exceeds 40 lines:

- prune low-priority items
- move longer planning into summaries or backlog
