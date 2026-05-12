# 2026-05-12 Customer Availability

## Summary

- Investigated customer booking error: `Musaitlik alinamadi. slug, date, service_id zorunlu`.
- Confirmed remote `get-availability` was an old deployed version expecting `slug` and legacy lookup behavior while the app sent `shop_slug`.
- Normalized Expo Router params in customer booking steps to avoid array values leaking into booking URLs.
- Scoped customer services to the current shop before booking.
- Updated customer and web availability callers to send both `shop_slug` and `slug`.
- Updated edge `get-availability` to accept either query param and deployed it to Supabase project `yvxjandwfkaiwhbeslen`.
- Reinstalled/launched the customer Android app against Metro and verified booking step 3 renders slots for `test-berber`.

## Validation

- `pnpm --filter @berber/customer type-check` passed.
- `pnpm --filter @berber/web type-check` passed.
- Remote `get-availability` returned 200 and slots for `test-berber` with `shop_slug`, `slug`, and both params.
- Customer Android smoke reached `Gun & Saat`; UI showed `12 Mayis 2026` with 1 available slot at `18:30`.

## Follow-Up

- Review migration history drift before broad staging pushes.
