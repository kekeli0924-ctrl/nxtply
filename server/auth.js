import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { getDb } from './db.js';
import { logger } from './logger.js';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required. Set it in your .env file.');
}
const JWT_SECRET = process.env.JWT_SECRET;
// Short-lived access tokens (1h) + longer refresh tokens (7d).
// Both embed a token_version (tv) that's bumped on password change or explicit logout-all,
// allowing revocation of all existing tokens for a user.
const TOKEN_EXPIRY = '1h';
const REFRESH_EXPIRY = '7d';
// Short-lived pending Google sign-in token. User has 2 minutes to finish onboarding
// after the Google popup. 5 min was overkill — user is actively in front of the screen.
const PENDING_GOOGLE_EXPIRY = '2m';
// Sentinel stored in password_hash for Google-only accounts. bcryptjs short-circuits any
// compare against a hash that isn't 60 chars long (verified in node_modules/bcryptjs/index.js),
// so this can never match a user-supplied password — no brute-force vector.
const GOOGLE_ONLY_SENTINEL = 'google-only';

// Google Identity Services verifier. Null if GOOGLE_CLIENT_ID isn't configured —
// the /google/verify route returns 503 in that case so the frontend can hide the button.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;
if (!GOOGLE_CLIENT_ID) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: GOOGLE_CLIENT_ID must be set in production. Add it to your .env file.');
  }
  logger.warn('GOOGLE_CLIENT_ID not set — Google sign-in will be disabled (dev mode).');
}

