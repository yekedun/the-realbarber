---
board: in-progress
updated: 2026-05-12
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

## TASK-016

```md
id: TASK-016
depends_on:
  - TASK-014
  - TASK-015
priority: medium
status: blocked
```

- [ ] drag/drop optimization

# Rotation Rule

If `in-progress.md` exceeds 30 tasks:

- move completed work into done
- move future work into backlog

# State Machine Rule

Tasks must move in order:

`planned` -> `ready` -> `in_progress` -> `review` -> `completed` -> `archived`

Use `blocked` only as a temporary state from `ready`, `in_progress`, or `review`.
