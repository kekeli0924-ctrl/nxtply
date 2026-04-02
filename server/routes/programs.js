import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

// GET /api/programs/active — get user's active program with current session details
// (Must be before /:id to avoid route conflict)
router.get('/active', (req, res) => {
  const db = getDb();
  const userId = req.userId;

  const enrollment = db.prepare(`
    SELECT up.*, p.name, p.description, p.category, p.difficulty,
           p.duration_weeks, p.sessions_per_week
    FROM user_programs up
    JOIN programs p ON up.program_id = p.id
    WHERE up.user_id = ? AND up.status = 'active'
    ORDER BY up.started_at DESC
    LIMIT 1
  `).get(userId);

  if (!enrollment) {
    return res.json({ active: null });
  }

  const currentSession = db.prepare(`
    SELECT * FROM program_sessions
    WHERE program_id = ? AND week_number = ? AND day_number = ?
  `).get(enrollment.program_id, enrollment.current_week, enrollment.current_day);

  const totalSessions = db.prepare(
    'SELECT COUNT(*) as count FROM program_sessions WHERE program_id = ?'
  ).get(enrollment.program_id).count;

  const completedSessions = JSON.parse(enrollment.completed_sessions || '[]');

  res.json({
    active: {
      enrollmentId: enrollment.id,
      programId: enrollment.program_id,
      name: enrollment.name,
      description: enrollment.description,
      category: enrollment.category,
      difficulty: enrollment.difficulty,
      durationWeeks: enrollment.duration_weeks,
      sessionsPerWeek: enrollment.sessions_per_week,
      currentWeek: enrollment.current_week,
      currentDay: enrollment.current_day,
      status: enrollment.status,
      startedAt: enrollment.started_at,
      completedSessions,
      completedCount: completedSessions.length,
      totalSessions,
      currentSession: currentSession ? {
        id: currentSession.id,
        weekNumber: currentSession.week_number,
        dayNumber: currentSession.day_number,
        title: currentSession.title,
        focus: currentSession.focus,
        drills: JSON.parse(currentSession.drills),
        durationMinutes: currentSession.duration_minutes,
        coachingNotes: currentSession.coaching_notes,
      } : null,
    },
  });
});

// GET /api/programs — list all available programs with session count
router.get('/', (req, res) => {
  const db = getDb();

  const programs = db.prepare(`
    SELECT p.*, COUNT(ps.id) as session_count
    FROM programs p
    LEFT JOIN program_sessions ps ON ps.program_id = p.id
    GROUP BY p.id
    ORDER BY p.id
  `).all();

  res.json(programs.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category,
    difficulty: p.difficulty,
    durationWeeks: p.duration_weeks,
    sessionsPerWeek: p.sessions_per_week,
    isPreset: !!p.is_preset,
    sessionCount: p.session_count,
    createdAt: p.created_at,
  })));
});

// GET /api/programs/:id — single program with all sessions
router.get('/:id', (req, res) => {
  const db = getDb();
  const program = db.prepare('SELECT * FROM programs WHERE id = ?').get(req.params.id);

  if (!program) {
    return res.status(404).json({ error: 'Program not found', code: 'NOT_FOUND' });
  }

  const sessions = db.prepare(
    'SELECT * FROM program_sessions WHERE program_id = ? ORDER BY week_number, day_number'
  ).all(req.params.id);

  // Group sessions by week
  const weeks = {};
  for (const s of sessions) {
    if (!weeks[s.week_number]) weeks[s.week_number] = [];
    weeks[s.week_number].push({
      id: s.id,
      dayNumber: s.day_number,
      title: s.title,
      focus: s.focus,
      drills: JSON.parse(s.drills),
      durationMinutes: s.duration_minutes,
      coachingNotes: s.coaching_notes,
    });
  }

  res.json({
    id: program.id,
    name: program.name,
    description: program.description,
    category: program.category,
    difficulty: program.difficulty,
    durationWeeks: program.duration_weeks,
    sessionsPerWeek: program.sessions_per_week,
    isPreset: !!program.is_preset,
    sessionCount: sessions.length,
    createdAt: program.created_at,
    weeks,
  });
});

