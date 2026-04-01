import { Router } from 'express';
import crypto from 'crypto';
import { getDb } from '../db.js';
import { requireCoach } from '../auth.js';
import { validate, redeemInviteSchema } from '../validation.js';

const router = Router();

// POST /api/roster/invite — coach generates an invite code
router.post('/invite', requireCoach, (req, res) => {
  const db = getDb();
  const code = crypto.randomBytes(4).toString('hex').toUpperCase();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO invite_codes (code, coach_id, expires_at) VALUES (?, ?, ?)').run(code, req.userId, expiresAt);
  res.status(201).json({ code, expiresAt });
});

// GET /api/roster/invites — list coach's invite codes
router.get('/invites', requireCoach, (req, res) => {
  const db = getDb();
  const codes = db.prepare('SELECT code, created_at, expires_at, used_by, used_at FROM invite_codes WHERE coach_id = ? ORDER BY created_at DESC').all(req.userId);
  res.json(codes.map(c => ({
    code: c.code,
    createdAt: c.created_at,
    expiresAt: c.expires_at,
    used: c.used_by != null,
    usedAt: c.used_at,
  })));
});

// DELETE /api/roster/invite/:code — revoke unused code
router.delete('/invite/:code', requireCoach, (req, res) => {
  const db = getDb();
  const code = db.prepare('SELECT coach_id, used_by FROM invite_codes WHERE code = ?').get(req.params.code);
  if (!code) return res.status(404).json({ error: 'Code not found', code: 'NOT_FOUND' });
  if (code.coach_id !== req.userId) return res.status(403).json({ error: 'Not your code', code: 'FORBIDDEN' });
  if (code.used_by != null) return res.status(400).json({ error: 'Code already used', code: 'ALREADY_USED' });
  db.prepare('DELETE FROM invite_codes WHERE code = ?').run(req.params.code);
  res.json({ ok: true });
});

// POST /api/roster/join — player redeems an invite code
router.post('/join', validate(redeemInviteSchema), (req, res) => {
  const db = getDb();
  if (req.userRole === 'coach') {
    return res.status(400).json({ error: 'Coaches cannot join another coach', code: 'INVALID_ROLE' });
  }

  const invite = db.prepare('SELECT code, coach_id, expires_at, used_by FROM invite_codes WHERE code = ?').get(req.body.code);
  if (!invite) return res.status(404).json({ error: 'Invalid invite code', code: 'INVALID_CODE' });
  if (invite.used_by != null) return res.status(400).json({ error: 'Code already used', code: 'ALREADY_USED' });
  if (new Date(invite.expires_at) < new Date()) return res.status(400).json({ error: 'Code expired', code: 'CODE_EXPIRED' });

  // Check if player already has a coach
  const existing = db.prepare('SELECT coach_id FROM coach_players WHERE player_id = ?').get(req.userId);
  if (existing) return res.status(400).json({ error: 'You are already linked to a coach. Leave your current coach first.', code: 'ALREADY_LINKED' });

  db.prepare('INSERT INTO coach_players (coach_id, player_id) VALUES (?, ?)').run(invite.coach_id, req.userId);
  db.prepare('UPDATE invite_codes SET used_by = ?, used_at = datetime(\'now\') WHERE code = ?').run(req.userId, invite.code);

  const coach = db.prepare('SELECT id, username FROM users WHERE id = ?').get(invite.coach_id);
  res.json({ coachId: coach.id, coachName: coach.username });
});

// GET /api/roster — coach's player list with summary stats
router.get('/', requireCoach, (req, res) => {
  const db = getDb();
  const players = db.prepare(`
    SELECT u.id, u.username, s.player_name
    FROM coach_players cp
    JOIN users u ON u.id = cp.player_id
    LEFT JOIN settings s ON s.id = 1
    WHERE cp.coach_id = ?
    ORDER BY cp.joined_at DESC
  `).all(req.userId);

  const now = new Date();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Get week start (Monday)
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() + mondayOffset);
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const result = players.map(p => {
    const sessionsLast7d = db.prepare('SELECT COUNT(*) as c FROM sessions WHERE date >= ?').get(weekAgo)?.c || 0;
    const sessionsLast30d = db.prepare('SELECT COUNT(*) as c FROM sessions WHERE date >= ?').get(monthAgo)?.c || 0;
    const lastSession = db.prepare('SELECT date FROM sessions ORDER BY date DESC LIMIT 1').get();
    const assignedThisWeek = db.prepare('SELECT COUNT(*) as c FROM assigned_plans WHERE player_id = ? AND date >= ? AND date <= ?').get(p.id, weekStartStr, weekEndStr)?.c || 0;
    const assignedDates = db.prepare('SELECT date FROM assigned_plans WHERE player_id = ? AND date >= ? AND date <= ?').all(p.id, weekStartStr, weekEndStr).map(r => r.date);
    const completedThisWeek = assignedDates.length > 0
      ? db.prepare(`SELECT COUNT(DISTINCT date) as c FROM sessions WHERE date IN (${assignedDates.map(() => '?').join(',')})`)
          .get(...assignedDates)?.c || 0
      : 0;

    return {
      playerId: p.id,
      username: p.username,
      playerName: p.player_name || p.username,
      sessionsLast7d,
      sessionsLast30d,
      lastSessionDate: lastSession?.date || null,
      assignedThisWeek,
      completedThisWeek,
      compliancePercent: assignedThisWeek > 0 ? Math.round((completedThisWeek / assignedThisWeek) * 100) : null,
    };
  });

  res.json(result);
});

// DELETE /api/roster/:playerId — remove player from roster
router.delete('/:playerId', requireCoach, (req, res) => {
  const db = getDb();
  const playerId = parseInt(req.params.playerId, 10);
  const link = db.prepare('SELECT id FROM coach_players WHERE coach_id = ? AND player_id = ?').get(req.userId, playerId);
  if (!link) return res.status(404).json({ error: 'Player not on your roster', code: 'NOT_FOUND' });
  db.prepare('DELETE FROM coach_players WHERE coach_id = ? AND player_id = ?').run(req.userId, playerId);
  res.json({ ok: true });
});

// GET /api/roster/my-coach — player gets their linked coach
router.get('/my-coach', (req, res) => {
  const db = getDb();
  const link = db.prepare(`
    SELECT u.id, u.username FROM coach_players cp
    JOIN users u ON u.id = cp.coach_id
    WHERE cp.player_id = ?
  `).get(req.userId);
  res.json(link ? { coachId: link.id, coachName: link.username } : null);
});

// DELETE /api/roster/leave — player leaves their coach
router.delete('/leave', (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM coach_players WHERE player_id = ?').run(req.userId);
  if (result.changes === 0) return res.status(400).json({ error: 'Not linked to any coach', code: 'NOT_LINKED' });
  res.json({ ok: true });
});

export default router;
