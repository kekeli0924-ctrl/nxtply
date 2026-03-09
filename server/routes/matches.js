import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

function rowToMatch(row) {
  return {
    id: row.id,
    date: row.date,
    opponent: row.opponent,
    result: row.result,
    minutesPlayed: row.minutes_played,
    goals: row.goals,
    assists: row.assists,
    shots: row.shots,
    passesCompleted: row.passes_completed,
    rating: row.rating,
    notes: row.notes || '',
  };
}

function matchToRow(m) {
  return {
    id: m.id,
    date: m.date,
    opponent: m.opponent,
    result: m.result,
    minutes_played: Number(m.minutesPlayed) || 0,
    goals: Number(m.goals) || 0,
    assists: Number(m.assists) || 0,
    shots: Number(m.shots) || 0,
    passes_completed: Number(m.passesCompleted) || 0,
    rating: Number(m.rating) || 6,
    notes: m.notes || '',
  };
}

router.get('/', (req, res) => {
  const rows = getDb().prepare('SELECT * FROM matches ORDER BY date DESC').all();
  res.json(rows.map(rowToMatch));
});

router.get('/:id', (req, res) => {
  const row = getDb().prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(rowToMatch(row));
});

router.post('/', (req, res) => {
  const r = matchToRow(req.body);
  getDb().prepare(`INSERT OR REPLACE INTO matches (id, date, opponent, result, minutes_played, goals, assists, shots, passes_completed, rating, notes)
    VALUES (@id, @date, @opponent, @result, @minutes_played, @goals, @assists, @shots, @passes_completed, @rating, @notes)`).run(r);
  res.status(201).json(rowToMatch(getDb().prepare('SELECT * FROM matches WHERE id = ?').get(r.id)));
});

router.put('/:id', (req, res) => {
  const r = matchToRow({ ...req.body, id: req.params.id });
  getDb().prepare(`UPDATE matches SET date=@date, opponent=@opponent, result=@result, minutes_played=@minutes_played, goals=@goals, assists=@assists, shots=@shots, passes_completed=@passes_completed, rating=@rating, notes=@notes, updated_at=datetime('now') WHERE id=@id`).run(r);
  const row = getDb().prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(rowToMatch(row));
});

router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM matches WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
