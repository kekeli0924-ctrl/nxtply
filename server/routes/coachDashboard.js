import { Router } from 'express';
import crypto from 'crypto';
import { getDb } from '../db.js';
import { requireCoach } from '../auth.js';

const router = Router();

// GET /api/coach/dashboard — all players with summary stats
router.get('/dashboard', requireCoach, (req, res) => {
  const db = getDb();
  const players = db.prepare(`
    SELECT u.id, u.username FROM coach_players cp
    JOIN users u ON u.id = cp.player_id
    WHERE cp.coach_id = ?
    ORDER BY cp.joined_at DESC
  `).all(req.userId);

  const now = new Date();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Get week boundaries (Mon-Sun)
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() + mondayOffset);
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const result = players.map(p => {
    const sessionsLast7d = db.prepare('SELECT COUNT(*) as c FROM sessions WHERE date >= ? AND user_id = ?').get(weekAgo, p.id)?.c || 0;
    const lastSession = db.prepare('SELECT date FROM sessions WHERE user_id = ? ORDER BY date DESC LIMIT 1').get(p.id);

    const assignedThisWeek = db.prepare(
      'SELECT COUNT(*) as c FROM assigned_plans WHERE player_id = ? AND date >= ? AND date <= ?'
    ).get(p.id, weekStartStr, weekEndStr)?.c || 0;

    const assignedDates = db.prepare(
      'SELECT date FROM assigned_plans WHERE player_id = ? AND date >= ? AND date <= ?'
    ).all(p.id, weekStartStr, weekEndStr).map(r => r.date);

    const completedThisWeek = assignedDates.length > 0
      ? db.prepare(`SELECT COUNT(DISTINCT date) as c FROM sessions WHERE user_id = ? AND date IN (${assignedDates.map(() => '?').join(',')})`)
          .get(p.id, ...assignedDates)?.c || 0
      : 0;

    return {
      playerId: p.id,
      username: p.username,
      sessionsLast7d,
      lastSessionDate: lastSession?.date || null,
      assignedThisWeek,
      completedThisWeek,
      compliancePercent: assignedThisWeek > 0 ? Math.round((completedThisWeek / assignedThisWeek) * 100) : null,
    };
  });

  res.json(result);
});

// GET /api/coach/player/:playerId — full player data for coach view
router.get('/player/:playerId', requireCoach, (req, res) => {
  const db = getDb();
  const playerId = parseInt(req.params.playerId, 10);

  // Verify on roster
  const link = db.prepare('SELECT id FROM coach_players WHERE coach_id = ? AND player_id = ?').get(req.userId, playerId);
  if (!link) return res.status(403).json({ error: 'Player not on your roster', code: 'FORBIDDEN' });

  const player = db.prepare('SELECT id, username FROM users WHERE id = ?').get(playerId);
  if (!player) return res.status(404).json({ error: 'Player not found', code: 'NOT_FOUND' });

  const sessions = db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY date DESC LIMIT 50').all(playerId).map(row => ({
    id: row.id,
    date: row.date,
    duration: row.duration,
    drills: JSON.parse(row.drills || '[]'),
    notes: row.notes,
    intention: row.intention,
    sessionType: row.session_type,
    position: row.position,
    quickRating: row.quick_rating,
    shooting: JSON.parse(row.shooting || 'null'),
    passing: JSON.parse(row.passing || 'null'),
    fitness: JSON.parse(row.fitness || 'null'),
    idpGoals: JSON.parse(row.idp_goals || '[]'),
  }));

  const matches = db.prepare('SELECT * FROM matches WHERE user_id = ? ORDER BY date DESC LIMIT 20').all(playerId).map(row => ({
    id: row.id,
    date: row.date,
    opponent: row.opponent,
    result: row.result,
    minutesPlayed: row.minutes_played,
    goals: row.goals,
    assists: row.assists,
    rating: row.rating,
  }));

  const idpGoals = db.prepare('SELECT * FROM idp_goals WHERE user_id = ? ORDER BY created_at DESC').all(playerId).map(row => ({
    id: row.id,
    corner: row.corner,
    text: row.text,
    targetDate: row.target_date,
    progress: row.progress,
    status: row.status,
  }));

  const assignedPlans = db.prepare('SELECT * FROM assigned_plans WHERE player_id = ? AND coach_id = ? ORDER BY date ASC').all(playerId, req.userId).map(row => ({
    id: row.id,
    date: row.date,
    drills: JSON.parse(row.drills || '[]'),
    targetDuration: row.target_duration,
    notes: row.notes,
  }));

  res.json({
    player: { id: player.id, username: player.username },
    sessions,
    matches,
    idpGoals,
    assignedPlans,
  });
});

