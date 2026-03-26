import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

// Helper: import sessions, matches, etc. from JSON export format
function importData(db, data) {
  const counts = {};

  if (data.sessions?.length) {
    const stmt = db.prepare(`INSERT OR IGNORE INTO sessions (id, date, duration, drills, notes, intention, session_type, position, quick_rating, body_check, shooting, passing, fitness, delivery, attacking, reflection, idp_goals, media_links) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const s of data.sessions) {
      stmt.run(s.id, s.date, Number(s.duration) || 0, JSON.stringify(s.drills || []), s.notes || '', s.intention || '', s.sessionType || '', s.position || 'general', s.quickRating ?? 3,
        s.bodyCheck ? JSON.stringify(s.bodyCheck) : null, s.shooting ? JSON.stringify(s.shooting) : null, s.passing ? JSON.stringify(s.passing) : null,
        s.fitness ? JSON.stringify(s.fitness) : null, s.delivery ? JSON.stringify(s.delivery) : null, s.attacking ? JSON.stringify(s.attacking) : null, s.reflection ? JSON.stringify(s.reflection) : null,
        JSON.stringify(s.idpGoals || []), JSON.stringify(s.mediaLinks || []));
    }
    counts.sessions = data.sessions.length;
  }

  if (data.matches?.length) {
    const stmt = db.prepare(`INSERT OR IGNORE INTO matches (id, date, opponent, result, minutes_played, goals, assists, shots, passes_completed, rating, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const m of data.matches) {
      stmt.run(m.id, m.date, m.opponent, m.result, Number(m.minutesPlayed) || 0, Number(m.goals) || 0, Number(m.assists) || 0, Number(m.shots) || 0, Number(m.passesCompleted) || 0, Number(m.rating) || 6, m.notes || '');
    }
    counts.matches = data.matches.length;
  }

  if (data.customDrills?.length) {
    const stmt = db.prepare('INSERT OR IGNORE INTO custom_drills (name) VALUES (?)');
    for (const name of data.customDrills) stmt.run(name);
    counts.customDrills = data.customDrills.length;
  }

  if (data.settings) {
    const s = data.settings;
    db.prepare('UPDATE settings SET distance_unit=?, weekly_goal=?, age_group=?, skill_level=? WHERE id=1')
      .run(s.distanceUnit || 'km', s.weeklyGoal ?? 3, s.ageGroup || null, s.skillLevel || null);
    counts.settings = 1;
  }

  if (data.personalRecords) {
    db.prepare('UPDATE personal_records SET data=? WHERE id=1').run(JSON.stringify(data.personalRecords));
    counts.personalRecords = 1;
  }

  if (data.trainingPlans?.length) {
    const stmt = db.prepare('INSERT OR IGNORE INTO training_plans (id, date, drills, target_duration, notes) VALUES (?, ?, ?, ?, ?)');
    for (const p of data.trainingPlans) stmt.run(p.id, p.date, JSON.stringify(p.drills || []), Number(p.targetDuration) || 0, p.notes || '');
    counts.trainingPlans = data.trainingPlans.length;
  }

  if (data.idpGoals?.length) {
    const stmt = db.prepare('INSERT OR IGNORE INTO idp_goals (id, corner, text, target_date, progress, status) VALUES (?, ?, ?, ?, ?, ?)');
    for (const g of data.idpGoals) stmt.run(g.id, g.corner, g.text, g.targetDate || null, g.progress || 0, g.status || 'active');
    counts.idpGoals = data.idpGoals.length;
  }

  if (data.decisionJournal?.length) {
    const stmt = db.prepare('INSERT OR IGNORE INTO decision_journal (id, date, match_id, match_label, decisions) VALUES (?, ?, ?, ?, ?)');
    for (const e of data.decisionJournal) stmt.run(e.id, e.date, e.matchId || null, e.matchLabel || null, JSON.stringify(e.decisions || []));
    counts.decisionJournal = data.decisionJournal.length;
  }

  if (data.benchmarks?.length) {
    const stmt = db.prepare('INSERT OR IGNORE INTO benchmarks (id, date, type, score, data) VALUES (?, ?, ?, ?, ?)');
    for (const b of data.benchmarks) {
      const { id, date, type, score, ...rest } = b;
      stmt.run(id, date, type, Number(score) || 0, JSON.stringify(rest));
    }
    counts.benchmarks = data.benchmarks.length;
  }

  if (data.templates?.length) {
    const stmt = db.prepare('INSERT OR IGNORE INTO templates (id, name, data) VALUES (?, ?, ?)');
    for (const t of data.templates) {
      const { id, name, ...rest } = t;
      stmt.run(id, name, JSON.stringify(rest));
    }
    counts.templates = data.templates.length;
  }

  return counts;
}

// GET /api/data/export
router.get('/export', (req, res) => {
  const db = getDb();

  // Reuse route serialization helpers inline
  const sessions = db.prepare('SELECT * FROM sessions ORDER BY date DESC').all().map(row => ({
    id: row.id, date: row.date, duration: row.duration, drills: JSON.parse(row.drills || '[]'),
    notes: row.notes || '', intention: row.intention || '', sessionType: row.session_type || '',
    position: row.position || 'general', quickRating: row.quick_rating ?? 3,
    bodyCheck: JSON.parse(row.body_check || 'null'), shooting: JSON.parse(row.shooting || 'null'),
    passing: JSON.parse(row.passing || 'null'), fitness: JSON.parse(row.fitness || 'null'),
    delivery: JSON.parse(row.delivery || 'null'), attacking: JSON.parse(row.attacking || 'null'),
    reflection: JSON.parse(row.reflection || 'null'), idpGoals: JSON.parse(row.idp_goals || '[]'),
    mediaLinks: JSON.parse(row.media_links || '[]'),
  }));

  const matches = db.prepare('SELECT * FROM matches ORDER BY date DESC').all().map(row => ({
    id: row.id, date: row.date, opponent: row.opponent, result: row.result,
    minutesPlayed: row.minutes_played, goals: row.goals, assists: row.assists,
    shots: row.shots, passesCompleted: row.passes_completed, rating: row.rating, notes: row.notes || '',
  }));

  const customDrills = db.prepare('SELECT name FROM custom_drills ORDER BY name').all().map(r => r.name);

  const settingsRow = db.prepare('SELECT * FROM settings WHERE id=1').get();
  const settings = {
    distanceUnit: settingsRow.distance_unit || 'km',
    weeklyGoal: settingsRow.weekly_goal ?? 3,
    ageGroup: settingsRow.age_group || '',
    skillLevel: settingsRow.skill_level || '',
  };

  const prRow = db.prepare('SELECT data FROM personal_records WHERE id=1').get();
  const personalRecords = prRow?.data ? JSON.parse(prRow.data) : null;

  const trainingPlans = db.prepare('SELECT * FROM training_plans ORDER BY date').all().map(row => ({
    id: row.id, date: row.date, drills: JSON.parse(row.drills || '[]'),
    targetDuration: row.target_duration || 0, notes: row.notes || '',
  }));

  const idpGoals = db.prepare('SELECT * FROM idp_goals ORDER BY created_at').all().map(row => ({
    id: row.id, corner: row.corner, text: row.text, targetDate: row.target_date || '',
    progress: row.progress || 0, status: row.status || 'active',
  }));

  const decisionJournal = db.prepare('SELECT * FROM decision_journal ORDER BY date DESC').all().map(row => ({
    id: row.id, date: row.date, matchId: row.match_id || '', matchLabel: row.match_label || '',
    decisions: JSON.parse(row.decisions || '[]'),
  }));

  const benchmarks = db.prepare('SELECT * FROM benchmarks ORDER BY date DESC').all().map(row => ({
    id: row.id, date: row.date, type: row.type, score: row.score, ...JSON.parse(row.data || '{}'),
  }));

  const templates = db.prepare('SELECT * FROM templates ORDER BY created_at DESC').all().map(row => ({
    id: row.id, name: row.name, ...JSON.parse(row.data || '{}'),
  }));

  res.json({ sessions, matches, customDrills, settings, personalRecords, trainingPlans, idpGoals, decisionJournal, benchmarks, templates });
});

// POST /api/data/import
router.post('/import', (req, res) => {
  const db = getDb();
  const counts = db.transaction(() => importData(db, req.body))();
  res.json({ ok: true, imported: counts });
});

// POST /api/data/clear
router.post('/clear', (req, res) => {
  const db = getDb();
  db.transaction(() => {
    db.prepare('DELETE FROM sessions').run();
    db.prepare('DELETE FROM matches').run();
    db.prepare('DELETE FROM custom_drills').run();
    db.prepare('UPDATE settings SET distance_unit=\'km\', weekly_goal=3, age_group=NULL, skill_level=NULL WHERE id=1').run();
    db.prepare('UPDATE personal_records SET data=NULL WHERE id=1').run();
    db.prepare('DELETE FROM training_plans').run();
    db.prepare('DELETE FROM idp_goals').run();
    db.prepare('DELETE FROM decision_journal').run();
    db.prepare('DELETE FROM benchmarks').run();
    db.prepare('DELETE FROM templates').run();
  })();
  res.json({ ok: true });
});

export default router;
export { importData };
