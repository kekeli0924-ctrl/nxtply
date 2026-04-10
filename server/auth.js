import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getDb } from './db.js';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required. Set it in your .env file.');
}
const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRY = '30d';
const REFRESH_EXPIRY = '90d';

const PASSWORD_RULES = {
  minLength: 8,
  requireLetter: /[a-zA-Z]/,
  requireNumber: /\d/,
};

function validatePassword(password) {
  if (!password || password.length < PASSWORD_RULES.minLength) {
    return `Password must be at least ${PASSWORD_RULES.minLength} characters`;
  }
  if (!PASSWORD_RULES.requireLetter.test(password)) {
    return 'Password must contain at least one letter';
  }
  if (!PASSWORD_RULES.requireNumber.test(password)) {
    return 'Password must contain at least one number';
  }
  return null;
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    req.userId = payload.userId;
    req.userRole = payload.role || 'player';
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
  }
}

export function requireCoach(req, res, next) {
  if (req.userRole !== 'coach') {
    return res.status(403).json({ error: 'Coach access required', code: 'FORBIDDEN' });
  }
  next();
}

export function requireParent(req, res, next) {
  if (req.userRole !== 'parent') {
    return res.status(403).json({ error: 'Parent access required', code: 'FORBIDDEN' });
  }
  next();
}

export function requirePlayer(req, res, next) {
  if (req.userRole !== 'player') {
    return res.status(403).json({ error: 'Player access required', code: 'FORBIDDEN' });
  }
  next();
}

const authRouter = Router();

// POST /api/auth/register
authRouter.post('/register', async (req, res) => {
  const { username, password, role } = req.body;
  const userRole = ['coach', 'parent'].includes(role) ? role : 'player';
  if (!username || !password) return res.status(400).json({ error: 'Username and password required', code: 'MISSING_FIELDS' });
  if (username.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters', code: 'USERNAME_SHORT' });
  if (username.length > 50) return res.status(400).json({ error: 'Username too long', code: 'USERNAME_LONG' });
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) return res.status(400).json({ error: 'Username can only contain letters, numbers, hyphens, underscores', code: 'USERNAME_INVALID' });

  const passwordError = validatePassword(password);
  if (passwordError) return res.status(400).json({ error: passwordError, code: 'WEAK_PASSWORD' });

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(409).json({ error: 'Username taken', code: 'USERNAME_TAKEN' });

  const hash = await bcrypt.hash(password, 12);
  const result = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username, hash, userRole);
  const userId = result.lastInsertRowid;
  const token = jwt.sign({ userId, role: userRole }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
  const refreshToken = jwt.sign({ userId, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_EXPIRY });
  res.status(201).json({ token, refreshToken, userId, role: userRole });
});

// POST /api/auth/login
authRouter.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required', code: 'MISSING_FIELDS' });

  const db = getDb();
  const user = db.prepare('SELECT id, password_hash, role FROM users WHERE username = ?').get(username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });

  const token = jwt.sign({ userId: user.id, role: user.role || 'player' }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
  const refreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_EXPIRY });
  res.json({ token, refreshToken, userId: user.id, role: user.role || 'player' });
});

// POST /api/auth/refresh
authRouter.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required', code: 'MISSING_TOKEN' });

  try {
    const payload = jwt.verify(refreshToken, JWT_SECRET);
    if (payload.type !== 'refresh') return res.status(401).json({ error: 'Invalid token type', code: 'INVALID_TOKEN' });
    const db = getDb();
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(payload.userId);
    const token = jwt.sign({ userId: payload.userId, role: user?.role || 'player' }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    res.json({ token });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh token', code: 'INVALID_TOKEN' });
  }
});

// GET /api/auth/me
authRouter.get('/me', (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    const db = getDb();
    const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(payload.userId);
    if (!user) return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
    res.json({ userId: user.id, username: user.username, role: user.role || 'player' });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
  }
});

// PUT /api/auth/role
authRouter.put('/role', (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    const { role } = req.body;
    if (!['coach', 'player', 'parent'].includes(role)) {
      return res.status(400).json({ error: 'Role must be coach, player, or parent', code: 'INVALID_ROLE' });
    }
    const db = getDb();
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, payload.userId);
    const token = jwt.sign({ userId: payload.userId, role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    res.json({ role, token });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
  }
});

// PUT /api/auth/password — change password (requires current password)
authRouter.put('/password', async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password required', code: 'MISSING_FIELDS' });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) return res.status(400).json({ error: passwordError, code: 'WEAK_PASSWORD' });

    const db = getDb();
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(payload.userId);
    if (!user) return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect', code: 'INVALID_PASSWORD' });

    const hash = await bcrypt.hash(newPassword, 12);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, payload.userId);

    res.json({ ok: true });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
  }
});

export { authRouter };
