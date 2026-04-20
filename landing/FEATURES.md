# Composed — Feature Inventory

Source-of-truth audit for landing-page copy. Every claim below is grounded in a path under `src/`, `server/`, or a row in the SQLite schema. Last audited against the working tree on 2026-04-20.

---

## One-sentence positioning

Composed turns a youth player's daily training, matches, and videos into a single weighted score — **Pace** — that coaches can act on and parents can trust.

---

## Core differentiators (ranked by uniqueness)

1. **Position-weighted Pace score.** One number per player, recomputed from 5 sub-signals (shooting, passing, consistency, duration, load) using per-position weight tables. A striker's Pace weights shooting at 40%; a centre-back's weights it at 5%. Implementation: `src/utils/pace.js` (237 lines, 7 position tables). Nothing else on the market scores the *same player differently based on where they play*.
2. **4-week homework blocks with revocable parent digest URLs.** A coach assembles an assigned plan across 4 weeks, bookends it with benchmark retests, and can generate a snapshot URL (`/r/:slug`) that a parent can open with no account. Snapshot is frozen at generation time, revocable with one click. Files: `server/routes/blocks.js` (17KB), `server/routes/digests.js` (15KB), `src/components/BlockDetail.jsx`, `src/components/DigestShareModal.jsx`, `src/components/PublicDigest.jsx`. Migrations 27–28.
3. **Video-to-coaching-notes pipeline, fully offline-first on the client.** A phone clip is H.264-compressed with `ffmpeg.wasm` in the browser, uploaded resumably via Tus (`@tus/server` + `@tus/file-store`), frame-sampled, then analysed by Gemini with a `gemini-2.5-pro → gemini-2.5-flash` fallback. Output is time-coded coaching feedback, not a generic highlight reel. Files: `server/services/videoAnalyzer.js`, `server/services/frameExtractor.js`, `src/components/VideoUpload.jsx`.
4. **Identity + Pace blend.** Players pick (or multi-select) from 5 archetypes — Scorer, Speedster, Playmaker, Engine, Rock — each with its own drill boosts and its own vocabulary for Pace ("SCORER'S PACE", etc.). Files: `src/utils/identity.js` (245 lines, 5 archetypes with motivation quotes, drill category weightings, and paceLabel overrides).
5. **Benchmark percentile ranking against FA England + US Soccer DA norms.** LSPT and LSST tests return a percentile via linear interpolation against age-group + skill-level curves, then bucket into Elite (≥90) / Advanced (≥75) / Competitive (≥50) / Developing (≥25) / Lower. Files: `src/utils/benchmarks.js` (240 lines), `src/components/BenchmarkTests.jsx`.

---

## Full feature inventory

### 1. Authentication & account system
- Username + password (bcryptjs, 12 rounds) and Google Sign-In (Google Identity Services ID-token flow, no OAuth redirect). `server/auth.js`.
- JWT access (1h) + refresh (7d) with `token_version` revocation on password change or Google auto-link. `server/db.js` users table.
- Three roles — player, coach, parent — each with its own shell and permissions. Role check is baked into route middleware.
- `email_verified` column distinguishes Google-verified emails (safe to auto-link) from typed password-account emails (never auto-linked).

### 2. Training session logger
- Session = date + drills + intention + session_type + position + quick_rating (1–5) + body_check + per-skill notes (shooting/passing/fitness/delivery/attacking) + reflection. Schema in `server/db.js`.
- IDP goals (Individual Development Plan) attached per session, structured by the 4 corners (technical / tactical / physical / psychological).
- Readiness check pre-session prompts body state (energy, soreness) and writes it into `body_check`.
- Quick Session Form for one-tap logging when detail isn't needed; Session Logger for full detail. Components: `QuickSessionForm.jsx`, `SessionLogger.jsx`, `ReadinessCheck.jsx`.
- Live Session Mode runs the plan with a timer and drill-by-drill prompts (`LiveSessionMode.jsx`, `SessionCompleteScreen.jsx`).
- Session comments: coaches and parents can leave comments on a player's session (`session_comments` table, `SessionComments.jsx`).

