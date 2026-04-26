# COMPOSED — Subagent Routine

A specific, in-depth playbook for using the 9-agent group on the composed app. Tailored to the real stack, real file paths, and the actual risks of a youth-soccer training PWA with a multi-step video pipeline.

---

## TL;DR — minimum daily routine

If you do nothing else, do these three:

1. **Before any commit touching `server/`, auth, or video** → `/triple-review`
2. **Before any new SQLite migration** → `/migration-preflight`
3. **Mondays, after the cloud digest lands** → the Digest → Action ritual (§9)

Everything else is on-demand. The rest of this doc is the menu.

---

## 1. Trigger map (when X happens, do Y)

| Trigger | Agents | Section |
|---|---|---|
| About to commit ≥1 file | code-reviewer + security-auditor + performance-engineer | §3 |
| Touched `server/auth.js` or any role-scoped route | security-auditor (with role matrix) | §4 |
| Touched `server/services/videoAnalyzer.js` / `routes/videoAnalysis.js` / `services/frameExtractor.js` / `services/insightEngine.js` | code-reviewer + performance-engineer + security-auditor | §6 |
| Touched `src/utils/ffmpeg.js` or `videoRecorder.js` | debugger + performance-engineer | §6 |
| About to add a SQLite migration | architect-reviewer + debugger | §5 |
| Bug report from a specific device | debugger | §10 |
| Considering a new training program / drill type / IDP goal | thinker + competitive-analyst | §11 |
| Gemini API behavior changed | research-analyst (focused) | §7 |
| Service worker / PWA cache misbehaves | debugger | §8 |
| Slow render / layout thrash on mobile | performance-engineer | §12 |
| Quarterly market position check | market-researcher + competitive-analyst | §13 |

---

## 2. Slash commands

Four pre-built commands live at `~/soccer/.claude/commands/`:

| Command | What it runs |
|---|---|
| `/triple-review` | code-reviewer + security-auditor + performance-engineer on staged diff |
| `/role-audit` | security-auditor on three-role access matrix |
| `/video-pipeline-check` | code-reviewer + performance-engineer + debugger on the recording → compression → upload → analyze pipeline |
| `/migration-preflight` | architect-reviewer + debugger on a new migration |

These are the high-leverage, repeatable workflows. Use them by typing the slash command in any soccer-repo Claude Code session.

---

## 3. Daily — Pre-commit Triple Review

**When:** Before every meaningful commit. Skip only for one-line typos, copy changes, or doc-only edits.

**Cost:** ~3× a normal review (3 parallel agents). For a 200-line diff, expect $0.50–$2 on opus.

**Time:** ~90s parallel.

**Command:** `/triple-review`

**What to do with the output:**

- Any `[critical]` → fix now, re-run before committing.
- `[should-fix]` → fix in this PR or open a ticket if you split it.
- `[nice-to-have]` → ignore unless three pile up in the same area, then it's a refactor signal.

---

## 4. Auth & role security

This is composed's highest-blast-radius surface. Three roles (player/coach/parent) + invite codes + JWT + 30-day access tokens = lots of ways to leak someone else's child's data. School-adjacent product = trust-cost of a single leak is enormous.

**When:** Whenever you touch `server/auth.js`, `routes/parent.js`, any `:id` / `:userId` / `:playerId` route, or invite-code logic. Re-run monthly even if no auth changes — drift happens.

**Command:** `/role-audit`

**Treat as critical:**
- Any "fails ownership check" finding.
- Any "leaks across parent-player privacy settings" finding.
- Anything that lets a coach see players outside their roster.

---

## 5. Database migrations

You have 18 migrations on better-sqlite3. SQLite is forgiving about a lot of things and unforgiving about a few. Once a migration ships and a real user runs it, undoing it is hard.

**When:** Before adding migration #19 or beyond. Always.

**Command:** `/migration-preflight`

**Anti-pattern:** never skip this for migrations that drop or rename columns, or change a column's type. Those are the ones that bite.

---

## 6. Video pipeline — the most fragile surface

The flow: `MediaRecorder → OPFS → FFmpeg.wasm compression → tus upload → Express → Gemini analysis → IDB cache → UI auto-fill`. Five hops, three async waits, two third-party services.

**When:** After any change to the files in §1, or whenever a user reports a recording / upload / analysis bug.

**Command:** `/video-pipeline-check`

**What to do with the output:**

- Add the top 3 failure modes to `docs/` as known-issues with handling specs.
- Write Vitest cases for the top 5.
- The state-machine output is gold — turn it into a comment block at the top of `videoRecorder.js`.

---

## 7. Gemini integration — when the model or API behavior changes

