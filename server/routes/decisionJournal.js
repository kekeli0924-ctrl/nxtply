import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

function rowToEntry(row) {
  return {
    id: row.id,
    date: row.date,
    matchId: row.match_id || '',
    matchLabel: row.match_label || '',
    decisions: JSON.parse(row.decisions || '[]'),
  };
}

router.get('/', (req, res) => {
  const rows = getDb().prepare('SELECT * FROM decision_journal ORDER BY date DESC').all();
  res.json(rows.map(rowToEntry));
});

router.post('/', (req, res) => {
  const e = req.body;
  getDb().prepare(`INSERT OR REPLACE INTO decision_journal (id, date, match_id, match_label, decisions) VALUES (?, ?, ?, ?, ?)`)
    .run(e.id, e.date, e.matchId || null, e.matchLabel || null, JSON.stringify(e.decisions || []));
  res.status(201).json(rowToEntry(getDb().prepare('SELECT * FROM decision_journal WHERE id = ?').get(e.id)));
});

router.put('/:id', (req, res) => {
  const e = req.body;
  getDb().prepare(`UPDATE decision_journal SET date=?, match_id=?, match_label=?, decisions=?, updated_at=datetime('now') WHERE id=?`)
    .run(e.date, e.matchId || null, e.matchLabel || null, JSON.stringify(e.decisions || []), req.params.id);
  const row = getDb().prepare('SELECT * FROM decision_journal WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(rowToEntry(row));
});

router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM decision_journal WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