### 3. Pace — the core metric
- 237-line calculator. 6 position weight tables (Striker, Winger, CAM, CDM, CB, GK) + a General default. Sub-signals: shooting, passing, consistency, duration, load. Output is 0–100.
- Pace Tab surfaces current, 7-day, and 30-day Pace; drill-down per sub-signal. Components: `PaceTab.jsx`, `PaceDetailView.jsx`, `PaceAuditView.jsx` (shows how the number was computed — auditability is a deliberate product decision).
- Comparison card lets players compare their Pace curve against squadmates. `ComparisonCard.jsx`.
- Squad Pulse card aggregates squad-wide Pace for coaches. `SquadPulseCard.jsx`.

### 4. Drill library & programs
- **76 curated drills** in SQLite `drills` table. Category split: Technical (43), Physical (15), Tactical (10), Psychological (4), Warm-Up & Cool-Down (4). Each row has difficulty, duration, reps description, equipment, space, description, coaching points, variations, position relevance. Source: `server/db.js` seed.
- **4 guided programs** (`programs` table): 4-Week Finishing Mastery (Shooting, intermediate, 3/wk), Ball Mastery Fundamentals (Dribbling, beginner, 4/wk), Complete Player (All-round, intermediate, 3/wk), Speed & Agility Camp (Physical, beginner-intermediate, 3/wk, 3 weeks). 49 pre-built program sessions.
- Custom Drills: a player or coach can add their own named drill (`custom_drills` table). 12 of the 76 drills also have reps/duration/instruction stubs in `src/constants/drills.js` for inline display.
- Drill Explorer (`DrillExplorer.jsx`, 320 lines) browses the full catalog with category / difficulty / duration filters.

### 5. Video analysis
- Client-side H.264 compression via `@ffmpeg/ffmpeg` before upload (keeps phone data costs low).
- Resumable uploads via Tus — a dropped connection resumes, not restarts.
- `frameExtractor.js` samples key frames; `videoAnalyzer.js` pushes them to Gemini 2.5 Pro with automatic fallback to 2.5 Flash if quota/rate-limit fires.
- Output stored in `video_analyses` table with status machine (uploaded → extracting → analyzing → complete | error), time-coded coaching feedback, optional clip timestamp, drill bookmarks, and link back to the session.
- Recording source captured (upload vs live) so feedback can be tailored. `recording_source` column.

### 6. Benchmark testing
- LSPT (Loughborough Soccer Passing Test) and LSST (Loughborough Soccer Shooting Test) with structured scoring forms.
- Percentile ranking by age group + skill level against published FA England + US Soccer DA norms. Linear interpolation between anchor percentiles.
- Tier labels Elite / Advanced / Competitive / Developing / Lower feed into Pace sub-signals and into Block summaries.
- Benchmarks tab (`BenchmarksTab.jsx`) shows history + trend line. Retest prompts are triggered inside blocks at week 2 and week 4.

### 7. Coach tools
- **Roster** (`roster.js`, `CoachRoster.jsx`) — invite codes (`invite_codes`), player joins, coach–player link rows (`coach_players`).
- **Assigned Plans** (`assigned_plans` table, `CoachPlanAssign.jsx`) — a coach assembles a dated plan of drills and pushes it to one or many players. The player's Daily Plan Card picks it up.
- **Coach Squad Dashboard** — per-player Pace, last session, benchmark status, block progress. `CoachSquadDashboard.jsx`, `CoachOverview.jsx`.
- **4-week Blocks** (`blocks` table, migration 27, `BlockSetupFlow.jsx`, `BlockDetail.jsx`) — a coach picks a 4-week window, attaches a program or free-form plan, sets baseline + week-2 + week-4 retests.
- **Revocable Digests** (`block_digests` table, migration 28, `digests.js`, `DigestShareModal.jsx`, `PublicDigest.jsx`) — generates a public `/r/:slug` URL with a frozen snapshot of the block's numbers; one-tap revoke returns a "no longer available" page for anyone who still has the link. Snapshot uses a privacy-safe `toPublicName` helper rather than raw usernames.
- Coach Chat (`CoachChat.jsx`) — 1:1 messaging with players via `messages` table.

