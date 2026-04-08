import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

// GET /api/messages/:userId — get conversation with a user
router.get('/:userId', (req, res) => {
  const db = getDb();
  const otherId = parseInt(req.params.userId, 10);

  const messages = db.prepare(`
    SELECT m.*, u.username as from_username
    FROM messages m
    JOIN users u ON u.id = m.from_user
    WHERE (m.from_user = ? AND m.to_user = ?) OR (m.from_user = ? AND m.to_user = ?)
    ORDER BY m.created_at ASC
    LIMIT 100
  `).all(req.userId, otherId, otherId, req.userId);

  res.json(messages.map(m => ({
    id: m.id,
    fromUser: m.from_user,
    fromUsername: m.from_username,
    toUser: m.to_user,
    body: m.body,
    createdAt: m.created_at,
    isMine: m.from_user === req.userId,
  })));
});

// POST /api/messages/:userId — send a message
router.post('/:userId', (req, res) => {
  const db = getDb();
  const toUser = parseInt(req.params.userId, 10);
  const { body } = req.body;

  if (!body?.trim()) return res.status(400).json({ error: 'Message cannot be empty' });
  if (body.length > 1000) return res.status(400).json({ error: 'Message too long (max 1000 chars)' });

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(toUser);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const result = db.prepare('INSERT INTO messages (from_user, to_user, body) VALUES (?, ?, ?)')
    .run(req.userId, toUser, body.trim());

  res.status(201).json({
    id: result.lastInsertRowid,
    fromUser: req.userId,
    toUser,
    body: body.trim(),
    isMine: true,
  });
});

// GET /api/messages — list conversations (unique users you've messaged with)
router.get('/', (req, res) => {
  const db = getDb();

  const conversations = db.prepare(`
    SELECT
      CASE WHEN m.from_user = ? THEN m.to_user ELSE m.from_user END as other_user,
      u.username as other_username,
      m.body as last_message,
      m.created_at as last_at
    FROM messages m
    JOIN users u ON u.id = CASE WHEN m.from_user = ? THEN m.to_user ELSE m.from_user END
    WHERE m.from_user = ? OR m.to_user = ?
    GROUP BY other_user
    ORDER BY m.created_at DESC
  `).all(req.userId, req.userId, req.userId, req.userId);

  res.json(conversations.map(c => ({
    userId: c.other_user,
    username: c.other_username,
    lastMessage: c.last_message,
    lastAt: c.last_at,
  })));
});

// POST /api/session-comments/:sessionId — add comment to a session
router.post('/session-comments/:sessionId', (req, res) => {
  const db = getDb();
  const { body } = req.body;

  if (!body?.trim()) return res.status(400).json({ error: 'Comment cannot be empty' });

  const result = db.prepare('INSERT INTO session_comments (session_id, user_id, body) VALUES (?, ?, ?)')
    .run(req.params.sessionId, req.userId, body.trim());

  const user = db.prepare('SELECT username FROM users WHERE id = ?').get(req.userId);

  res.status(201).json({
    id: result.lastInsertRowid,
    sessionId: req.params.sessionId,
    username: user?.username || 'Unknown',
    body: body.trim(),
  });
});

// GET /api/session-comments/:sessionId — get comments for a session
router.get('/session-comments/:sessionId', (req, res) => {
  const db = getDb();

  // Verify the requesting user owns this session (or is the coach)
  const session = db.prepare('SELECT user_id FROM sessions WHERE id = ?').get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const isOwner = session.user_id === req.userId;
  const isCoach = db.prepare('SELECT id FROM coach_players WHERE coach_id = ? AND player_id = ?').get(req.userId, session.user_id);
  if (!isOwner && !isCoach) return res.status(403).json({ error: 'Access denied' });

  const comments = db.prepare(`
    SELECT sc.*, u.username
    FROM session_comments sc
    JOIN users u ON u.id = sc.user_id
    WHERE sc.session_id = ?
    ORDER BY sc.created_at ASC
  `).all(req.params.sessionId);

  res.json(comments.map(c => ({
    id: c.id,
    username: c.username,
    body: c.body,
    createdAt: c.created_at,
    isMine: c.user_id === req.userId,
  })));
});

export default router;