Gemini iterates fast. A model swap or output-schema change can quietly degrade shot/pass detection without obvious errors.

**Cadence:** monthly, or whenever the digest flags a Gemini-related item.

**Prompt:**

```
research-analyst — focused scan, last 30 days only:

1. Has Google released a new Gemini model that's better-suited to sports
   video understanding than what composed currently uses? Identify the
   specific model name + release date + integration cost.
2. Have any breaking changes shipped in @google/genai (we're on ^1.47.0)?
3. Are there pricing changes that would affect the cost-per-analysis
   for a 30-min training video at 720p?
4. Are there new structured-output / JSON-mode features that would let
   us drop our parsing/validation layer?
5. Any reports of regressions on action recognition, ball tracking, or
   small-object detection in the last 30 days?

Cite each claim. Output as a 1-page brief with: what changed, what we
should do (if anything), priority ranking.
```

---

## 8. PWA / service worker — when offline mode misbehaves

`vite-plugin-pwa` is convenient and quietly complex. The cache strategy is the source of most "why is my user seeing stale data?" reports.

**Prompt:**

```
debugger — investigate a PWA cache issue. Read vite.config (look for
VitePWA config), public/manifest, and anywhere we register the service
worker. Then:

1. What's our current Workbox runtime caching strategy? Be specific
   about each route pattern.
2. Where could a user end up with stale UI:
   a. After a deploy bumps the bundle hash?
   b. After they log out and a different user logs in on the same
      device?
   c. After their JWT refreshes but the old API response is still
      cached?
3. Is the service worker cleaning up old caches on activate?
4. Are we caching any role-scoped API response (e.g. /api/sessions)?
   That's a privacy bug if cache survives a logout — explain why.
5. What's our manual override path if a user reports stale state?

Propose specific fixes (you can edit). Stay focused — don't refactor
the whole config, just patch.
```

---

## 9. Weekly — the Digest → Action ritual

Every Monday at 9 AM, a cloud routine commits a tech digest at `digests/YYYY-MM-DD.md` to this repo. The digest is useless if you don't react to it.

**Monday workflow (15 min):**

1. `cd ~/soccer && git pull`
2. Open `digests/<this-monday>.md`
3. Read the **Recommended Actions** section (3-5 items)
4. For each item, decide: **Now** / **Maybe** / **No**
5. For "Now" items, run:

```
thinker — given this week's digest recommendation:

[paste the recommendation verbatim]

Is this worth doing in composed? Read the relevant code first, then
walk through:
- Cost: rough hours of work + new dependency / migration / re-test.
- Benefit: which user (player/coach/parent) feels this and how much.
- Risk: what could break in our existing video pipeline / auth / PWA cache.
- Smallest version that proves it.

Verdict: do-now / do-later / don't-do, with one sentence why.
```

**Monthly:** scan `digests/` for patterns. Three "should adopt server-sent events" mentions across four weeks = real signal.

---

## 10. Incident playbook

User reports a bug. Severity decides the response.