### 8. Match logging & decision journal
- **Match Logger** (`matches` table, `MatchLogger.jsx`) — date, opponent, result (W/D/L), minutes, goals, assists, shots, passes completed, self-rating 1–10, notes. Drives `MatchHistory.jsx`.
- **Decision Journal** (`decision_journal` table, `DecisionJournal.jsx`) — post-match reflection tagged to specific decisions. Coach visibility optional.
- **Team Leaderboard** (`leaderboard.js`, `TeamLeaderboard.jsx`, `TeamRankCard.jsx`) — ranks players within a coach's roster by Pace (or selected sub-signal).

### 9. Gamification & social
- **Streak + XP system** (`src/utils/gamification.js`, 80 lines). XP per session (25), per daily-plan completion (50), per PR (100), per video analysis (30), streak bonus (10/day). Levels break every 200 XP.
- **15 badges** hard-coded in the same file (e.g., first session, first video, first PR, 7-day streak, 30-day streak).
- **Personal Records** (`personal_records` table, `PersonalRecords.jsx`) — tracks top metrics over time; triggers confetti via `canvas-confetti` on a new PR.
- **Social feed** (`SocialFeed.jsx`) — friend activity surface powered by `friend_connections` + session publish events. *Deliberately hidden from the player nav as of the last sprint.*
- **Friends** (`friends.js`, `friend_connections` table) — reciprocal friend rows (user_a, user_b).

### 10. Parent dashboard
- Parent–player link (`parent_player_links`) with explicit visibility settings (`parent_visibility_settings`) — a player can hide specific fields from a parent.
- `ParentDashboard.jsx` surfaces Pace trend, last 7 sessions, benchmark tier, and any block digest the coach has shared.
- Parent sees nothing by default until a player or coach grants visibility — consent-first by design.

### 11. Opponent prep & scouting
- **Game Plan Generator** (`server/services/gamePlanGenerator.js`, 451 lines) — rules-based first, AI-fallback second. Detects opponent style (`detectOpponentStyle`), computes a rules-based brief (`computeRulesBasedBrief`), builds a warm-up session with deterministic drill selection (`buildWarmupSession` uses a Mulberry32 seeded PRNG so the same opponent produces the same warm-up). AI fallback via Gemini, wrapped in `withTimeout` and `isRetryableGeminiError` for reliability.
- **Manus scouting** (`server/services/manusClient.js`, `server/routes/scouting.js`) — async task-based opponent report generation via the Manus API v2. Experimental.
- **Events** (`events.js`, `events` table, migration 26) — scheduled matches + sessions feed the generator with upcoming-opponent context.

### Infrastructure (not user-facing but worth knowing)
- 30 SQLite tables, 28 migrations, better-sqlite3 (synchronous, single-file, cheap to back up).
- PWA via `vite-plugin-pwa` + Workbox — installable, offline-capable.
- IndexedDB persistence (`idb` library) for session drafts — a dropped connection mid-entry doesn't lose data.
- Helmet + express-rate-limit + CSRF origin check + Zod validation on every request body.
- Backup script (`npm run backup`) writes timestamped SQLite snapshots into `server/data/backups/`.

---

## Currently on the landing page (`showcase/index.html`)

The existing rebuild showcases:
- Hero with the word **Pace** as the ghost serif centerpiece.
- Scroll-bound ball-to-goal chapter (ball rolls across, thuds into the net).
- 7-stage **Pace** rotation (different copy angles on the single-number pitch).
- Phone-video-to-proof scattered cards (the video pipeline).
- **Coach** chapter (assignment + digest proof).
- **Parent** chapter (consent-first visibility).
- 3-roles strip — player / coach / parent.
- Closing CTA.

