# Scheduling Hardening

## TASK-017

```md
id: TASK-017
status: completed
```

- Customer emulator booking flow, appointment creation, backend verification, and customer type-check completed.

## TASK-018

```md
id: TASK-018
status: completed
```

- Deterministic scheduling proof harness added; staff schedule, breaks, closed days, cancelled rebook, any-staff, mirror sync, RLS/RPC exposure, and self-update conflict handling verified.

## TASK-019

```md
id: TASK-019
status: completed
```

- Optional commission module added with shop-level gate, per-staff rules, completion/report RPCs, owner UI, staging smoke, web smoke, and Android owner smoke.

## TASK-020

```md
id: TASK-020
status: completed
```

- Customer booking switched to active `staff`, owner lookup compatibility added, owner-staff invariant migration added, and backend proof updated.

## TASK-021

```md
id: TASK-021
status: completed
```

- Customer availability request compatibility fixed: app/web send `shop_slug` plus `slug`, edge function accepts both, remote `get-availability` deployed and smoked.
