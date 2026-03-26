import { Router } from 'express';
import { getDb } from '../db.js';
import { sessionSchema, validate } from '../validation.js';

const router = Router();

function rowToSession(row) {
  return {
    id: row.id,
    date: row.date,
    duration: row.duration,
    drills: JSON.parse(row.drills || '[]'),
    notes: row.notes || '',
    intention: row.intention || '',
    sessionType: row.session_type || '',
    position: row.position || 'general',
    quickRating: row.quick_rating ?? 3,
    bodyCheck: JSON.parse(row.body_check || 'null'),
    shooting: JSON.parse(row.shooting || 'null'),
    passing: JSON.parse(row.passing || 'null'),
    fitness: JSON.parse(row.fitness || 'null'),
    delivery: JSON.parse(row.delivery || 'null'),
    attacking: JSON.parse(row.attacking || 'null'),
    reflection: JSON.parse(row.reflection || 'null'),
    idpGoals: JSON.parse(row.idp_goals || '[]'),
    mediaLinks: JSON.parse(row.media_links || '[]'),
  };
}

function sessionToRow(s) {
  return {
    id: s.id,
    date: s.date,
    duration: Number(s.duration) || 0,
    drills: JSON.stringify(s.drills || []),
    notes: s.notes || '',
    intention: s.intention || '',
    session_type: s.sessionType || '',
    position: s.position || 'general',
    quick_rating: s.quickRating ?? 3,
    body_check: s.bodyCheck ? JSON.stringify(s.bodyCheck) : null,
    shooting: s.shooting ? JSON.stringify(s.shooting) : null,
    passing: s.passing ? JSON.stringify(s.passing) : null,
    fitness: s.fitness ? JSON.stringify(s.fitness) : null,
    delivery: s.delivery ? JSON.stringify(s.delivery) : null,
    attacking: s.attacking ? JSON.stringify(s.attacking) : null,
    reflection: s.reflection ? JSON.stringify(s.reflection) : null,
    idp_goals: JSON.stringify(s.idpGoals || []),
    media_links: JSON.stringify(s.mediaLinks || []),
  };
}

// GET /api/sessions
router.get('/', (req, res) => {
  const rows = getDb().prepare('SELECT * FROM sessions ORDER BY date DESC').all();
  res.json(rows.map(rowToSession));
});

// GET /api/sessions/:id
router.get('/:id', (req, res) => {
  const row = getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(rowToSession(row));
});

// POST /api/sessions
router.post('/', validate(sessionSchema), (req, res) => {
  try {
    const r = sessionToRow(req.body);
    getDb().prepare(`INSERT OR REPLACE INTO sessions (id, date, duration, drills, notes, intention, session_type, position, quick_rating, body_check, shooting, passing, fitness, delivery, attacking, reflection, idp_goals, media_links)
      VALUES (@id, @date, @duration, @drills, @notes, @intention, @session_type, @position, @quick_rating, @body_check, @shooting, @passing, @fitness, @delivery, @attacking, @reflection, @idp_goals, @media_links)`).run(r);
    res.status(201).json(rowToSession(getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(r.id)));
  } catch (err) {
    console.error('POST /api/sessions error:', err.message, 'body:', JSON.stringify(req.body).slice(0, 500));
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sessions/:id
router.put('/:id', validate(sessionSchema), (req, res) => {
  try {
    const r = sessionToRow({ ...req.body, id: req.params.id });
    getDb().prepare(`UPDATE sessions SET date=@date, duration=@duration, drills=@drills, notes=@notes, intention=@intention, session_type=@session_type, position=@position, quick_rating=@quick_rating, body_check=@body_check, shooting=@shooting, passing=@passing, fitness=@fitness, delivery=@delivery, attacking=@attacking, reflection=@reflection, idp_goals=@idp_goals, media_links=@media_links, updated_at=datetime('now') WHERE id=@id`).run(r);
    const row = getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(rowToSession(row));
  } catch (err) {
    console.error('PUT /api/sessions error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sessions/:id
router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
