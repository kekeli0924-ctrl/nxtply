import { Router } from 'express';
import crypto from 'crypto';
import { getDb } from '../db.js';
import { logger } from '../logger.js';
import { createScoutingTask, getTaskResult, isConfigured } from '../services/manusClient.js';
import { computeRulesBasedBrief, buildWarmupSession, generateAIGamePlan } from '../services/gamePlanGenerator.js';
import { enforceDailyQuota } from '../middleware/quota.js';

const router = Router();

// POST /api/scouting/request — create a new scouting report
// Manus API is the most expensive external call; cap at 3/day per user.
router.post('/request', enforceDailyQuota('scouting-request', 3, 'Daily scouting limit reached (3/day). Try again tomorrow.'), async (req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({ error: 'Scouting is not configured. Add MANUS_API_KEY to .env.', code: 'NOT_CONFIGURED' });
  }

  const { clubName, level, ageGroup, gender, location, matchDate } = req.body;

  if (!clubName?.trim()) return res.status(400).json({ error: 'Club name is required' });
  if (!level?.trim()) return res.status(400).json({ error: 'Level is required' });
  if (!ageGroup?.trim()) return res.status(400).json({ error: 'Age group is required' });
  if (!gender?.trim()) return res.status(400).json({ error: 'Gender is required' });

  const db = getDb();
  const reportId = crypto.randomUUID();

  // Create DB record
  db.prepare(`INSERT INTO scouting_reports (id, user_id, club_name, level, age_group, gender, location, match_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`).run(
    reportId, req.userId, clubName.trim(), level.trim(), ageGroup.trim(), gender.trim(),
    location?.trim() || null, matchDate || null
  );

  // Call Manus API
  try {
    const result = await createScoutingTask({ clubName, level, ageGroup, gender, location, matchDate });

    db.prepare('UPDATE scouting_reports SET manus_task_id = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(result.taskId, reportId);

    logger.info('Scouting report requested', { reportId, taskId: result.taskId, club: clubName });

    res.status(201).json({ reportId, status: 'pending', taskId: result.taskId });
  } catch (err) {
    // Mark as failed if Manus API call fails
    db.prepare("UPDATE scouting_reports SET status = 'failed', error_message = ?, updated_at = datetime('now') WHERE id = ?")
      .run(err.message, reportId);

    logger.error('Scouting report creation failed', { reportId, error: err.message });
    res.status(500).json({ error: 'Failed to start scouting task. Please try again.', reportId });
  }
});

