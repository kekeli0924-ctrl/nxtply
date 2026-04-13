/**
 * Leaderboard — roster-scoped weekly Pace-delta ranking.
 *
 * One endpoint: GET /api/leaderboard/team
 * One scope: the player's coach roster.
 * One dimension: weekly Pace delta (this week vs last week), descending.
 * One cache: in-memory Map keyed by "coach_id:week_start".
 */
import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

// In-memory week-level cache. Keyed by "coachId:weekStart". Cheap to recompute
// (~50ms for 20 players), so surviving restarts isn't important.
const cache = new Map();

function getWeekStart(now) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day; // Monday-based week
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

function computeAccuracy(sessions, type) {
  const valid = sessions.filter(s => {
    const data = s[type] ? (typeof s[type] === 'string' ? JSON.parse(s[type]) : s[type]) : null;
    if (!data) return false;
    if (type === 'shooting') return data.shotsTaken > 0;
    if (type === 'passing') return data.attempts > 0;
    return false;
  });
  if (valid.length === 0) return null;
  const sum = valid.reduce((acc, s) => {
    const data = typeof s[type] === 'string' ? JSON.parse(s[type]) : s[type];
    if (type === 'shooting') return acc + (data.goals / data.shotsTaken);
    if (type === 'passing') return acc + (data.completed / data.attempts);
    return acc;
  }, 0);
  return Math.round((sum / valid.length) * 100);
}

function computePaceDelta(shotThis, shotPrev, passThis, passPrev, sessThis, sessLast) {
  const deltas = [];
  if (shotThis != null && shotPrev != null && shotPrev > 0) deltas.push(((shotThis - shotPrev) / shotPrev) * 100);
  if (passThis != null && passPrev != null && passPrev > 0) deltas.push(((passThis - passPrev) / passPrev) * 100);
  if (sessLast > 0) deltas.push(((sessThis - sessLast) / sessLast) * 100);
  if (deltas.length === 0) return null;
  return Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 10) / 10;
}

function computeRanking(coachId, weekStartStr) {
  const db = getDb();

  // All roster players
  const players = db.prepare(`
    SELECT u.id, u.username FROM coach_players cp
    JOIN users u ON u.id = cp.player_id
    WHERE cp.coach_id = ?
  `).all(coachId);

  if (players.length < 2) return null; // No leaderboard for roster of 0 or 1

  const playerIds = players.map(p => p.id);
  const placeholders = playerIds.map(() => '?').join(',');

  // Batched: settings for display names
  const settingsRows = db.prepare(
    `SELECT user_id, player_name FROM settings WHERE user_id IN (${placeholders})`
  ).all(...playerIds);
  const nameByUser = new Map();
  for (const s of settingsRows) nameByUser.set(s.user_id, s.player_name);

  // Week boundaries
  const weekEnd = new Date(weekStartStr);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().split('T')[0];
  const prevWeekStart = new Date(weekStartStr);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);
  const prevWeekStartStr = prevWeekStart.toISOString().split('T')[0];
  const prevWeekEndStr = new Date(weekStartStr);
  prevWeekEndStr.setDate(prevWeekEndStr.getDate() - 1);
  const prevWeekEndStrVal = prevWeekEndStr.toISOString().split('T')[0];

  // Batched: all sessions for all roster players (2 weeks)
  const allSessions = db.prepare(
    `SELECT user_id, date, shooting, passing FROM sessions WHERE user_id IN (${placeholders}) AND date >= ? ORDER BY date DESC`
  ).all(...playerIds, prevWeekStartStr);
  const sessionsByUser = new Map();
  for (const s of allSessions) {
    if (!sessionsByUser.has(s.user_id)) sessionsByUser.set(s.user_id, []);
    sessionsByUser.get(s.user_id).push(s);
  }

  // Compute per-player delta
  const entries = players.map(p => {
    const sessions = sessionsByUser.get(p.id) || [];
    const thisWeek = sessions.filter(s => s.date >= weekStartStr && s.date <= weekEndStr);
    const lastWeek = sessions.filter(s => s.date >= prevWeekStartStr && s.date <= prevWeekEndStrVal);

    const shotThis = computeAccuracy(thisWeek, 'shooting');
    const shotPrev = computeAccuracy(lastWeek, 'shooting');
    const passThis = computeAccuracy(thisWeek, 'passing');
    const passPrev = computeAccuracy(lastWeek, 'passing');

    const delta = computePaceDelta(shotThis, shotPrev, passThis, passPrev, thisWeek.length, lastWeek.length);
    const label = delta == null ? 'no_activity'
      : delta > 2 ? 'accelerating'
      : delta < -2 ? 'stalling'
      : 'steady';

    return {
      playerId: p.id,
      name: nameByUser.get(p.id) || p.username,
      paceLabel: label,
      paceDelta: delta,
      sessionsThisWeek: thisWeek.length,
    };
  });

  // Sort: non-null deltas descending, then nulls at bottom
  entries.sort((a, b) => {
    if (a.paceDelta == null && b.paceDelta == null) return 0;
    if (a.paceDelta == null) return 1;
    if (b.paceDelta == null) return -1;
    return b.paceDelta - a.paceDelta;
  });

  // Assign ranks
  entries.forEach((e, i) => { e.rank = i + 1; });

  return {
    weekOf: weekStartStr,
    computedAt: new Date().toISOString(),
    rosterSize: entries.length,
    rankings: entries,
  };
}

// GET /api/leaderboard/team
router.get('/team', (req, res) => {
  const db = getDb();

  // Find this player's coach
  const link = db.prepare(`
    SELECT coach_id FROM coach_players WHERE player_id = ?
  `).get(req.userId);

  if (!link) return res.json(null); // No coach → no leaderboard

  const coachId = link.coach_id;
  const weekStart = getWeekStart(new Date());
  const cacheKey = `${coachId}:${weekStart}`;

  // Check cache
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    // Tag the current player
    const rankings = cached.rankings.map(r => ({ ...r, isMe: r.playerId === req.userId }));
    const myRank = rankings.find(r => r.isMe)?.rank ?? null;
    return res.json({ ...cached, rankings, myRank });
  }

  // Compute fresh
  const result = computeRanking(coachId, weekStart);
  if (!result) return res.json(null);

  // Store in cache (without isMe — that's per-request)
  cache.set(cacheKey, result);

  // Clean old weeks from cache (keep max 3 entries per coach)
  for (const [key] of cache) {
    if (key.startsWith(`${coachId}:`) && key !== cacheKey) {
      // Keep last week's cache for the "up from Xth" feature
      const keyWeek = key.split(':')[1];
      const lastWeek = new Date(weekStart);
      lastWeek.setDate(lastWeek.getDate() - 7);
      if (keyWeek !== lastWeek.toISOString().split('T')[0]) {
        cache.delete(key);
      }
    }
  }

  // Tag current player
  const rankings = result.rankings.map(r => ({ ...r, isMe: r.playerId === req.userId }));
  const myRank = rankings.find(r => r.isMe)?.rank ?? null;

  // Try to get last week's rank
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekKey = `${coachId}:${lastWeekStart.toISOString().split('T')[0]}`;
  const lastWeekCache = cache.get(lastWeekKey);
  const lastWeekRank = lastWeekCache
    ? (lastWeekCache.rankings.find(r => r.playerId === req.userId)?.rank ?? null)
    : null;

  res.json({ ...result, rankings, myRank, lastWeekRank });
});

export default router;
