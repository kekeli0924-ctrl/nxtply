import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getDb } from './db.js';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required. Set it in your .env file.');
}
const JWT_SECRET = process.env.JWT_SECRET;
// Short-lived access tokens (1h) + longer refresh tokens (7d).
// Both embed a token_version (tv) that's bumped on password change or explicit logout-all,
// allowing revocation of all existing tokens for a user.
const TOKEN_EXPIRY = '1h';
const REFRESH_EXPIRY = '7d';

function signAccessToken(userId, role, tokenVersion) {
  return jwt.sign({ userId, role, tv: tokenVersion ?? 0 }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

function signRefreshToken(userId, tokenVersion) {
  return jwt.sign({ userId, type: 'refresh', tv: tokenVersion ?? 0 }, JWT_SECRET, { expiresIn: REFRESH_EXPIRY });
}

// Verify the JWT signature AND check that its token_version matches the user's current one.
// Returns the payload on success, or throws on any failure (invalid sig, expired, revoked).
function verifyAndCheckRevocation(token) {
  const payload = jwt.verify(token, JWT_SECRET);
  const db = getDb();
  const user = db.prepare('SELECT token_version FROM users WHERE id = ?').get(payload.userId);
  if (!user) {
    const err = new Error('User not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const currentVersion = user.token_version ?? 0;
  if ((payload.tv ?? 0) !== currentVersion) {
    const err = new Error('Token has been revoked');
    err.code = 'REVOKED';
    throw err;
  }
  return payload;
}

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
    const payload = verifyAndCheckRevocation(header.slice(7));
    req.userId = payload.userId;
    req.userRole = payload.role || 'player';
    next();
  } catch (err) {
    if (err.code === 'REVOKED') {
      return res.status(401).json({ error: 'Session has been revoked. Please log in again.', code: 'REVOKED' });
    }
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
  // New users start with token_version = 0 (DB default).
  const token = signAccessToken(userId, userRole, 0);
  const refreshToken = signRefreshToken(userId, 0);
  res.status(201).json({ token, refreshToken, userId, role: userRole });
});

// POST /api/auth/login
authRouter.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required', code: 'MISSING_FIELDS' });

  const db = getDb();
  const user = db.prepare('SELECT id, password_hash, role, token_version FROM users WHERE username = ?').get(username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });

  const role = user.role || 'player';
  const tv = user.token_version ?? 0;
  const token = signAccessToken(user.id, role, tv);
  const refreshToken = signRefreshToken(user.id, tv);
  res.json({ token, refreshToken, userId: user.id, role });
});

// POST /api/auth/refresh
authRouter.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required', code: 'MISSING_TOKEN' });

  try {
    const payload = jwt.verify(refreshToken, JWT_SECRET);
    if (payload.type !== 'refresh') return res.status(401).json({ error: 'Invalid token type', code: 'INVALID_TOKEN' });

    const db = getDb();
    const user = db.prepare('SELECT role, token_version FROM users WHERE id = ?').get(payload.userId);
    if (!user) return res.status(401).json({ error: 'User not found', code: 'INVALID_TOKEN' });

    // Check revocation against current token_version
    if ((payload.tv ?? 0) !== (user.token_version ?? 0)) {
      return res.status(401).json({ error: 'Refresh token has been revoked', code: 'REVOKED' });
    }

    const role = user.role || 'player';
    const token = signAccessToken(payload.userId, role, user.token_version ?? 0);
    res.json({ token });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh token', code: 'INVALID_TOKEN' });
  }
});

// Shared helper: extract + verify Bearer token. Returns payload or sends 401 and returns null.
function extractAuth(req, res) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    return null;
  }
  try {
    return verifyAndCheckRevocation(header.slice(7));
  } catch (err) {
    if (err.code === 'REVOKED') {
      res.status(401).json({ error: 'Session has been revoked. Please log in again.', code: 'REVOKED' });
    } else {
      res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
    }
    return null;
  }
}

// GET /api/auth/me
authRouter.get('/me', (req, res) => {
  const payload = extractAuth(req, res);
  if (!payload) return;
  const db = getDb();
  const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(payload.userId);
  if (!user) return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
  res.json({ userId: user.id, username: user.username, role: user.role || 'player' });
});

// PUT /api/auth/role
authRouter.put('/role', (req, res) => {
  const payload = extractAuth(req, res);
  if (!payload) return;
  const { role } = req.body;
  if (!['coach', 'player', 'parent'].includes(role)) {
    return res.status(400).json({ error: 'Role must be coach, player, or parent', code: 'INVALID_ROLE' });
  }
  const db = getDb();
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, payload.userId);
  // Role change: reissue token with new role but keep same token_version (not a security event).
  const user = db.prepare('SELECT token_version FROM users WHERE id = ?').get(payload.userId);
  const token = signAccessToken(payload.userId, role, user?.token_version ?? 0);
  res.json({ role, token });
});

// PUT /api/auth/password — change password (requires current password)
// SECURITY: bumps token_version to invalidate all other sessions.
authRouter.put('/password', async (req, res) => {
  const payload = extractAuth(req, res);
  if (!payload) return;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password required', code: 'MISSING_FIELDS' });
  }

  const passwordError = validatePassword(newPassword);
  if (passwordError) return res.status(400).json({ error: passwordError, code: 'WEAK_PASSWORD' });

  const db = getDb();
  const user = db.prepare('SELECT password_hash, role, token_version FROM users WHERE id = ?').get(payload.userId);
  if (!user) return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect', code: 'INVALID_PASSWORD' });

  const hash = await bcrypt.hash(newPassword, 12);
  const newVersion = (user.token_version ?? 0) + 1;
  db.prepare('UPDATE users SET password_hash = ?, token_version = ? WHERE id = ?').run(hash, newVersion, payload.userId);

  // Issue a fresh token to the current session so the user isn't logged out from the device that changed the password.
  const role = user.role || 'player';
  const token = signAccessToken(payload.userId, role, newVersion);
  const refreshToken = signRefreshToken(payload.userId, newVersion);
  res.json({ ok: true, token, refreshToken });
});

// POST /api/auth/logout-all — invalidate all sessions for the current user.
authRouter.post('/logout-all', (req, res) => {
  const payload = extractAuth(req, res);
  if (!payload) return;
  const db = getDb();
  db.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?').run(payload.userId);
  res.json({ ok: true });
});

export { authRouter };
