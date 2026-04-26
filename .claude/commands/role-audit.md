---
description: Role-based access audit across composed's three roles (player / coach / parent)
---

security-auditor — audit role-based access in composed. Three roles: player, coach, parent. Build an access matrix and identify gaps.

## What to check

1. **Ownership enforcement** — every `:id`, `:userId`, `:playerId`, `:coachId`, `:sessionId` route enforces ownership, not just authentication. A player should never reach another player's session by guessing the ID.
2. **Coach scope** — coaches only see players in their roster (linked via invite codes). They cannot read sessions, IDP goals, or video analyses for unrelated players.
3. **Parent scope** — parents only see the player they linked to (via parent-player invite code), and only the fields the player has chosen to share. Player privacy settings can hide ratings, coach feedback, or IDP goals — verify those settings are honored on every parent-facing endpoint.
4. **JWT refresh** — the refresh flow doesn't allow role escalation. Refreshing a player token cannot mint a coach token.
5. **Invite codes** — single-use, expire, not brute-forceable (sufficient entropy + rate limiting).
6. **Admin endpoints** — anything role=coach-restricted that should actually require a separate admin role or stronger gate.

## Files to read first

- `server/auth.js` — token issuance, role guards, ownership middleware
- `server/db.js` — schema for users, sessions, parent_player_links, invite codes
- `server/routes/sessions.js` — most-touched player surface
- `server/routes/parent.js` — parent dashboard + invite codes
- `server/routes/programs.js`, `videoAnalysis.js`, and any other route file with `:id` params

## Output

1. **Access matrix** as a markdown table: route (method + path) | required role | required ownership check | current implementation status.
2. **List of routes that fail your check** with `file:line`.
3. **Three highest-risk gaps** in priority order, with proposed fixes.

Stay report-only.
