import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

function rowToGoal(row) {
  return {
    id: row.id,
    corner: row.corner,
    text: row.text,
    targetDate: row.target_date || '',
    progress: row.progress || 0,
    status: row.status || 'active',
  };
}

router.get('/', (req, res) => {
  const rows = getDb().prepare('SELECT * FROM idp_goals ORDER BY created_at').all();
  res.json(rows.map(rowToGoal));
});

router.post('/', (req, res) => {
  const g = req.body;
  getDb().prepare(`INSERT OR REPLACE INTO idp_goals (id, corner, text, target_date, progress, status) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(g.id, g.corner, g.text, g.targetDate || null, g.progress || 0, g.status || 'active');
  res.status(201).json(rowToGoal(getDb().prepare('SELECT * FROM idp_goals WHERE id = ?').get(g.id)));
});

router.put('/:id', (req, res) => {
  const g = req.body;
  getDb().prepare(`UPDATE idp_goals SET corner=?, text=?, target_date=?, progress=?, status=?, updated_at=datetime('now') WHERE id=?`)
    .run(g.corner, g.text, g.targetDate || null, g.progress || 0, g.status || 'active', req.params.id);
  const row = getDb().prepare('SELECT * FROM idp_goals WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(rowToGoal(row));
});

router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM idp_goals WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
