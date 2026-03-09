import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

function rowToTemplate(row) {
  const data = JSON.parse(row.data || '{}');
  return { id: row.id, name: row.name, ...data };
}

router.get('/', (req, res) => {
  const rows = getDb().prepare('SELECT * FROM templates ORDER BY created_at DESC').all();
  res.json(rows.map(rowToTemplate));
});

router.post('/', (req, res) => {
  const { id, name, ...rest } = req.body;
  getDb().prepare('INSERT OR REPLACE INTO templates (id, name, data) VALUES (?, ?, ?)').run(id, name, JSON.stringify(rest));
  res.status(201).json(rowToTemplate(getDb().prepare('SELECT * FROM templates WHERE id = ?').get(id)));
});

router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM templates WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
