---
description: Pre-commit triple review — runs code-reviewer, security-auditor, and performance-engineer in parallel against the staged diff
---

Run code-reviewer, security-auditor, and performance-engineer subagents in parallel against the currently staged diff (`git diff --cached`). Each sticks to its own lens.

**code-reviewer** (report-only)
- Correctness, error handling, naming, dead code.
- Business logic mistakes specific to composed: role checks, IDP goal types (Technical / Tactical / Physical / Psychological), gamification math (XP, levels, streaks), personal records, invite-code uniqueness, parent-player privacy fields.

**security-auditor** (report-only)
- AuthN/AuthZ correctness across the three roles (player / coach / parent).
- Role escalation paths between roles.
- IDOR on any `:id`, `:userId`, `:playerId`, `:coachId`, `:sessionId` route.
- JWT misuse, refresh-token flow, env var leaks.
- Rate-limit evasion (we have express-rate-limit).
- File upload validation (multer + tus surfaces).
- SQL injection in any raw queries against better-sqlite3.

**performance-engineer** (can edit, but stay report-only for this command)
- N+1 query patterns against better-sqlite3.
- Blocking work on the Express main thread.
- Large React re-renders, especially Dashboard, LiveSessionMode, PlanWeekView.
- Image / video memory pressure on mobile.

## Output format

Synthesize at the end as a single bulleted list with severity tags:

- `[critical]` — block the commit
- `[should-fix]` — fix before merging to main
- `[nice-to-have]` — backlog

Reference exact `file:line` for every finding. If a finding is wrong because of context the agent doesn't have, push back in the synthesis rather than parroting it.

Stay report-only across all three agents. Do not edit any files.
