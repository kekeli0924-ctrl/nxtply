import { Router } from 'express';
import crypto from 'crypto';
import { getDb } from '../db.js';
import { requireParent, requirePlayer } from '../auth.js';

const router = Router();

// Characters for invite codes (exclude ambiguous: 0/O, 1/I/l)
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateCode(length = 6) {
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }
  return code;
}

// ── Player-side endpoints ──────────────────────────────

// POST /api/parent/generate-code — Player generates a parent invite code
router.post('/generate-code', requirePlayer, (req, res) => {
  const db = getDb();

  // Check max 2 active parents
  const activeLinks = db.prepare(
    "SELECT COUNT(*) as cnt FROM parent_player_links WHERE player_id = ? AND status = 'active'"
  ).get(req.userId);
  if (activeLinks.cnt >= 2) {
    return res.status(400).json({ error: 'Maximum 2 parents connected. Revoke one first.' });
  }

  // Check if there's already an unused parent code for this player
  const existing = db.prepare(
    "SELECT code, expires_at FROM invite_codes WHERE coach_id = ? AND type = 'parent' AND used_by IS NULL AND expires_at > datetime('now')"
  ).get(req.userId);
  if (existing) {
    return res.json({ code: existing.code, expiresAt: existing.expires_at, existing: true });
  }

  const code = generateCode(6);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(
    "INSERT INTO invite_codes (code, coach_id, expires_at, type) VALUES (?, ?, ?, 'parent')"
  ).run(code, req.userId, expiresAt);

  res.json({ code, expiresAt, existing: false });
});

// GET /api/parent/my-parents — Player sees connected parents
router.get('/my-parents', requirePlayer, (req, res) => {
  const db = getDb();
  const links = db.prepare(`
    SELECT ppl.id, ppl.status, ppl.accepted_at, u.username as parentName
    FROM parent_player_links ppl
    JOIN users u ON u.id = ppl.parent_id
    WHERE ppl.player_id = ? AND ppl.status = 'active'
  `).all(req.userId);

  res.json(links);
});

// DELETE /api/parent/revoke/:linkId — Player revokes a parent connection
router.delete('/revoke/:linkId', requirePlayer, (req, res) => {
  const db = getDb();
  const linkId = parseInt(req.params.linkId, 10);

  const link = db.prepare(
    'SELECT id FROM parent_player_links WHERE id = ? AND player_id = ?'
  ).get(linkId, req.userId);

  if (!link) return res.status(404).json({ error: 'Link not found' });

  db.prepare("UPDATE parent_player_links SET status = 'revoked' WHERE id = ?").run(linkId);
  res.json({ ok: true });
});

// GET /api/parent/visibility-settings — Player gets privacy toggles
router.get('/visibility-settings', requirePlayer, (req, res) => {
  const db = getDb();
  let settings = db.prepare('SELECT * FROM parent_visibility_settings WHERE player_id = ?').get(req.userId);

  if (!settings) {
    // Create default row
    db.prepare('INSERT INTO parent_visibility_settings (player_id) VALUES (?)').run(req.userId);
    settings = { show_ratings: 1, show_coach_feedback: 1, show_idp_goals: 1 };
  }

  res.json({
    showRatings: !!settings.show_ratings,
    showCoachFeedback: !!settings.show_coach_feedback,
    showIdpGoals: !!settings.show_idp_goals,
  });
});

// PUT /api/parent/visibility-settings — Player updates privacy toggles
router.put('/visibility-settings', requirePlayer, (req, res) => {
  const db = getDb();
  const { showRatings, showCoachFeedback, showIdpGoals } = req.body;

  // Upsert
  db.prepare(`
    INSERT INTO parent_visibility_settings (player_id, show_ratings, show_coach_feedback, show_idp_goals)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(player_id) DO UPDATE SET
      show_ratings = excluded.show_ratings,
      show_coach_feedback = excluded.show_coach_feedback,
      show_idp_goals = excluded.show_idp_goals
  `).run(
    req.userId,
    showRatings ? 1 : 0,
    showCoachFeedback ? 1 : 0,
    showIdpGoals ? 1 : 0
  );

  res.json({ ok: true });
});

// ── Parent-side endpoints ──────────────────────────────