// ── Coach Scouting ──────────────────────────────────────────

// GET /api/coach/scouting-reports — coach's own scouting reports
router.get('/scouting-reports', requireCoach, (req, res) => {
  const db = getDb();
  const reports = db.prepare(
    "SELECT id, club_name, level, age_group, gender, location, match_date, status, confidence_summary, game_plan, created_at FROM scouting_reports WHERE user_id = ? AND shared_by_coach_id IS NULL ORDER BY created_at DESC"
  ).all(req.userId);

  res.json(reports.map(r => ({
    id: r.id,
    clubName: r.club_name,
    level: r.level,
    ageGroup: r.age_group,
    gender: r.gender,
    matchDate: r.match_date,
    status: r.status,
    confidenceSummary: r.confidence_summary,
    hasGamePlan: r.game_plan != null,
    createdAt: r.created_at,
  })));
});

// POST /api/coach/share-scouting/:reportId — share a report with players
router.post('/share-scouting/:reportId', requireCoach, (req, res) => {
  const db = getDb();
  const { playerIds } = req.body;
  if (!Array.isArray(playerIds) || playerIds.length === 0) {
    return res.status(400).json({ error: 'playerIds array required' });
  }

  // Verify the report belongs to the coach
  const report = db.prepare('SELECT * FROM scouting_reports WHERE id = ? AND user_id = ?').get(req.params.reportId, req.userId);
  if (!report) return res.status(404).json({ error: 'Report not found' });

  // Verify all players are on roster
  const roster = db.prepare('SELECT player_id FROM coach_players WHERE coach_id = ?').all(req.userId).map(r => r.player_id);
  const validIds = playerIds.filter(id => roster.includes(id));
  if (validIds.length === 0) return res.status(400).json({ error: 'No valid players on your roster' });

  let shared = 0;
  for (const playerId of validIds) {
    // Don't duplicate — check if already shared
    const existing = db.prepare(
      "SELECT id FROM scouting_reports WHERE user_id = ? AND club_name = ? AND shared_by_coach_id = ?"
    ).get(playerId, report.club_name, req.userId);
    if (existing) continue;

    db.prepare(`INSERT INTO scouting_reports (id, user_id, club_name, level, age_group, gender, location, match_date, status, report_content, confidence_summary, game_plan, shared_by_coach_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      crypto.randomUUID(), playerId, report.club_name, report.level, report.age_group, report.gender,
      report.location, report.match_date, report.status, report.report_content,
      report.confidence_summary, report.game_plan, req.userId
    );
    shared++;
  }

  res.json({ shared, total: validIds.length });
});

// ── Squad Pulse ─────────────────────────────────────────────

// GET /api/coach/squad-pulse — team-level intelligence
router.get('/squad-pulse', requireCoach, (req, res) => {
  const db = getDb();

  const players = db.prepare(`
    SELECT u.id, u.username FROM coach_players cp
    JOIN users u ON u.id = cp.player_id
    WHERE cp.coach_id = ?
  `).all(req.userId);

  if (players.length === 0) {
    return res.json({ players: [], insights: [], summary: null });
  }

  const now = new Date();
  const weekAgoDate = new Date(now - 7 * 86400000);
  const twoWeeksAgoDate = new Date(now - 14 * 86400000);
  const monthAgoDate = new Date(now - 30 * 86400000);
  const twoMonthsAgoDate = new Date(now - 60 * 86400000);

  const weekAgo = weekAgoDate.toISOString().slice(0, 10);
  const twoWeeksAgo = twoWeeksAgoDate.toISOString().slice(0, 10);
  const monthAgo = monthAgoDate.toISOString().slice(0, 10);
  const twoMonthsAgo = twoMonthsAgoDate.toISOString().slice(0, 10);
  const todayStr = now.toISOString().slice(0, 10);

  // Week boundaries for compliance
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() + mondayOffset);
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr = new Date(weekStart.getTime() + 6 * 86400000).toISOString().slice(0, 10);
  const prevWeekStart = new Date(weekStart.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const prevWeekEnd = new Date(weekStart.getTime() - 86400000).toISOString().slice(0, 10);

  // ─── Batched fetch: one query each for settings, sessions, assigned_plans ───
  // This replaces the previous N+1 pattern that ran 8+ queries per player.
  const playerIds = players.map(p => p.id);
  const placeholders = playerIds.map(() => '?').join(',');

  // All settings for the roster in one query
  const settingsRows = db.prepare(
    `SELECT user_id, player_name, position FROM settings WHERE user_id IN (${placeholders})`
  ).all(...playerIds);
  const settingsByUserId = new Map();
  for (const s of settingsRows) settingsByUserId.set(s.user_id, s);

  // All sessions for the roster (last 2 months) in one query
  const allSessions = db.prepare(
    `SELECT id, user_id, date, shooting, passing, quick_rating FROM sessions WHERE user_id IN (${placeholders}) AND date >= ? ORDER BY date DESC`
  ).all(...playerIds, twoMonthsAgo);
  const sessionsByUserId = new Map();
  for (const s of allSessions) {
    if (!sessionsByUserId.has(s.user_id)) sessionsByUserId.set(s.user_id, []);
    sessionsByUserId.get(s.user_id).push(s);
  }

  // All assigned plans (this + previous week) in one query
  const allAssigned = db.prepare(
    `SELECT player_id, date FROM assigned_plans WHERE player_id IN (${placeholders}) AND date >= ? AND date <= ?`
  ).all(...playerIds, prevWeekStart, weekEndStr);
  const assignedByPlayer = new Map();
  for (const a of allAssigned) {
    if (!assignedByPlayer.has(a.player_id)) assignedByPlayer.set(a.player_id, []);
    assignedByPlayer.get(a.player_id).push(a.date);
  }

  const playerPulse = players.map(p => {
    const settings = settingsByUserId.get(p.id);
    const name = settings?.player_name || p.username;
    const position = settings?.position || 'General';

    const mySessions = sessionsByUserId.get(p.id) || [];

    // Filter sessions into time buckets in JS instead of hitting the DB 4 more times.
    const sessionsThisWeekArr = mySessions.filter(s => s.date >= weekStartStr && s.date <= weekEndStr);
    const sessionsLastWeekArr = mySessions.filter(s => s.date >= prevWeekStart && s.date <= prevWeekEnd);
    const sessionsThisMonthArr = mySessions.filter(s => s.date >= monthAgo);
    const sessionsLastMonthArr = mySessions.filter(s => s.date >= twoMonthsAgo && s.date < monthAgo);

    const sessionsThisWeek = sessionsThisWeekArr.length;
    const sessionsLastWeek = sessionsLastWeekArr.length;
    const sessionsThisMonth = sessionsThisMonthArr.length;
    const sessionsLastMonth = sessionsLastMonthArr.length;

    // Accuracy + RPE computed from in-memory slices
    const shotAcc = computeAccuracy(sessionsThisMonthArr, 'shooting');
    const shotAccPrev = computeAccuracy(sessionsLastMonthArr, 'shooting');
    const passAcc = computeAccuracy(sessionsThisMonthArr, 'passing');
    const passAccPrev = computeAccuracy(sessionsLastMonthArr, 'passing');
    const rpeThisWeek = computeAvgRPE(sessionsThisWeekArr);
    const rpeLastWeek = computeAvgRPE(sessionsLastWeekArr);

    // Compliance from the batched assigned_plans
    const myAssignedDates = assignedByPlayer.get(p.id) || [];
    const assignedThisWeekDates = myAssignedDates.filter(d => d >= weekStartStr && d <= weekEndStr);
    const assignedLastWeekDates = myAssignedDates.filter(d => d >= prevWeekStart && d <= prevWeekEnd);

    // Session dates for compliance comparison — use the filtered in-memory arrays.
    const sessionDatesThisWeek = new Set(sessionsThisWeekArr.map(s => s.date));
    const sessionDatesLastWeek = new Set(sessionsLastWeekArr.map(s => s.date));
    const completedThisWeek = assignedThisWeekDates.filter(d => sessionDatesThisWeek.has(d)).length;
    const completedLastWeek = assignedLastWeekDates.filter(d => sessionDatesLastWeek.has(d)).length;

    const assignedThisWeek = assignedThisWeekDates.length;
    const assignedLastWeek = assignedLastWeekDates.length;
    const compliancePct = assignedThisWeek > 0 ? Math.round((completedThisWeek / assignedThisWeek) * 100) : null;
    const compliancePctPrev = assignedLastWeek > 0 ? Math.round((completedLastWeek / assignedLastWeek) * 100) : null;

    // Pace label (simplified server-side)
    const paceLabel = computePaceLabel(shotAcc, shotAccPrev, passAcc, passAccPrev, sessionsThisWeek, sessionsLastWeek);

    return {
      playerId: p.id,
      name,
      position,
      sessionsThisWeek,
      sessionsLastWeek,
      sessionsThisMonth,
      sessionsLastMonth,
      shotAccuracy: shotAcc,
      shotAccuracyPrev: shotAccPrev,
      passAccuracy: passAcc,
      passAccuracyPrev: passAccPrev,
      rpeThisWeek,
      rpeLastWeek,
      compliancePct,
      compliancePctPrev,
      paceLabel,
    };
  });

  // Generate insights
  const insights = generateSquadInsights(playerPulse);

  // Summary stats
  const totalPlayers = playerPulse.length;
  const avgComplianceThisWeek = avg(playerPulse.filter(p => p.compliancePct != null).map(p => p.compliancePct));
  const avgCompliancePrevWeek = avg(playerPulse.filter(p => p.compliancePctPrev != null).map(p => p.compliancePctPrev));
  const totalSessionsThisWeek = playerPulse.reduce((s, p) => s + p.sessionsThisWeek, 0);
  const totalSessionsLastWeek = playerPulse.reduce((s, p) => s + p.sessionsLastWeek, 0);

  res.json({
    players: playerPulse,
    insights,
    summary: {
      totalPlayers,
      totalSessionsThisWeek,
      totalSessionsLastWeek,
      sessionTrend: totalSessionsLastWeek > 0
        ? Math.round(((totalSessionsThisWeek - totalSessionsLastWeek) / totalSessionsLastWeek) * 100)
        : null,
      avgComplianceThisWeek: avgComplianceThisWeek != null ? Math.round(avgComplianceThisWeek) : null,
      avgCompliancePrevWeek: avgCompliancePrevWeek != null ? Math.round(avgCompliancePrevWeek) : null,
      stallingCount: playerPulse.filter(p => p.paceLabel === 'stalling').length,
      acceleratingCount: playerPulse.filter(p => p.paceLabel === 'accelerating').length,
    },
  });
});

// ── Helper functions ────────────────

function computeAccuracy(sessions, type) {
  let made = 0, attempted = 0;
  for (const s of sessions) {
    const raw = s[type];
    if (!raw) continue;
    try {
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (type === 'shooting') {
        made += (data.leftFoot?.made || 0) + (data.rightFoot?.made || 0);
        attempted += (data.leftFoot?.attempted || 0) + (data.rightFoot?.attempted || 0);
      } else if (type === 'passing') {
        made += data.completed || 0;
        attempted += data.attempted || 0;
      }
    } catch { /* ignore */ }
  }
  return attempted > 0 ? Math.round((made / attempted) * 100) : null;
}

function computeAvgRPE(sessions) {
  const vals = sessions.map(s => s.quick_rating).filter(v => v != null && v > 0);
  return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10 : null;
}

function avg(arr) {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}

function computePaceLabel(shot, shotPrev, pass, passPrev, sessThis, sessLast) {
  // Simple velocity: average of available deltas
  const deltas = [];
  if (shot != null && shotPrev != null && shotPrev > 0) deltas.push(((shot - shotPrev) / shotPrev) * 100);
  if (pass != null && passPrev != null && passPrev > 0) deltas.push(((pass - passPrev) / passPrev) * 100);
  if (sessLast > 0) deltas.push(((sessThis - sessLast) / sessLast) * 100);

  if (deltas.length === 0) return 'steady';
  const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  if (avgDelta > 2) return 'accelerating';
  if (avgDelta < -2) return 'stalling';
  return 'steady';
}

// ── Insight Engine ──────────────────

function generateSquadInsights(players) {
  const insights = [];

  // 1. Stalling players
  const stalling = players.filter(p => p.paceLabel === 'stalling');
  if (stalling.length > 0) {
    if (stalling.length === 1) {
      const p = stalling[0];
      const metric = getWeakestMetric(p);
      insights.push({
        type: 'stalling',
        priority: 'high',
        text: `${p.name} has stalled${metric ? ` on ${metric}` : ''} this month. A focused 1-on-1 session could help break through.`,
        players: [p.playerId],
      });
    } else {
      const metrics = stalling.map(p => ({ name: p.name, metric: getWeakestMetric(p) }));
      const sharedMetric = findCommonMetric(metrics);
      if (sharedMetric) {
        insights.push({
          type: 'stalling',
          priority: 'high',
          text: `${stalling.length} players have stalled on ${sharedMetric} this month: ${stalling.map(p => p.name).join(', ')}. Consider a team drill focused on ${sharedMetric}.`,
          players: stalling.map(p => p.playerId),
        });
      } else {
        insights.push({
          type: 'stalling',
          priority: 'high',
          text: `${stalling.length} players are stalling: ${stalling.map(p => p.name).join(', ')}. Review their recent sessions for patterns.`,
          players: stalling.map(p => p.playerId),
        });
      }
    }
  }

  // 2. High RPE warnings (potential overtraining)
  const highRPE = players.filter(p => p.rpeThisWeek != null && p.rpeThisWeek >= 8);
  if (highRPE.length > 0) {
    for (const p of highRPE) {
      const rpeRising = p.rpeLastWeek != null && p.rpeThisWeek > p.rpeLastWeek + 1;
      if (rpeRising) {
        insights.push({
          type: 'overload',
          priority: 'high',
          text: `${p.name}'s intensity jumped from ${p.rpeLastWeek} to ${p.rpeThisWeek}/10 this week. Consider reducing load to prevent burnout.`,
          players: [p.playerId],
        });
      } else {
        insights.push({
          type: 'overload',
          priority: 'medium',
          text: `${p.name} is training at high intensity (${p.rpeThisWeek}/10). Keep an eye on fatigue.`,
          players: [p.playerId],
        });
      }
    }
  }

  // 3. Low RPE (under-challenging)
  const lowRPE = players.filter(p => p.rpeThisWeek != null && p.rpeThisWeek <= 3 && p.sessionsThisWeek >= 2);
  if (lowRPE.length > 0) {
    insights.push({
      type: 'underload',
      priority: 'medium',
      text: `${lowRPE.map(p => p.name).join(', ')} ${lowRPE.length === 1 ? 'is' : 'are'} training but at low intensity (RPE ≤ 3). Challenge them with harder drills or set targets.`,
      players: lowRPE.map(p => p.playerId),
    });
  }

  // 4. Compliance drop
  const complianceDrop = players.filter(p =>
    p.compliancePct != null && p.compliancePctPrev != null && p.compliancePctPrev > 0 &&
    (p.compliancePct - p.compliancePctPrev) <= -20
  );
  if (complianceDrop.length > 0) {
    if (complianceDrop.length >= Math.ceil(players.length * 0.4) && players.length >= 3) {
      // Team-wide drop
      const avgDrop = Math.round(avg(complianceDrop.map(p => p.compliancePct - p.compliancePctPrev)));
      insights.push({
        type: 'compliance',
        priority: 'high',
        text: `Overall squad compliance dropped ~${Math.abs(avgDrop)}% this week. School break? Tournament fatigue? Consider lighter plans to keep momentum.`,
        players: complianceDrop.map(p => p.playerId),
      });
    } else {
      for (const p of complianceDrop) {
        insights.push({
          type: 'compliance',
          priority: 'medium',
          text: `${p.name}'s compliance fell from ${p.compliancePctPrev}% to ${p.compliancePct}% this week. A quick check-in might help.`,
          players: [p.playerId],
        });
      }
    }
  }

  // 5. Inactive players (no sessions this week but had sessions last week)
  const goneQuiet = players.filter(p => p.sessionsThisWeek === 0 && p.sessionsLastWeek > 0);
  if (goneQuiet.length > 0) {
    if (goneQuiet.length === 1) {
      insights.push({
        type: 'inactive',
        priority: 'medium',
        text: `${goneQuiet[0].name} hasn't logged a session this week after ${goneQuiet[0].sessionsLastWeek} last week. Might be worth a check-in.`,
        players: [goneQuiet[0].playerId],
      });
    } else {
      insights.push({
        type: 'inactive',
        priority: 'medium',
        text: `${goneQuiet.length} players went quiet this week: ${goneQuiet.map(p => p.name).join(', ')}. Last week they were all active.`,
        players: goneQuiet.map(p => p.playerId),
      });
    }
  }

  // 6. Accelerating players (positive)
  const accel = players.filter(p => p.paceLabel === 'accelerating');
  if (accel.length > 0) {
    insights.push({
      type: 'accelerating',
      priority: 'low',
      text: `${accel.map(p => p.name).join(', ')} ${accel.length === 1 ? 'is' : 'are'} accelerating — their numbers are trending up. Recognize the effort!`,
      players: accel.map(p => p.playerId),
    });
  }

  // 7. Session frequency trend (team level)
  const totalThis = players.reduce((s, p) => s + p.sessionsThisWeek, 0);
  const totalLast = players.reduce((s, p) => s + p.sessionsLastWeek, 0);
  if (totalLast > 0 && totalThis > 0) {
    const pctChange = Math.round(((totalThis - totalLast) / totalLast) * 100);
    if (pctChange >= 20) {
      insights.push({
        type: 'volume',
        priority: 'low',
        text: `Squad training volume is up ${pctChange}% this week (${totalThis} vs ${totalLast} sessions). Great energy!`,
        players: [],
      });
    } else if (pctChange <= -20) {
      insights.push({
        type: 'volume',
        priority: 'medium',
        text: `Squad training volume dropped ${Math.abs(pctChange)}% this week (${totalThis} vs ${totalLast} sessions). What changed?`,
        players: [],
      });
    }
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return insights;
}

function getWeakestMetric(player) {
  const checks = [];
  if (player.shotAccuracy != null && player.shotAccuracyPrev != null && player.shotAccuracyPrev > 0) {
    checks.push({ metric: 'shooting accuracy', delta: ((player.shotAccuracy - player.shotAccuracyPrev) / player.shotAccuracyPrev) * 100 });
  }
  if (player.passAccuracy != null && player.passAccuracyPrev != null && player.passAccuracyPrev > 0) {
    checks.push({ metric: 'passing accuracy', delta: ((player.passAccuracy - player.passAccuracyPrev) / player.passAccuracyPrev) * 100 });
  }
  if (player.sessionsLastWeek > 0) {
    checks.push({ metric: 'session frequency', delta: ((player.sessionsThisWeek - player.sessionsLastWeek) / player.sessionsLastWeek) * 100 });
  }
  if (checks.length === 0) return null;
  checks.sort((a, b) => a.delta - b.delta);
  return checks[0].metric;
}

function findCommonMetric(playerMetrics) {
  const counts = {};
  for (const { metric } of playerMetrics) {
    if (metric) counts[metric] = (counts[metric] || 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (sorted.length > 0 && sorted[0][1] >= 2) return sorted[0][0];
  return null;
}

export default router;
