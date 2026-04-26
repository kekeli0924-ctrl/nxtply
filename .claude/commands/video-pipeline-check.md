---
description: Deep review of the video pipeline (record → compress → upload → analyze)
---

Run code-reviewer + performance-engineer + debugger in parallel against the video pipeline. This is composed's most fragile surface — five hops, three async waits, two third-party services (Gemini, tus server).

## Files to read

- `src/utils/videoRecorder.js` — MediaRecorder + OPFS storage
- `src/utils/ffmpeg.js` — client-side compression (FFmpeg.wasm)
- `src/components/VideoUpload.jsx` — compression + tus upload UI
- `src/components/LiveSessionMode.jsx` — recording during a guided session
- `src/components/CameraSetup.jsx` — pre-session rear-camera positioning
- `server/routes/videoAnalysis.js` — tus + Gemini coordination
- `server/services/videoAnalyzer.js` — Gemini multimodal call
- `server/services/frameExtractor.js` — server-side frame extraction
- `server/services/insightEngine.js` — AI-powered session insights

## What each agent does

**code-reviewer** (report-only)
- State-machine correctness. What states exist? What transitions are missing or duplicated?
- Edge cases: PWA backgrounded mid-compression, mid-upload, mid-analysis. App killed and reopened. Permission revoked mid-session.

**performance-engineer** (report-only for this command)
- Memory pressure on mobile during FFmpeg.wasm compression — are we streaming or holding the whole file?
- OPFS cleanup — do failed runs leave orphaned blobs?
- Upper bound on a 60-min training session at 720p H.264.
- Cold-start cost of FFmpeg.wasm and how UX handles the pause.

**debugger** (can edit but PROPOSE-ONLY for this command — list edits, don't apply)
- Top 10 failure modes in priority order. For each: trigger, observable symptom, current handling (if any), proposed handling.
- Examples to consider: NoSleep.js fails mid-session, FFmpeg cold-start visible to user, tus resume after long network loss, Gemini returns malformed JSON, no audio track, phone storage full mid-write to OPFS, camera permission revoked mid-session, user backgrounds the app and the OS kills it.

## Output

1. State diagram (textual) of the recording → compression → upload → analyze flow.
2. Top 10 failure modes table.
3. Top 5 fixes prioritized by user-perceived impact, each with: file:line, proposed change (no edits applied).

After this run, the top 5 should be turned into Vitest cases (we have vitest set up).