It does **not** currently feature: benchmarks, blocks specifically (folded loosely into "coach"), programs, gamification, identity archetypes, decision journal.

---

## Recommended landing-page feature set (6–8)

Pick these for the narrative. Ordered by how much story they carry per pixel:

1. **Pace** — one number, position-weighted, auditable. Already the hero. Keep.
2. **Video-to-time-coded feedback** — the only feature where "phone → AI → coach notes in minutes" lands as a demo. Keep.
3. **4-week Blocks + revocable parent digest** — the trust proposition. *Not yet on the page and it should be.* This is the feature that flips a skeptical parent into a subscriber.
4. **Coach-assigned plans → player Daily Plan Card** — the closed loop that distinguishes Composed from a journaling app. Currently under-shown.
5. **Benchmarks with percentile tiering against FA / US Soccer norms** — the external-standard hook. Credibility in one chart.
6. **Identity archetypes + position-weighted scoring** — the "this knows who I actually am" hook. Dense, so pair it with the Pace section.
7. **Offline-first PWA + resumable uploads** — one understated line in the trust section. Parents in poor-Wi-Fi fields care about this more than feature matrices suggest.

Leave **programs** as the "we ship real content, not just a logger" proof — one tile showing 4-Week Finishing Mastery, with the 49 session count, is enough.

---

## Features to deliberately NOT showcase

- **Social feed / friends** — already hidden from player nav. Leading with it positions us against the wrong competitors (Strava, Hudl Social). Keep internal.
- **Leaderboards** — works inside a coached squad, embarrassing as a public feature. Tension with the "composed, individual" brand.
- **Ask Composed chat (`AskComposed.jsx`, `aiChat.js`)** — works, but not enough quality control for marketing copy. Don't demo it.
- **Manus scouting** — async, sometimes fails, very power-user. Cut.
- **Custom drills** — boring on a landing page; it's an escape valve, not a pitch.
- **Session templates** — same as above. Utility, not story.
- **AI fallback / retry wiring** — interesting to engineers, zero interest to parents.

---

## Honest weaknesses

- **Single-user legacy plumbing.** Many tables have `user_id INTEGER DEFAULT 1` (sessions, matches, training_plans, custom_drills, personal_records, decision_journal, idp_goals, benchmarks, templates, video_analyses). The default is a migration leftover from the single-user era; current code always writes a real user_id, but the default makes defence-in-depth weaker. A missing WHERE clause in future code could leak rows.
- **Drill detail coverage is thin in the client-side lookup.** 76 drills exist in SQLite, but only 12 have reps/duration/instruction stubs in `src/constants/drills.js`. Any drill outside the 12 falls back to a generic "10 min, focus on quality over quantity" stub when the UI needs inline reps. Workable, not polished.
- **No email password reset.** We collect emails but have no reset flow yet. Users who forget their password and didn't use Google Sign-In are stuck.
- **Gemini dependency for video analysis.** If Google deprecates the 2.5 Pro / Flash chain, the whole feature goes dark. Mitigated by the fallback chain, but not by a different provider.
- **Manus scouting is experimental.** Third-party API, async task model, no SLA we can point to. Fine to keep as an internal coach tool; don't sell it.
- **Onboarding is long.** First-time Google users go through intro → identity → position → username → role. Drop-off risk in the 3rd and 4th steps.
- **Mobile-first but not native.** PWA works, but iOS Add-to-Home-Screen is discoverable only by users who already know the trick. No App Store presence.
- **AskComposed (AI chat) quality is not battle-tested.** Built on `@google/genai`; no eval harness, no tone-controlled prompt versioning. Ship it quietly, don't put it on a billboard.
- **Benchmark norms are static.** Embedded in `benchmarks.js` as hard-coded anchor percentiles. Updating them requires a code change, not a data migration.

---
