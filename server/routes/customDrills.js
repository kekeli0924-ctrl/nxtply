import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const rows = getDb().prepare('SELECT name FROM custom_drills ORDER BY name').all();
  res.json(rows.map(r => r.name));
});

router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  getDb().prepare('INSERT OR IGNORE INTO custom_drills (name) VALUES (?)').run(name);
  res.status(201).json({ ok: true });
});

router.delete('/:name', (req, res) => {
  getDb().prepare('DELETE FROM custom_drills WHERE name = ?').run(req.params.name);
  res.json({ ok: true });
});

export default router;
