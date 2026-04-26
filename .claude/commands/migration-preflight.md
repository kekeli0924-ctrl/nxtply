---
description: Pre-flight check for SQLite migrations before they ship to real users
---

architect-reviewer + debugger in parallel on the proposed migration in `server/db.js` (the latest entry, or the one currently being added). composed already has 18 migrations on better-sqlite3 — once a migration ships, undoing it on a real user's local data is hard.

## architect-reviewer (report-only)

- **Reversibility.** Is this migration reversible? If not, name what's lost and decide whether that's acceptable.
- **Populated-table compatibility.** Walk through the migration on a database with real user data: 10k sessions, 100 users, 18 prior migrations applied. Does it work?
- **Backfill.** Does it require backfilling existing rows? Is the default sensible? What about rows that don't fit the new constraint?
- **Role-scoping invariants.** Every row in composed belongs to a `user_id`. Does the new schema preserve this for every new column / table?
- **Index / trigger / constraint conflicts.** Does the migration conflict with anything already in the schema?

## debugger (can edit, but stay report-only here)

- **Scale simulation.** What goes wrong if the user has 10k rows in `sessions`? 1M? Does the migration block reads / writes during execution?
- **Lock duration.** With better-sqlite3 and WAL mode, what's the expected lock window? Will the user see a frozen UI during migration?
- **Partial-failure recovery.** If the migration crashes mid-run (process killed, disk full, schema-level error), what state is the DB left in? Is there a recovery path?
- **Rollback plan.** If a user runs it and reports a regression the next day, how do we get them out without data loss?

## Output

- ✅ **ship-it** OR ❌ **don't-ship**.
- If don't-ship: 3 concrete tweaks to the migration SQL (specific lines).
- If ship-it: any rollback runbook entries to add to `docs/`.

Never skip this command for migrations that drop columns, rename columns, or change a column's type. Those are the ones that bite.