// POST /api/parent/connect — Parent submits invite code
router.post('/connect', requireParent, (req, res) => {
  const db = getDb();
  const { code } = req.body;
  if (!code || code.length < 4) return res.status(400).json({ error: 'Invalid code' });

  // Check max 3 children
  const childCount = db.prepare(
    "SELECT COUNT(*) as cnt FROM parent_player_links WHERE parent_id = ? AND status = 'active'"
  ).get(req.userId);
  if (childCount.cnt >= 3) {
    return res.status(400).json({ error: 'Maximum 3 children connected.' });
  }

  // Find the code
  const invite = db.prepare(
    "SELECT code, coach_id, expires_at, used_by FROM invite_codes WHERE code = ? AND type = 'parent'"
  ).get(code.toUpperCase());

  if (!invite) return res.status(404).json({ error: 'Invalid code. Check with your child.' });
  if (invite.used_by) return res.status(400).json({ error: 'This code has already been used.' });
  if (new Date(invite.expires_at) < new Date()) {
    return res.status(400).json({ error: 'This code has expired. Ask your child to generate a new one from their settings.' });
  }

  const playerId = invite.coach_id; // coach_id column stores the player who generated it

  // Check if already linked
  const existing = db.prepare(
    'SELECT id, status FROM parent_player_links WHERE parent_id = ? AND player_id = ?'
  ).get(req.userId, playerId);

  if (existing && existing.status === 'active') {
    return res.status(400).json({ error: 'Already connected to this child.' });
  }

  // Create or reactivate link
  if (existing) {
    db.prepare("UPDATE parent_player_links SET status = 'active', accepted_at = datetime('now'), invite_code = ? WHERE id = ?")
      .run(code, existing.id);
  } else {
    db.prepare(
      "INSERT INTO parent_player_links (parent_id, player_id, status, invite_code, accepted_at) VALUES (?, ?, 'active', ?, datetime('now'))"
    ).run(req.userId, playerId, code);
  }

  // Mark code as used
  db.prepare("UPDATE invite_codes SET used_by = ?, used_at = datetime('now') WHERE code = ?").run(req.userId, code);

  // Get child's name
  const settings = db.prepare('SELECT player_name FROM settings WHERE user_id = ?').get(playerId);
  const player = db.prepare('SELECT username FROM users WHERE id = ?').get(playerId);

  res.json({
    playerId,
    playerName: settings?.player_name || player?.username || 'Player',
  });
});

// DELETE /api/parent/disconnect/:linkId — Parent disconnects from a child
router.delete('/disconnect/:linkId', requireParent, (req, res) => {
  const db = getDb();
  const linkId = parseInt(req.params.linkId, 10);

  const link = db.prepare(
    'SELECT id FROM parent_player_links WHERE id = ? AND parent_id = ?'
  ).get(linkId, req.userId);

  if (!link) return res.status(404).json({ error: 'Link not found' });

  db.prepare("UPDATE parent_player_links SET status = 'revoked' WHERE id = ?").run(linkId);
  res.json({ ok: true });
});

// GET /api/parent/children — Parent gets list of connected children
router.get('/children', requireParent, (req, res) => {
  const db = getDb();
  const links = db.prepare(`
    SELECT ppl.id as linkId, ppl.player_id as playerId, u.username,
           ppl.accepted_at
    FROM parent_player_links ppl
    JOIN users u ON u.id = ppl.player_id
    WHERE ppl.parent_id = ? AND ppl.status = 'active'
  `).all(req.userId);

  // Get player names from settings (single-row design means we can't easily get per-player settings in dev mode)
  // In production with proper auth, each player would have their own settings row
  const children = links.map(link => {
    return {
      linkId: link.linkId,
      playerId: link.playerId,
      name: link.username,
      acceptedAt: link.accepted_at,
    };
  });

  res.json(children);
});

