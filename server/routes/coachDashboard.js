import { Router } from 'express';
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
    const sessionsLast7d = db.prepare('SELECT COUNT(*) as c FROM sessions WHERE date >= ?').get(weekAgo)?.c || 0;
    const lastSession = db.prepare('SELECT date FROM sessions ORDER BY date DESC LIMIT 1').get();

    const assignedThisWeek = db.prepare(
      'SELECT COUNT(*) as c FROM assigned_plans WHERE player_id = ? AND date >= ? AND date <= ?'
    ).get(p.id, weekStartStr, weekEndStr)?.c || 0;

    const assignedDates = db.prepare(
      'SELECT date FROM assigned_plans WHERE player_id = ? AND date >= ? AND date <= ?'
    ).all(p.id, weekStartStr, weekEndStr).map(r => r.date);

    const completedThisWeek = assignedDates.length > 0
      ? db.prepare(`SELECT COUNT(DISTINCT date) as c FROM sessions WHERE date IN (${assignedDates.map(() => '?').join(',')})`)
          .get(...assignedDates)?.c || 0
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

  const sessions = db.prepare('SELECT * FROM sessions ORDER BY date DESC LIMIT 50').all().map(row => ({
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

  const matches = db.prepare('SELECT * FROM matches ORDER BY date DESC LIMIT 20').all().map(row => ({
    id: row.id,
    date: row.date,
    opponent: row.opponent,
    result: row.result,
    minutesPlayed: row.minutes_played,
    goals: row.goals,
    assists: row.assists,
    rating: row.rating,
  }));

  const idpGoals = db.prepare('SELECT * FROM idp_goals ORDER BY created_at DESC').all().map(row => ({
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

export default router;
