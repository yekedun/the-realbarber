# Customer Mobile Archive

## Status

`archive/customer` is preserved historical code for the former native customer mobile app.

This app is archived outside the active `apps/*` workspace. It is not an active product surface, not part of pnpm/Turbo workflows, and not an implementation target for customer booking work.

Canonical product surfaces:

- `apps/web`: customer booking and acquisition.
- `apps/mobile`: owner/staff operations.

## Archive Rules

- Do not add customer mobile features, booking workflows, scheduling logic, realtime architecture, auth architecture, migrations, RLS policies, RPCs, edge functions, or duplicated business logic for this app.
- Do not make `archive/customer` drive `@berber/shared`, database schema, scheduling, realtime, auth, or backend contract decisions.
- Allowed archive changes are limited to documentation corrections or explicit, reversible restoration work after a product and architecture decision.
- Backend pieces that were used only by this app are retained for now and require a separate backend cleanup review before removal.

## Reactivation

Reactivate customer mobile development only after an explicit product and architecture decision.

Restore steps:

1. Move `archive/customer` back to `apps/customer`.
2. Run `pnpm install` from the repo root.
3. Validate `pnpm --filter @berber/customer type-check`.
4. Validate `pnpm turbo type-check`.
5. Re-review ownership before making feature or backend changes.

After reactivation, customer mobile may consume shared scheduling logic, but it must not drive scheduling architecture.