// POST /api/programs/:id/enroll — enroll current user
router.post('/:id/enroll', (req, res) => {
  const db = getDb();
  const userId = req.userId;
  const programId = req.params.id;

  const program = db.prepare('SELECT * FROM programs WHERE id = ?').get(programId);
  if (!program) {
    return res.status(404).json({ error: 'Program not found', code: 'NOT_FOUND' });
  }

  // Check if user already has an active program
  const existing = db.prepare(
    "SELECT id FROM user_programs WHERE user_id = ? AND status = 'active'"
  ).get(userId);

  if (existing) {
    return res.status(409).json({
      error: 'You already have an active program. Cancel it before enrolling in a new one.',
      code: 'ALREADY_ENROLLED',
    });
  }

  const result = db.prepare(`
    INSERT INTO user_programs (user_id, program_id, current_week, current_day, status, completed_sessions)
    VALUES (?, ?, 1, 1, 'active', '[]')
  `).run(userId, programId);

  res.status(201).json({
    enrollmentId: result.lastInsertRowid,
    programId: Number(programId),
    programName: program.name,
    status: 'active',
    currentWeek: 1,
    currentDay: 1,
  });
});

// POST /api/programs/active/complete-session — mark current session as done, advance
router.post('/active/complete-session', (req, res) => {
  const db = getDb();
  const userId = req.userId;

  const enrollment = db.prepare(`
    SELECT up.*, p.duration_weeks, p.sessions_per_week
    FROM user_programs up
    JOIN programs p ON up.program_id = p.id
    WHERE up.user_id = ? AND up.status = 'active'
    ORDER BY up.started_at DESC
    LIMIT 1
  `).get(userId);

  if (!enrollment) {
    return res.status(404).json({ error: 'No active program', code: 'NO_ACTIVE_PROGRAM' });
  }

  const currentSession = db.prepare(`
    SELECT id FROM program_sessions
    WHERE program_id = ? AND week_number = ? AND day_number = ?
  `).get(enrollment.program_id, enrollment.current_week, enrollment.current_day);

  if (!currentSession) {
    return res.status(404).json({ error: 'Current session not found', code: 'SESSION_NOT_FOUND' });
  }

  const completedSessions = JSON.parse(enrollment.completed_sessions || '[]');
  completedSessions.push({
    sessionId: currentSession.id,
    week: enrollment.current_week,
    day: enrollment.current_day,
    completedAt: new Date().toISOString(),
  });

  // Determine next session
  let nextWeek = enrollment.current_week;
  let nextDay = enrollment.current_day + 1;
  let programCompleted = false;

  if (nextDay > enrollment.sessions_per_week) {
    nextDay = 1;
    nextWeek += 1;
  }

  if (nextWeek > enrollment.duration_weeks) {
    programCompleted = true;
  }

  if (programCompleted) {
    db.prepare(`
      UPDATE user_programs
      SET completed_sessions = ?, status = 'completed', completed_at = CURRENT_TIMESTAMP,
          current_week = ?, current_day = ?
      WHERE id = ?
    `).run(JSON.stringify(completedSessions), enrollment.duration_weeks, enrollment.sessions_per_week, enrollment.id);

    return res.json({
      completed: true,
      message: 'Congratulations! You have completed the program.',
      completedCount: completedSessions.length,
    });
  }

  db.prepare(`
    UPDATE user_programs
    SET completed_sessions = ?, current_week = ?, current_day = ?
    WHERE id = ?
  `).run(JSON.stringify(completedSessions), nextWeek, nextDay, enrollment.id);

  const nextSession = db.prepare(`
    SELECT * FROM program_sessions
    WHERE program_id = ? AND week_number = ? AND day_number = ?
  `).get(enrollment.program_id, nextWeek, nextDay);

  res.json({
    completed: false,
    completedCount: completedSessions.length,
    currentWeek: nextWeek,
    currentDay: nextDay,
    nextSession: nextSession ? {
      id: nextSession.id,
      title: nextSession.title,
      focus: nextSession.focus,
      drills: JSON.parse(nextSession.drills),
      durationMinutes: nextSession.duration_minutes,
      coachingNotes: nextSession.coaching_notes,
    } : null,
  });
});

// DELETE /api/programs/active — cancel active program
router.delete('/active', (req, res) => {
  const db = getDb();
  const userId = req.userId;

  const enrollment = db.prepare(
    "SELECT id FROM user_programs WHERE user_id = ? AND status = 'active'"
  ).get(userId);

  if (!enrollment) {
    return res.status(404).json({ error: 'No active program', code: 'NO_ACTIVE_PROGRAM' });
  }

  db.prepare(
    "UPDATE user_programs SET status = 'cancelled' WHERE id = ?"
  ).run(enrollment.id);

  res.json({ message: 'Program cancelled', enrollmentId: enrollment.id });
});

export default router;
