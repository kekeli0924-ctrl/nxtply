import { Router } from 'express';
import { getDb } from '../db.js';
import { requireCoach } from '../auth.js';
import { validate, assignedPlanSchema } from '../validation.js';

const router = Router();

function rowToPlan(row) {
  return {
    id: row.id,
    coachId: row.coach_id,
    playerId: row.player_id,
    date: row.date,
    drills: JSON.parse(row.drills || '[]'),
    targetDuration: row.target_duration,
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function verifyOnRoster(db, coachId, playerId) {
  return db.prepare('SELECT id FROM coach_players WHERE coach_id = ? AND player_id = ?').get(coachId, playerId);
}

// GET /api/assigned-plans — player gets their assigned plans
router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM assigned_plans WHERE player_id = ? ORDER BY date ASC').all(req.userId);
  res.json(rows.map(rowToPlan));
});

// GET /api/assigned-plans/player/:playerId — coach views plans for a player
router.get('/player/:playerId', requireCoach, (req, res) => {
  const db = getDb();
  const playerId = parseInt(req.params.playerId, 10);
  if (!verifyOnRoster(db, req.userId, playerId)) {
    return res.status(403).json({ error: 'Player not on your roster', code: 'FORBIDDEN' });
  }
  const rows = db.prepare('SELECT * FROM assigned_plans WHERE player_id = ? AND coach_id = ? ORDER BY date ASC').all(playerId, req.userId);
  res.json(rows.map(rowToPlan));
});

// POST /api/assigned-plans — coach creates a plan
router.post('/', requireCoach, validate(assignedPlanSchema), (req, res) => {
  const db = getDb();
  const { id, playerId, date, drills, targetDuration, notes } = req.body;
  if (!verifyOnRoster(db, req.userId, playerId)) {
    return res.status(403).json({ error: 'Player not on your roster', code: 'FORBIDDEN' });
  }
  db.prepare(`INSERT INTO assigned_plans (id, coach_id, player_id, date, drills, target_duration, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, req.userId, playerId, date, JSON.stringify(drills), targetDuration, notes);
  const row = db.prepare('SELECT * FROM assigned_plans WHERE id = ?').get(id);
  res.status(201).json(rowToPlan(row));
});

// PUT /api/assigned-plans/:id — coach updates a plan
router.put('/:id', requireCoach, (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM assigned_plans WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Plan not found', code: 'NOT_FOUND' });
  if (existing.coach_id !== req.userId) return res.status(403).json({ error: 'Not your plan', code: 'FORBIDDEN' });

  const { date, drills, targetDuration, notes } = req.body;
  db.prepare(`UPDATE assigned_plans SET date = COALESCE(?, date), drills = COALESCE(?, drills),
    target_duration = COALESCE(?, target_duration), notes = COALESCE(?, notes),
    updated_at = datetime('now') WHERE id = ?`)
    .run(date || null, drills ? JSON.stringify(drills) : null, targetDuration ?? null, notes ?? null, req.params.id);

  const row = db.prepare('SELECT * FROM assigned_plans WHERE id = ?').get(req.params.id);
  res.json(rowToPlan(row));
});

// DELETE /api/assigned-plans/:id — coach deletes a plan
router.delete('/:id', requireCoach, (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT coach_id FROM assigned_plans WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Plan not found', code: 'NOT_FOUND' });
  if (existing.coach_id !== req.userId) return res.status(403).json({ error: 'Not your plan', code: 'FORBIDDEN' });
  db.prepare('DELETE FROM assigned_plans WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
