import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

// GET /api/drills — list all drills with optional filters
router.get('/', (req, res) => {
  const db = getDb();
  let sql = 'SELECT * FROM drills WHERE 1=1';
  const params = [];

  if (req.query.category) {
    sql += ' AND category = ?';
    params.push(req.query.category);
  }
  if (req.query.subcategory) {
    sql += ' AND subcategory = ?';
    params.push(req.query.subcategory);
  }
  if (req.query.difficulty) {
    sql += ' AND difficulty = ?';
    params.push(req.query.difficulty);
  }
  if (req.query.search) {
    sql += ' AND (name LIKE ? OR description LIKE ?)';
    params.push(`%${req.query.search}%`, `%${req.query.search}%`);
  }

  sql += ' ORDER BY category, subcategory, name';

  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(r => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    category: r.category,
    subcategory: r.subcategory,
    difficulty: r.difficulty,
    durationMinutes: r.duration_minutes,
    repsDescription: r.reps_description,
    equipmentNeeded: r.equipment_needed,
    spaceNeeded: r.space_needed,
    description: r.description,
    coachingPoints: JSON.parse(r.coaching_points || '[]'),
    variations: JSON.parse(r.variations || '[]'),
    positionRelevance: JSON.parse(r.position_relevance || '[]'),
    isPreset: r.is_preset,
  })));
});

// GET /api/drills/:id — single drill detail
router.get('/:id', (req, res) => {
  const db = getDb();
  const r = db.prepare('SELECT * FROM drills WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Drill not found' });

  res.json({
    id: r.id,
    name: r.name,
    slug: r.slug,
    category: r.category,
    subcategory: r.subcategory,
    difficulty: r.difficulty,
    durationMinutes: r.duration_minutes,
    repsDescription: r.reps_description,
    equipmentNeeded: r.equipment_needed,
    spaceNeeded: r.space_needed,
    description: r.description,
    coachingPoints: JSON.parse(r.coaching_points || '[]'),
    variations: JSON.parse(r.variations || '[]'),
    positionRelevance: JSON.parse(r.position_relevance || '[]'),
    isPreset: r.is_preset,
  });
});

export default router;