// GET /api/parent/dashboard/:playerId — Aggregated read-only dashboard
router.get('/dashboard/:playerId', requireParent, (req, res) => {
  const db = getDb();
  const playerId = parseInt(req.params.playerId, 10);

  // Verify active link
  const link = db.prepare(
    "SELECT id FROM parent_player_links WHERE parent_id = ? AND player_id = ? AND status = 'active'"
  ).get(req.userId, playerId);
  if (!link) return res.status(403).json({ error: 'No active connection to this player' });

  // Get visibility settings
  const vis = db.prepare('SELECT * FROM parent_visibility_settings WHERE player_id = ?').get(playerId)
    || { show_ratings: 1, show_coach_feedback: 1, show_idp_goals: 1 };

  // Player info
  const playerUser = db.prepare('SELECT username, role FROM users WHERE id = ?').get(playerId);
  const settings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(playerId);

  // Sessions (all)
  const allSessions = db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY date DESC').all(playerId);

  // This week (Mon-Sun)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  const mondayStr = monday.toISOString().slice(0, 10);

  const weekSessions = allSessions.filter(s => s.date >= mondayStr);
  const weekDrills = [];
  const sessionSummaries = weekSessions.map(s => {
    const drills = JSON.parse(s.drills || '[]');
    drills.forEach(d => { if (!weekDrills.includes(d)) weekDrills.push(d); });
    const shooting = JSON.parse(s.shooting || 'null');
    const passing = JSON.parse(s.passing || 'null');

    const summary = {
      id: s.id,
      date: s.date,
      duration: s.duration,
      type: s.session_type || 'Training',
      drills,
    };

    if (vis.show_ratings) {
      summary.rating = s.quick_rating;
    }

    if (shooting?.shotsTaken > 0) {
      summary.shotAccuracy = Math.round((shooting.goals / shooting.shotsTaken) * 100);
    }
    if (passing?.attempts > 0) {
      summary.passAccuracy = Math.round((passing.completed / passing.attempts) * 100);
    }

    return summary;
  });

  const avgRating = vis.show_ratings && weekSessions.length > 0
    ? Math.round(weekSessions.reduce((sum, s) => sum + (s.quick_rating || 3), 0) / weekSessions.length * 10) / 10
    : null;

  // Streak
  const sortedDates = [...new Set(allSessions.map(s => s.date))].sort().reverse();
  let streak = 0;
  if (sortedDates.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (sortedDates[0] === today || sortedDates[0] === yesterday) {
      let checkDate = new Date(sortedDates[0]);
      for (const d of sortedDates) {
        const expected = checkDate.toISOString().slice(0, 10);
        if (d === expected) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else if (d < expected) {
          break;
        }
      }
    }
  }

  // IDP Goals
  let idpProgress = null;
  if (vis.show_idp_goals) {
    const goals = db.prepare('SELECT * FROM idp_goals WHERE user_id = ?').all(playerId);
    idpProgress = { technical: { goals: [] }, tactical: { goals: [] }, physical: { goals: [] }, psychological: { goals: [] } };
    for (const g of goals) {
      const corner = idpProgress[g.corner];
      if (corner) {
        corner.goals.push({
          text: g.text,
          progress: g.progress || 0,
          targetDate: g.target_date,
          status: g.status,
        });
      }
    }
  }

  // Coach feedback
  let coachFeedback = null;
  if (vis.show_coach_feedback) {
    const coachLink = db.prepare('SELECT coach_id FROM coach_players WHERE player_id = ?').get(playerId);
    if (coachLink) {
      const coach = db.prepare('SELECT username FROM users WHERE id = ?').get(coachLink.coach_id);
      const plans = db.prepare(
        'SELECT date, drills, notes FROM assigned_plans WHERE player_id = ? ORDER BY date DESC LIMIT 5'
      ).all(playerId);

      const planList = plans.map(p => {
        const drills = JSON.parse(p.drills || '[]');
        const sessionOnDate = allSessions.find(s => s.date === p.date);
        return {
          date: p.date,
          drills: drills.map(d => d.name || d),
          completed: !!sessionOnDate,
        };
      });

      const totalPlans = db.prepare('SELECT COUNT(*) as cnt FROM assigned_plans WHERE player_id = ?').get(playerId)?.cnt || 0;
      const completedPlans = totalPlans > 0 ? planList.filter(p => p.completed).length : 0;

      coachFeedback = {
        coachName: coach?.username || 'Coach',
        recentPlans: planList,
        complianceRate: totalPlans > 0 ? Math.round((completedPlans / Math.min(totalPlans, 5)) * 100) : 0,
      };
    }
  }

  // Trends (last 5 weeks)
  const trends = { sessionsPerWeek: [], shotAccuracy: [], passAccuracy: [], labels: [] };
  for (let w = 4; w >= 0; w--) {
    const weekStart = new Date(monday);
    weekStart.setDate(monday.getDate() - (w * 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    const wStart = weekStart.toISOString().slice(0, 10);
    const wEnd = weekEnd.toISOString().slice(0, 10);

    const wSessions = allSessions.filter(s => s.date >= wStart && s.date < wEnd);
    trends.sessionsPerWeek.push(wSessions.length);
    trends.labels.push(`W${5 - w}`);

    // Shot accuracy avg
    let shotSum = 0, shotCount = 0;
    let passSum = 0, passCount = 0;
    for (const s of wSessions) {
      const shooting = JSON.parse(s.shooting || 'null');
      const passing = JSON.parse(s.passing || 'null');
      if (shooting?.shotsTaken > 0) {
        shotSum += (shooting.goals / shooting.shotsTaken) * 100;
        shotCount++;
      }
      if (passing?.attempts > 0) {
        passSum += (passing.completed / passing.attempts) * 100;
        passCount++;
      }
    }
    trends.shotAccuracy.push(shotCount > 0 ? Math.round(shotSum / shotCount) : null);
    trends.passAccuracy.push(passCount > 0 ? Math.round(passSum / passCount) : null);
  }

  // Active program
  let activeProgram = null;
  const enrollment = db.prepare(
    "SELECT up.*, p.name, p.duration_weeks, p.sessions_per_week FROM user_programs up JOIN programs p ON p.id = up.program_id WHERE up.status = 'active' LIMIT 1"
  ).get();
  if (enrollment) {
    const completedSessions = JSON.parse(enrollment.completed_sessions || '[]').length;
    const totalSessions = (enrollment.duration_weeks || 4) * (enrollment.sessions_per_week || 3);
    activeProgram = {
      name: enrollment.name,
      week: enrollment.current_week || 1,
      day: enrollment.current_day || 1,
      totalSessions,
      completedSessions,
    };
  }

  // XP + Level
  const xpPerSession = 25;
  const xpStreakBonus = 10;
  const xpPerLevel = 200;
  const totalXP = (allSessions.length * xpPerSession) + (streak * xpStreakBonus);
  const level = Math.floor(totalXP / xpPerLevel) + 1;
  const levelProgress = {
    current: totalXP % xpPerLevel,
    needed: xpPerLevel,
    pct: Math.round((totalXP % xpPerLevel) / xpPerLevel * 100),
  };

  // Recent badges (simplified computation)
  const recentBadges = [];
  if (allSessions.length >= 1) recentBadges.push({ name: 'First Touch', icon: '⚽', description: 'Logged first session' });
  if (allSessions.length >= 5) recentBadges.push({ name: 'Getting Serious', icon: '💪', description: '5 sessions completed' });
  if (allSessions.length >= 10) recentBadges.push({ name: 'Dedicated', icon: '🔥', description: '10 sessions completed' });
  if (allSessions.length >= 25) recentBadges.push({ name: 'Quarter Century', icon: '🏆', description: '25 sessions completed' });
  if (streak >= 7) recentBadges.push({ name: 'Week Warrior', icon: '⭐', description: '7-day training streak' });

  res.json({
    player: {
      name: settings?.player_name || playerUser?.username || 'Player',
      position: settings?.position || 'General',
      ageGroup: settings?.age_group || null,
      skillLevel: settings?.skill_level || null,
      currentLevel: level,
      totalXP,
    },
    thisWeek: {
      sessionsCompleted: weekSessions.length,
      weeklyGoal: settings?.weekly_goal || 3,
      totalDuration: weekSessions.reduce((sum, s) => sum + (s.duration || 0), 0),
      avgRating,
      drillsCompleted: weekDrills,
      sessionSummaries,
    },
    streak: {
      current: streak,
      longest: streak, // Simplified — would need historical computation for true longest
      lastSessionDate: sortedDates[0] || null,
    },
    idpProgress,
    recentBadges: recentBadges.slice(-5),
    coachFeedback,
    trends,
    activeProgram,
    xp: {
      total: totalXP,
      level,
      levelProgress,
    },
  });
});

export default router;
