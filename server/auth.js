import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getDb } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-to-a-random-secret';
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
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
  }
}

const authRouter = Router();

// POST /api/auth/register
authRouter.post('/register', async (req, res) => {
  const { username, password } = req.body;
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
  const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);
  const userId = result.lastInsertRowid;
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
  const refreshToken = jwt.sign({ userId, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_EXPIRY });
  res.status(201).json({ token, refreshToken, userId });
});

// POST /api/auth/login
authRouter.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required', code: 'MISSING_FIELDS' });

  const db = getDb();
  const user = db.prepare('SELECT id, password_hash FROM users WHERE username = ?').get(username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
  const refreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_EXPIRY });
  res.json({ token, refreshToken, userId: user.id });
});

// POST /api/auth/refresh
authRouter.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required', code: 'MISSING_TOKEN' });

  try {
    const payload = jwt.verify(refreshToken, JWT_SECRET);
    if (payload.type !== 'refresh') return res.status(401).json({ error: 'Invalid token type', code: 'INVALID_TOKEN' });
    const token = jwt.sign({ userId: payload.userId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    res.json({ token });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh token', code: 'INVALID_TOKEN' });
  }
});

export { authRouter };