**Sev 1** (data loss, auth failure, can't record sessions):

```
debugger — drop everything. User reports: [paste user's exact words].
Reproduce locally if possible. Walk through the failing code path.
Identify: root cause, immediate fix, regression test that would have
caught this.

If you cannot reproduce:
1. Name the 3 most likely causes given the symptoms.
2. List exact log lines / observables that would distinguish between
   them.
3. Propose a one-line debug log we can ship today to gather info.

You have edit access — apply the fix if you can find it. If you make
changes, summarize them at the top of your response.
```

**Sev 2** (UX glitch, intermittent perf): queue for the next session.
**Sev 3** (cosmetic): log it; don't context-switch.

After every Sev 1, write a 1-paragraph **post-incident note** in `docs/incidents/YYYY-MM-DD.md`.

---

## 11. Feature decision — before building something new

Before writing code for a non-trivial feature (>2 days of work, or touches the data model):

```
Run thinker + competitive-analyst + market-researcher in parallel.

Feature: [describe in 3 sentences — user, problem, your hunch at the
solution]

competitive-analyst: who in youth soccer training (Trace, Veo, Hudl,
Pivot, Soccerment, anyone else) does this or something close? What's
their implementation? User reviews — does it actually work?

market-researcher: rough demand signal. Are coaches / parents / players
in the youth soccer space asking for this? Forums, Reddit, Discord
communities. What pain are they describing?

thinker: read composed's existing surface (PlanWeekView, LiveSessionMode,
the programs/ directory, ParentDashboard). What's the smallest version
of this feature that proves it's worth more investment? What in the
existing data model / role system / PWA cache would it touch? What
would kill the idea?

Final verdict: build / probably-build / don't-build, with a 2-week MVP
scope if build.
```

---

## 12. Performance hotspots

Composed has predictable hot spots. When users report "it feels slow":

| Area | File | Common issue |
|---|---|---|
| Dashboard render | `src/components/Dashboard.jsx` | Re-rendering all session cards on state change |
| Stats / charts | `src/utils/stats.js` + Recharts | Computing aggregates on every render |
| LiveSessionMode | `src/components/LiveSessionMode.jsx` | Timer + camera + drill state — easy to over-render |
| PlanWeekView | `src/components/PlanWeekView.jsx` | Mapping a week of sessions without virtualization |
| Onboarding | `src/components/OnboardingFlow.jsx` | Loading too much on entry |
| FFmpeg cold start | `src/utils/ffmpeg.js` | First-load 6-10s; UI looks frozen |
| Video upload progress | `src/components/VideoUpload.jsx` | Re-render storm during tus chunk progress |

**Prompt:**

```
performance-engineer — focus only on [file or component]. Profile-style
analysis:

1. Render path: what triggers a re-render? How often? With what props?
2. Compute cost per render: any work that should be useMemo'd / moved
   out of the render?
3. Subscribe / interval / event listener cleanup — any leaks?
4. Mobile-specific issues: layout thrash, scroll jank, animation that
   blocks the main thread.

Output: top 3 fixes ranked by user-perceived impact, each with the
exact code change. You can edit — apply them if you're confident.
```

---

## 13. Strategic pulse — every 6 weeks

Take an hour:

```
Run thinker + market-researcher + competitive-analyst in parallel.

Question: where is composed positioned in the youth soccer training
space, and what's the most asymmetric move I could make in the next
60 days?

market-researcher: market size + growth in youth athletic development
software. Where is the puck going (AI coaching, in-school usage,
parent-engagement tools)?

competitive-analyst: top 3 competitors' last 60 days — funding, hires,
shipped features, public roadmap signal. Where are they distracted?
Where are they accelerating?

thinker: read README + recent commit log. What's composed's actual
moat right now (be honest)? What's the one move — feature, partnership,
positioning, pricing — that would compound that moat the most?

Output: 1-page strategic memo. End with one specific bet to make this
quarter.
```

---

## 14. Anti-patterns specific to composed

- ❌ Asking `code-reviewer` to fix things — it's report-only. Use main Claude or `debugger` to apply fixes.
- ❌ Running the digest routine on a branch other than main — the routine clones main.
- ❌ Running `security-auditor` on the React side — auth happens server-side. Point it at `server/`.
- ❌ Running `performance-engineer` on `server/db.js` for query micro-opts. Better-sqlite3 is fast; concurrent-write contention is the real risk. Frame the question that way.
- ❌ Letting `research-analyst` go open-ended on "what's new in soccer tech?" — too broad. Always narrow to a specific dependency, competitor, or 7-day window.
- ❌ Running `thinker` for trivial decisions. Use it for irreversible decisions only.
- ❌ Putting credentials, JWT secrets, or Gemini API keys into any prompt. Agents log to claude.ai sessions.

---

## 15. Cost & cadence summary

| Routine | When | Frequency | Est. cost/run |
|---|---|---|---|
| `/triple-review` | Pre-commit on real diffs | 1-3×/day | $0.50–$2 |
| `/role-audit` | Auth changes + monthly | ~monthly | $1–3 |
| `/migration-preflight` | New migrations | ~monthly | $1–2 |
| `/video-pipeline-check` | Pipeline changes | ~biweekly | $2–5 |
| Gemini scan | Vendor-driven | monthly | $0.50–1 |
| PWA cache investigation | On reports | rare | $1–2 |
| Incident debugger run | Sev 1 only | rare, spiky | $1–4 |
| Feature decision | Pre-build | ~weekly | $2–5 |
| Perf hotspot drill | On reports | weekly | $1–3 |
| Strategic pulse | 6-weekly | bimonthly | $5–10 |
| Weekly digest (cloud) | Monday 9am | 1×/week | counted in routine quota |

Realistic monthly spend on this routine: **$30–80**. Compare to: 4-8 hours of senior engineering time. The routine wins on cost-per-insight if you actually act on the outputs.

---

## Maintenance

- This document lives at `.claude/COMPOSED-ROUTINE.md` and is versioned with the code.
- Slash commands live at `.claude/commands/*.md`.
- The cloud routine (Monday digest) is configured at [claude.ai/code/routines](https://claude.ai/code/routines), separate from this repo.
- When agent definitions change in `~/.claude/agents/`, mirror them into `.claude/agents/` on this repo if the cloud routine needs them.
