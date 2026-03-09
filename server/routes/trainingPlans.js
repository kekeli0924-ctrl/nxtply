import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

function rowToPlan(row) {
  return {
    id: row.id,
    date: row.date,
    drills: JSON.parse(row.drills || '[]'),
    targetDuration: row.target_duration || 0,
    notes: row.notes || '',
  };
}

router.get('/', (req, res) => {
  const rows = getDb().prepare('SELECT * FROM training_plans ORDER BY date').all();
  res.json(rows.map(rowToPlan));
});

router.post('/', (req, res) => {
  const p = req.body;
  getDb().prepare(`INSERT OR REPLACE INTO training_plans (id, date, drills, target_duration, notes) VALUES (?, ?, ?, ?, ?)`)
    .run(p.id, p.date, JSON.stringify(p.drills || []), Number(p.targetDuration) || 0, p.notes || '');
  res.status(201).json(rowToPlan(getDb().prepare('SELECT * FROM training_plans WHERE id = ?').get(p.id)));
});

router.put('/:id', (req, res) => {
  const p = req.body;
  getDb().prepare(`UPDATE training_plans SET date=?, drills=?, target_duration=?, notes=?, updated_at=datetime('now') WHERE id=?`)
    .run(p.date, JSON.stringify(p.drills || []), Number(p.targetDuration) || 0, p.notes || '', req.params.id);
  const row = getDb().prepare('SELECT * FROM training_plans WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(rowToPlan(row));
});

router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM training_plans WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