// GET /api/scouting/reports — list user's reports
router.get('/reports', (req, res) => {
  const db = getDb();
  const reports = db.prepare(
    'SELECT id, club_name, level, age_group, gender, location, match_date, status, confidence_summary, error_message, game_plan, shared_by_coach_id, created_at, updated_at FROM scouting_reports WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.userId);

  res.json(reports.map(r => ({
    id: r.id,
    clubName: r.club_name,
    level: r.level,
    ageGroup: r.age_group,
    gender: r.gender,
    location: r.location,
    matchDate: r.match_date,
    status: r.status,
    confidenceSummary: r.confidence_summary,
    errorMessage: r.error_message,
    gamePlan: r.game_plan ? JSON.parse(r.game_plan) : null,
    fromCoach: r.shared_by_coach_id != null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  })));
});

// GET /api/scouting/reports/:id — get full report detail
router.get('/reports/:id', (req, res) => {
  const db = getDb();
  const report = db.prepare('SELECT * FROM scouting_reports WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);

  if (!report) return res.status(404).json({ error: 'Report not found' });

  let gamePlan = null;
  if (report.game_plan) {
    try { gamePlan = JSON.parse(report.game_plan); } catch { /* ignore */ }
  }

  res.json({
    id: report.id,
    clubName: report.club_name,
    level: report.level,
    ageGroup: report.age_group,
    gender: report.gender,
    location: report.location,
    matchDate: report.match_date,
    status: report.status,
    manusTaskId: report.manus_task_id,
    reportContent: report.report_content,
    confidenceSummary: report.confidence_summary,
    errorMessage: report.error_message,
    gamePlan,
    createdAt: report.created_at,
    updatedAt: report.updated_at,
  });
});

// POST /api/scouting/check/:id — poll Manus for task status
router.post('/check/:id', async (req, res) => {
  const db = getDb();
  const report = db.prepare('SELECT * FROM scouting_reports WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);

  if (!report) return res.status(404).json({ error: 'Report not found' });

  // If already complete or failed, just return current state
  if (report.status === 'ready' || report.status === 'failed') {
    return res.json({
      id: report.id,
      status: report.status,
      reportContent: report.report_content,
      confidenceSummary: report.confidence_summary,
      errorMessage: report.error_message,
    });
  }

  if (!report.manus_task_id) {
    return res.json({ id: report.id, status: 'failed', errorMessage: 'No task ID — scouting task was not created.' });
  }

  if (!isConfigured()) {
    return res.status(503).json({ error: 'Scouting not configured' });
  }

  try {
    const result = await getTaskResult(report.manus_task_id);

    if (result.status === 'completed' && result.output) {
      // Extract confidence summary from the report content
      let confidenceSummary = null;
      const confMatch = result.output.match(/overall\s*confidence[:\s]*(\d)/i);
      if (confMatch) confidenceSummary = `Overall: ${confMatch[1]}/5`;

      db.prepare(`UPDATE scouting_reports SET status = 'ready', report_content = ?, confidence_summary = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(result.output, confidenceSummary, report.id);

      logger.info('Scouting report ready', { reportId: report.id });

      return res.json({
        id: report.id,
        status: 'ready',
        reportContent: result.output,
        confidenceSummary,
      });
    }

    if (result.status === 'failed') {
      const errMsg = 'Manus task failed. The scouting report could not be completed.';
      db.prepare("UPDATE scouting_reports SET status = 'failed', error_message = ?, updated_at = datetime('now') WHERE id = ?")
        .run(errMsg, report.id);

      return res.json({ id: report.id, status: 'failed', errorMessage: errMsg });
    }

    // Still running or pending
    return res.json({ id: report.id, status: 'pending' });
  } catch (err) {
    logger.error('Scouting check failed', { reportId: report.id, error: err.message });
    return res.json({ id: report.id, status: 'pending', errorMessage: err.message });
  }
});

// POST /api/scouting/generate-game-plan/:id — cross-reference report with player data
// Game plan uses Gemini — cap at 10/day per user.
router.post('/generate-game-plan/:id', enforceDailyQuota('game-plan', 10, 'Daily game plan limit reached (10/day). Try again tomorrow.'), async (req, res) => {
  const db = getDb();
  const report = db.prepare('SELECT * FROM scouting_reports WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);

  if (!report) return res.status(404).json({ error: 'Report not found' });
  if (report.status !== 'ready' || !report.report_content) {
    return res.status(400).json({ error: 'Report is not ready yet' });
  }

  try {
    // Fetch player's last 10 sessions
    const sessions = db.prepare(
      'SELECT * FROM sessions WHERE user_id = ? ORDER BY date DESC LIMIT 10'
    ).all(req.userId);

    // Compute player stats from sessions
    const playerStats = computePlayerStats(sessions);

    // Rules-based cross-reference
    const crossReference = computeRulesBasedBrief(report.report_content, playerStats);

    // Fetch drills for warm-up session
    const drills = db.prepare('SELECT * FROM drills').all();
    const warmupSession = buildWarmupSession(crossReference, drills, report.club_name);

    // AI-enhanced brief (optional — works without Gemini key)
    let aiBrief = null;
    try {
      aiBrief = await generateAIGamePlan(report.report_content, playerStats, crossReference);
    } catch (err) {
      logger.warn('AI game plan generation skipped', { error: err.message });
    }

    // Store the game plan
    const gamePlan = {
      status: 'ready',
      generatedAt: new Date().toISOString(),
      playerStats,
      tips: crossReference.tips,
      aiBrief,
      warmupSession,
    };

    db.prepare("UPDATE scouting_reports SET game_plan = ?, updated_at = datetime('now') WHERE id = ?")
      .run(JSON.stringify(gamePlan), report.id);

    logger.info('Game plan generated', { reportId: report.id, tips: crossReference.tips.length });

    res.json({ gamePlan });
  } catch (err) {
    logger.error('Game plan generation failed', { reportId: report.id, error: err.message });
    res.status(500).json({ error: 'Failed to generate game plan. Please try again.' });
  }
});

/** Compute aggregate player stats from recent sessions */
function computePlayerStats(sessions) {
  if (!sessions || sessions.length === 0) {
    return { shotAccuracy: 50, passAccuracy: 70, weakFootRatio: 20, avgRPE: 5, sessionsThisWeek: 0 };
  }

  let totalShots = 0, shotsOnTarget = 0;
  let totalPasses = 0, passesCompleted = 0;
  let weakFootShots = 0, totalFootShots = 0;
  let totalRPE = 0, rpeCount = 0;

  for (const s of sessions) {
    // Parse shooting JSON
    if (s.shooting) {
      try {
        const sh = typeof s.shooting === 'string' ? JSON.parse(s.shooting) : s.shooting;
        const left = (sh.leftFoot?.made || 0);
        const leftTotal = (sh.leftFoot?.attempted || 0);
        const right = (sh.rightFoot?.made || 0);
        const rightTotal = (sh.rightFoot?.attempted || 0);
        shotsOnTarget += left + right;
        totalShots += leftTotal + rightTotal;
        // Weak foot = lesser side
        if (leftTotal + rightTotal > 0) {
          const lesser = Math.min(leftTotal, rightTotal);
          weakFootShots += lesser;
          totalFootShots += leftTotal + rightTotal;
        }
      } catch { /* ignore */ }
    }

    // Parse passing JSON
    if (s.passing) {
      try {
        const pa = typeof s.passing === 'string' ? JSON.parse(s.passing) : s.passing;
        passesCompleted += pa.completed || 0;
        totalPasses += pa.attempted || 0;
      } catch { /* ignore */ }
    }

    // RPE from quickRating (1-10 scale)
    if (s.quickRating) {
      totalRPE += s.quickRating;
      rpeCount++;
    }
  }

  // Sessions this week
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekStr = weekAgo.toISOString().slice(0, 10);
  const sessionsThisWeek = sessions.filter(s => s.date >= weekStr).length;

  return {
    shotAccuracy: totalShots > 0 ? Math.round((shotsOnTarget / totalShots) * 100) : 50,
    passAccuracy: totalPasses > 0 ? Math.round((passesCompleted / totalPasses) * 100) : 70,
    weakFootRatio: totalFootShots > 0 ? Math.round((weakFootShots / totalFootShots) * 100) : 20,
    avgRPE: rpeCount > 0 ? totalRPE / rpeCount : 5,
    sessionsThisWeek,
    totalSessions: sessions.length,
  };
}

export default router;
