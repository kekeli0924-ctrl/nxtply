import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

// GET /api/friends/search?q=username — search users by username
router.get('/search', (req, res) => {
  const q = req.query.q?.trim();
  if (!q || q.length < 2) return res.json([]);

  const db = getDb();
  const users = db.prepare(
    "SELECT id, username FROM users WHERE username LIKE ? AND id != ? LIMIT 10"
  ).all(`%${q}%`, req.userId);

  // Mark which ones are already friends
  const friendIds = new Set(
    db.prepare(`
      SELECT CASE WHEN fc.user_a = ? THEN fc.user_b ELSE fc.user_a END as fid
      FROM friend_connections fc WHERE fc.user_a = ? OR fc.user_b = ?
    `).all(req.userId, req.userId, req.userId).map(r => r.fid)
  );

  res.json(users.map(u => ({
    userId: u.id,
    username: u.username,
    isFriend: friendIds.has(u.id),
  })));
});

// POST /api/friends/add — add friend by user ID
router.post('/add', (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  if (userId === req.userId) return res.status(400).json({ error: 'Cannot add yourself' });

  const db = getDb();
  const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const existing = db.prepare(
    'SELECT id FROM friend_connections WHERE (user_a = ? AND user_b = ?) OR (user_a = ? AND user_b = ?)'
  ).get(req.userId, userId, userId, req.userId);
  if (existing) return res.status(400).json({ error: 'Already friends' });

  db.prepare('INSERT INTO friend_connections (user_a, user_b) VALUES (?, ?)').run(req.userId, userId);
  res.json({ friendId: user.id, username: user.username });
});

// GET /api/friends — list all friends
router.get('/', (req, res) => {
  const db = getDb();
  const friends = db.prepare(`
    SELECT u.id, u.username FROM friend_connections fc
    JOIN users u ON (u.id = CASE WHEN fc.user_a = ? THEN fc.user_b ELSE fc.user_a END)
    WHERE fc.user_a = ? OR fc.user_b = ?
  `).all(req.userId, req.userId, req.userId);

  res.json(friends.map(f => ({ friendId: f.id, username: f.username })));
});

// GET /api/friends/feed — recent sessions from friends
router.get('/feed', (req, res) => {
  const db = getDb();

  const friends = db.prepare(`
    SELECT CASE WHEN fc.user_a = ? THEN fc.user_b ELSE fc.user_a END as friend_id
    FROM friend_connections fc WHERE fc.user_a = ? OR fc.user_b = ?
  `).all(req.userId, req.userId, req.userId);

  if (friends.length === 0) return res.json([]);

  const friendIds = friends.map(f => f.friend_id);
  const placeholders = friendIds.map(() => '?').join(',');
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const sessions = db.prepare(
    `SELECT s.*, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.user_id IN (${placeholders}) AND s.date >= ? ORDER BY s.date DESC LIMIT 20`
  ).all(...friendIds, weekAgo);

  const feed = sessions.map(row => {
    const shooting = JSON.parse(row.shooting || 'null');
    const passing = JSON.parse(row.passing || 'null');
    const drills = JSON.parse(row.drills || '[]');

    let shotPct = null;
    if (shooting?.shotsTaken > 0) shotPct = Math.round((shooting.goals / shooting.shotsTaken) * 100);
    let passPct = null;
    if (passing?.attempts > 0) passPct = Math.round((passing.completed / passing.attempts) * 100);

    return {
      username: row.username || 'Player',
      date: row.date,
      duration: row.duration,
      drills: drills.slice(0, 3),
      quickRating: row.quick_rating,
      shotPct,
      passPct,
    };
  });

  res.json(feed);
});

// DELETE /api/friends/:friendId — remove friend
router.delete('/:friendId', (req, res) => {
  const db = getDb();
  const friendId = parseInt(req.params.friendId, 10);
  db.prepare('DELETE FROM friend_connections WHERE (user_a = ? AND user_b = ?) OR (user_a = ? AND user_b = ?)')
    .run(req.userId, friendId, friendId, req.userId);
  res.json({ ok: true });
});

export default router;
