---
board: in-progress
updated: 2026-05-13
priority: critical
allowed_statuses:
  - planned
  - ready
  - in_progress
  - blocked
  - review
  - completed
  - archived
---

# In Progress

| ID       | Title                                       | Status      | Updated    |
|----------|---------------------------------------------|-------------|------------|
| TASK-001 | Fix H-3 + C-1 (customer cancel TOCTOU)      | completed   | 2026-05-13 |
| TASK-002 | Fix C-2 (past-slot guard)                   | completed   | 2026-05-13 |
| TASK-003 | Fix H-1 (any-staff advisory lock + recheck) | completed   | 2026-05-13 |
| TASK-004 | Fix H-2 (rate limiting on booking endpoints)| in_progress | 2026-05-13 |

# Rotation Rule

If `in-progress.md` exceeds 30 tasks:

- move completed work into done
- move future work into backlog

# State Machine Rule

Tasks must move in order:

`planned` -> `ready` -> `in_progress` -> `review` -> `completed` -> `archived`

Use `blocked` only as a temporary state from `ready`, `in_progress`, or `review`.