function signAccessToken(userId, role, tokenVersion) {
  return jwt.sign({ userId, role, tv: tokenVersion ?? 0 }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

function signRefreshToken(userId, tokenVersion) {
  return jwt.sign({ userId, type: 'refresh', tv: tokenVersion ?? 0 }, JWT_SECRET, { expiresIn: REFRESH_EXPIRY });
}

// Pending Google sign-in token: carries the verified email/google_id/name across the
// client's onboarding flow. Distinct `typ` claim so it can't be confused with an access
// token — authMiddleware rejects any bearer token that has `typ === 'google_pending'`.
function signPendingGoogleToken({ email, googleId, name }) {
  return jwt.sign(
    { typ: 'google_pending', email, gid: googleId, name: name || '' },
    JWT_SECRET,
    { expiresIn: PENDING_GOOGLE_EXPIRY }
  );
}

function verifyPendingGoogleToken(token) {
  const payload = jwt.verify(token, JWT_SECRET);
  if (payload.typ !== 'google_pending') {
    const err = new Error('Not a pending Google token');
    err.code = 'INVALID_TOKEN';
    throw err;
  }
  return payload;
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
    // Defense-in-depth: pending Google tokens must never be accepted as access tokens.
    // They share JWT_SECRET but carry a distinct `typ` claim. If a bug ever leaks a
    // pending token into an Authorization header, this rejects it hard.
    if (payload.typ === 'google_pending') {
      return res.status(401).json({ error: 'Invalid token type', code: 'INVALID_TOKEN' });
    }
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
// Accepts an optional `email` field. If provided, it gets stored with email_verified = 0
// (typed, not proven). Any email conflict — password account OR Google account — returns
// 409 so we can tell the user to log in instead. This is what prevents an attacker from
// claiming a victim's future Google email by typing it into password signup.
authRouter.post('/register', async (req, res) => {
  const { username, password, role, email } = req.body;
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

  // Normalized email: trim + lowercase so "Alice@Gmail.com" collides with "alice@gmail.com".
  const normalizedEmail = email ? String(email).trim().toLowerCase() : null;
  if (normalizedEmail) {
    const emailConflict = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (emailConflict) {
      return res.status(409).json({
        error: 'That email is already used. Log in instead.',
        code: 'EMAIL_TAKEN',
      });
    }
  }

  const hash = await bcrypt.hash(password, 12);
  const result = db.prepare(
    'INSERT INTO users (username, password_hash, role, email, email_verified) VALUES (?, ?, ?, ?, 0)'
  ).run(username, hash, userRole, normalizedEmail);
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
    const payload = verifyAndCheckRevocation(header.slice(7));
    // Same pending-Google-token guard as authMiddleware.
    if (payload.typ === 'google_pending') {
      res.status(401).json({ error: 'Invalid token type', code: 'INVALID_TOKEN' });
      return null;
    }
    return payload;
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

// ── Google Sign-In ───────────────────────────────────────────────────────────
// POST /api/auth/google/verify
// First-touch endpoint. Client sends the ID token (JWT credential) from Google
// Identity Services. We verify it with Google's public keys, then take one of
// three branches based on what's already in the DB:
//
//   Case A  — google_id match    → issue tokens, returning user
//   Case B  — email match + safe → auto-link: set google_id on the existing row,
//                                  bump token_version (invalidates any old sessions
//                                  on that user), issue tokens, returning user
//   Case C  — no match           → mint a short-lived pending token, do NOT create
//                                  the user row yet. Client holds the pending token,
//                                  walks through onboarding (username + role), then
//                                  calls /google/complete to actually create the row.
//
// "Safe to link" means the existing row's email_verified = 1 (i.e. its email was
// proven by a prior Google flow) OR the row is already Google-only (no password).
// Linking to a row whose email_verified = 0 would be an account-takeover vector:
// an attacker could type a victim's future Google email into password signup.
authRouter.post('/google/verify', async (req, res) => {
  if (!googleClient) {
    return res.status(503).json({ error: 'Google sign-in not configured', code: 'GOOGLE_DISABLED' });
  }

  const { credential } = req.body || {};
  if (typeof credential !== 'string' || credential.length === 0) {
    return res.status(400).json({ error: 'Missing credential', code: 'MISSING_FIELDS' });
  }

  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
  } catch (err) {
    logger.warn('Google token verify failed', { message: err.message });
    return res.status(401).json({ error: 'Invalid Google token', code: 'INVALID_GOOGLE_TOKEN' });
  }

  const payload = ticket.getPayload();
  // Defensive re-checks on top of what the library enforces.
  if (!payload || !payload.sub || !payload.email) {
    return res.status(401).json({ error: 'Invalid Google payload', code: 'INVALID_GOOGLE_TOKEN' });
  }
  // Google can return email_verified as boolean true or string "true" — coerce.
  const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
  if (!emailVerified) {
    return res.status(401).json({ error: 'Email not verified by Google', code: 'EMAIL_NOT_VERIFIED' });
  }

  const googleId = payload.sub;
  const email = String(payload.email).trim().toLowerCase();
  const name = payload.name || '';

  const db = getDb();

  // Case A — google_id match: returning user, straight sign-in.
  let user = db.prepare(
    'SELECT id, role, token_version FROM users WHERE google_id = ?'
  ).get(googleId);

  if (user) {
    const role = user.role || 'player';
    const tv = user.token_version ?? 0;
    return res.json({
      token: signAccessToken(user.id, role, tv),
      refreshToken: signRefreshToken(user.id, tv),
      userId: user.id,
      role,
      isNewUser: false,
    });
  }

  // Case B — email match. Only auto-link if it's SAFE to do so.
  user = db.prepare(
    'SELECT id, role, token_version, google_id, email_verified, password_hash FROM users WHERE email = ?'
  ).get(email);

  if (user) {
    if (user.google_id) {
      // Email is already linked to a different google_id. Shouldn't normally happen
      // (Google would have matched Case A), but defend against an edge where the same
      // email points at a stale google_id.
      logger.warn('Email matches user but google_id differs', { userId: user.id });
      return res.status(409).json({
        error: 'This email is already linked to a different Google account',
        code: 'GOOGLE_MISMATCH',
      });
    }

    const isGoogleOnly = user.password_hash === GOOGLE_ONLY_SENTINEL;
    const isVerified = user.email_verified === 1;
    if (!isVerified && !isGoogleOnly) {
      // Password user with an unverified typed email — NOT safe to auto-link.
      return res.status(409).json({
        error: 'That email is already registered. Log in with your password, then link Google from Settings.',
        code: 'EMAIL_TAKEN_UNVERIFIED',
      });
    }

    // Safe to link. Bump token_version so any pre-link sessions on this user get
    // invalidated — treat linking a new auth method as a security-sensitive change,
    // same category as password change.
    const newVersion = (user.token_version ?? 0) + 1;
    db.prepare(`
      UPDATE users
      SET google_id = ?, email_verified = 1, token_version = ?,
          display_name = COALESCE(display_name, ?)
      WHERE id = ?
    `).run(googleId, newVersion, name || null, user.id);

    const role = user.role || 'player';
    return res.json({
      token: signAccessToken(user.id, role, newVersion),
      refreshToken: signRefreshToken(user.id, newVersion),
      userId: user.id,
      role,
      isNewUser: false,
      linked: true,
    });
  }

  // Case C — no match. Mint pending token, defer user creation until onboarding finishes.
  const pendingToken = signPendingGoogleToken({ email, googleId, name });
  return res.json({
    isNewUser: true,
    pendingToken,
    email,
    name,
  });
});

// POST /api/auth/google/complete
// Called after the client walks through onboarding (role + username step). The
// pendingToken carries the already-verified email/google_id/name so we don't have
// to re-hit Google. We check for username collisions, then insert the user row.
authRouter.post('/google/complete', async (req, res) => {
  const { pendingToken, username, role: requestedRole } = req.body || {};

  if (!pendingToken || !username) {
    return res.status(400).json({ error: 'Missing fields', code: 'MISSING_FIELDS' });
  }
  if (username.length < 3 || username.length > 50 || !/^[a-zA-Z0-9_-]+$/.test(username)) {
    return res.status(400).json({
      error: 'Username must be 3–50 chars, letters/numbers/underscores/hyphens only',
      code: 'USERNAME_INVALID',
    });
  }

  let payload;
  try {
    payload = verifyPendingGoogleToken(pendingToken);
  } catch {
    return res.status(401).json({
      error: 'Google sign-in expired. Please start again.',
      code: 'PENDING_EXPIRED',
    });
  }

  const db = getDb();

  // Race-check: did another flow grab these keys while the user was in onboarding?
  const existingByGoogle = db.prepare('SELECT id FROM users WHERE google_id = ?').get(payload.gid);
  if (existingByGoogle) {
    return res.status(409).json({ error: 'Account already exists', code: 'GOOGLE_EXISTS' });
  }
  const existingByUsername = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existingByUsername) {
    return res.status(409).json({ error: 'Username taken', code: 'USERNAME_TAKEN' });
  }
  const existingByEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(payload.email);
  if (existingByEmail) {
    return res.status(409).json({ error: 'Email already registered', code: 'EMAIL_TAKEN' });
  }

  const userRole = ['coach', 'parent'].includes(requestedRole) ? requestedRole : 'player';
  const result = db.prepare(`
    INSERT INTO users (username, password_hash, role, email, email_verified, google_id, display_name)
    VALUES (?, ?, ?, ?, 1, ?, ?)
  `).run(username, GOOGLE_ONLY_SENTINEL, userRole, payload.email, payload.gid, payload.name || null);

  const userId = result.lastInsertRowid;
  const token = signAccessToken(userId, userRole, 0);
  const refreshToken = signRefreshToken(userId, 0);
  return res.status(201).json({ token, refreshToken, userId, role: userRole });
});

export { authRouter };
