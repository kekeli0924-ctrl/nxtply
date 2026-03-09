import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

function rowToSettings(row) {
  return {
    distanceUnit: row.distance_unit || 'km',
    weeklyGoal: row.weekly_goal ?? 3,
    ageGroup: row.age_group || '',
    skillLevel: row.skill_level || '',
  };
}

router.get('/', (req, res) => {
  const row = getDb().prepare('SELECT * FROM settings WHERE id = 1').get();
  res.json(rowToSettings(row));
});

router.put('/', (req, res) => {
  const s = req.body;
  getDb().prepare(`UPDATE settings SET
    distance_unit = COALESCE(@distance_unit, distance_unit),
    weekly_goal = COALESCE(@weekly_goal, weekly_goal),
    age_group = COALESCE(@age_group, age_group),
    skill_level = COALESCE(@skill_level, skill_level),
    updated_at = datetime('now')
    WHERE id = 1`).run({
    distance_unit: s.distanceUnit ?? null,
    weekly_goal: s.weeklyGoal ?? null,
    age_group: s.ageGroup ?? null,
    skill_level: s.skillLevel ?? null,
  });
  const row = getDb().prepare('SELECT * FROM settings WHERE id = 1').get();
  res.json(rowToSettings(row));
});

export default router;
