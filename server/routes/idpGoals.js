import { Router } from 'express';
import { getDb } from '../db.js';
import { idpGoalSchema, validate } from '../validation.js';

const router = Router();

function rowToGoal(row) {
  return {
    id: row.id,
    corner: row.corner,
    text: row.text,
    targetDate: row.target_date || '',
    progress: row.progress || 0,
    status: row.status || 'active',
    targetMetric: row.target_metric || null,
    targetValue: row.target_value || null,
  };
}

function computeProjection(goal, userId) {
  if (!goal.targetMetric || !goal.targetValue || !goal.targetDate) return null;

  const db = getDb();
  const sessions = db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY date DESC LIMIT 30').all(userId);
  if (sessions.length < 5) return { status: 'insufficient', message: 'Log 5+ sessions to see your trajectory.' };

  // Compute current metric value
  let values = [];
  for (const s of sessions) {
    const shooting = JSON.parse(s.shooting || 'null');
    const passing = JSON.parse(s.passing || 'null');

    if (goal.targetMetric === 'shot_accuracy' && shooting?.shotsTaken >= 3) {
      values.push({ date: s.date, value: Math.round((shooting.goals / shooting.shotsTaken) * 100) });
    } else if (goal.targetMetric === 'pass_completion' && passing?.attempts >= 3) {
      values.push({ date: s.date, value: Math.round((passing.completed / passing.attempts) * 100) });
    } else if (goal.targetMetric === 'sessions_per_week') {
      // Count sessions in last 7 days from this session date
      const weekSessions = sessions.filter(ws => {
        const d = new Date(ws.date);
        const sd = new Date(s.date);
        return d >= new Date(sd - 7 * 86400000) && d <= sd;
      }).length;
      values.push({ date: s.date, value: weekSessions });
    }
  }

  if (values.length < 3) return { status: 'insufficient', message: 'Not enough data for this metric yet.' };

  // Calculate rate of change per week
  const recent = values.slice(0, 5);
  const older = values.slice(-5);
  const recentAvg = recent.reduce((s, v) => s + v.value, 0) / recent.length;
  const olderAvg = older.reduce((s, v) => s + v.value, 0) / older.length;
  const weeksBetween = Math.max(1, (new Date(recent[0].date) - new Date(older[older.length - 1].date)) / (7 * 86400000));
  const ratePerWeek = (recentAvg - olderAvg) / weeksBetween;

  const current = recentAvg;
  const target = goal.targetValue;
  const targetDate = new Date(goal.targetDate);
  const now = new Date();

  if (current >= target) {
    return { status: 'achieved', message: `Already at ${Math.round(current)} — target of ${target} reached!`, current: Math.round(current) };
  }

  if (ratePerWeek <= 0) {
    return { status: 'behind', message: `Currently at ${Math.round(current)}. No improvement trend yet — increase training frequency.`, current: Math.round(current), projectedDate: null };
  }

  const weeksNeeded = (target - current) / ratePerWeek;
  const projectedDate = new Date(now.getTime() + weeksNeeded * 7 * 86400000);
  const daysEarly = Math.round((targetDate - projectedDate) / 86400000);

  if (daysEarly >= 0) {
    return { status: 'on_track', message: `On track — projected to reach ${target} by ${projectedDate.toLocaleDateString()}, ${daysEarly} days early.`, current: Math.round(current), projectedDate: projectedDate.toISOString() };
  } else {
    return { status: 'behind', message: `Behind pace — projected ${projectedDate.toLocaleDateString()}, ${Math.abs(daysEarly)} days late. Consider adding more sessions.`, current: Math.round(current), projectedDate: projectedDate.toISOString() };
  }
}

router.get('/', (req, res) => {
  const rows = getDb().prepare('SELECT * FROM idp_goals WHERE user_id = ? ORDER BY created_at').all(req.userId);
  const goals = rows.map(row => {
    const goal = rowToGoal(row);
    goal.projection = computeProjection(goal, req.userId);
    return goal;
  });
  res.json(goals);
});

router.post('/', validate(idpGoalSchema), (req, res) => {
  try {
    const g = req.body;
    getDb().prepare(`INSERT OR REPLACE INTO idp_goals (id, corner, text, target_date, progress, status, target_metric, target_value, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(g.id, g.corner, g.text, g.targetDate || null, g.progress || 0, g.status || 'active', g.targetMetric || null, g.targetValue || null, req.userId);
    const row = getDb().prepare('SELECT * FROM idp_goals WHERE id = ? AND user_id = ?').get(g.id, req.userId);
    const goal = rowToGoal(row);
    goal.projection = computeProjection(goal, req.userId);
    res.status(201).json(goal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', validate(idpGoalSchema), (req, res) => {
  try {
    const g = req.body;
    getDb().prepare(`UPDATE idp_goals SET corner=?, text=?, target_date=?, progress=?, status=?, target_metric=?, target_value=?, updated_at=datetime('now') WHERE id=? AND user_id=?`)
      .run(g.corner, g.text, g.targetDate || null, g.progress || 0, g.status || 'active', g.targetMetric || null, g.targetValue || null, req.params.id, req.userId);
    const row = getDb().prepare('SELECT * FROM idp_goals WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
    if (!row) return res.status(404).json({ error: 'Not found' });
    const goal = rowToGoal(row);
    goal.projection = computeProjection(goal, req.userId);
    res.json(goal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM idp_goals WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ ok: true });
});

export default router;
