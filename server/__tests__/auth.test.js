// Auth + Google sign-in test suite. Mocks google-auth-library's verifyIdToken so
// we don't hit real Google, and covers the 6 main branches of /google/verify
// plus the register-with-email conflict logic.
//
// Must run in isolation from api.test.js because both touch the users table.
// Each test resets the DB via resetDb() in beforeEach.
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-jwt-secret-ffffffffffffffffffffffff';
process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
process.env.NODE_ENV = 'test';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Mock google-auth-library BEFORE importing auth.js so OAuth2Client uses our stub.
// The mock returns whatever payload was previously queued via setNextGooglePayload().
let nextGooglePayload = null;
let nextGoogleShouldThrow = false;

vi.mock('google-auth-library', () => {
  class OAuth2Client {
    async verifyIdToken() {
      if (nextGoogleShouldThrow) {
        throw new Error('Token used too late');
      }
      return {
        getPayload: () => nextGooglePayload,
      };
    }
  }
  return { OAuth2Client };
});

function setNextGooglePayload(payload) {
  nextGooglePayload = payload;
  nextGoogleShouldThrow = false;
}
function setGoogleFailNext() {
  nextGoogleShouldThrow = true;
  nextGooglePayload = null;
}

// Dynamic imports so the module-level GOOGLE_CLIENT_ID check runs with env set above.
const { getDb, resetDb } = await import('../db.js');
const { authRouter } = await import('../auth.js');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  return app;
}

let app;
beforeEach(() => {
  resetDb();
  getDb();
  app = makeApp();
  nextGooglePayload = null;
  nextGoogleShouldThrow = false;
});

// ── Classic auth routes ──────────────────────────────────────────────────────

describe('POST /auth/register', () => {
  it('creates user without email (backward compat)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.role).toBe('player');
  });

  it('creates user with optional email and normalizes to lowercase', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'bob', password: 'password123', email: 'Bob@Gmail.com' });
    expect(res.status).toBe(201);
    const row = getDb().prepare('SELECT email, email_verified FROM users WHERE username = ?').get('bob');
    expect(row.email).toBe('bob@gmail.com');
    expect(row.email_verified).toBe(0); // Typed, not proven.
  });

  it('rejects 409 when email is already taken', async () => {
    await request(app).post('/api/auth/register')
      .send({ username: 'carol', password: 'password123', email: 'carol@example.com' });
    const res = await request(app).post('/api/auth/register')
      .send({ username: 'carol2', password: 'password123', email: 'carol@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_TAKEN');
  });

  it('rejects weak password', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ username: 'dave', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('WEAK_PASSWORD');
  });
});

// ── Google sign-in ───────────────────────────────────────────────────────────

describe('POST /auth/google/verify', () => {
  it('Case C: new email returns isNewUser + pendingToken, creates NO user row', async () => {
    setNextGooglePayload({
      sub: 'google-sub-new-1',
      email: 'new@gmail.com',
      email_verified: true,
      name: 'New User',
    });
    const res = await request(app).post('/api/auth/google/verify').send({ credential: 'fake' });
    expect(res.status).toBe(200);
    expect(res.body.isNewUser).toBe(true);
    expect(res.body.pendingToken).toBeTruthy();
    expect(res.body.email).toBe('new@gmail.com');
    expect(res.body.name).toBe('New User');

    // Verify pending token structure
    const decoded = jwt.decode(res.body.pendingToken);
    expect(decoded.typ).toBe('google_pending');
    expect(decoded.gid).toBe('google-sub-new-1');

    // Crucially: no user row should exist yet
    const count = getDb().prepare('SELECT COUNT(*) as n FROM users').get().n;
    expect(count).toBe(0);
  });

  it('Case A: returning Google user (google_id match) signs in', async () => {
    // Seed a Google-only user
    getDb().prepare(`
      INSERT INTO users (username, password_hash, role, email, email_verified, google_id, display_name, token_version)
      VALUES ('alice', 'google-only', 'player', 'alice@gmail.com', 1, 'google-sub-alice', 'Alice', 0)
    `).run();

    setNextGooglePayload({
      sub: 'google-sub-alice',
      email: 'alice@gmail.com',
      email_verified: true,
      name: 'Alice',
    });
    const res = await request(app).post('/api/auth/google/verify').send({ credential: 'fake' });
    expect(res.status).toBe(200);
    expect(res.body.isNewUser).toBe(false);
    expect(res.body.token).toBeTruthy();
    expect(res.body.role).toBe('player');
  });

  it('Case B: password user with verified email auto-links Google and bumps token_version', async () => {
    // Seed a password user whose email is verified (simulating a future email-verification flow)
    getDb().prepare(`
      INSERT INTO users (username, password_hash, role, email, email_verified, token_version)
      VALUES ('betty', 'fake-bcrypt-hash-60-chars-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'player', 'betty@example.com', 1, 5)
    `).run();

    setNextGooglePayload({
      sub: 'google-sub-betty',
      email: 'betty@example.com',
      email_verified: true,
      name: 'Betty',
    });
    const res = await request(app).post('/api/auth/google/verify').send({ credential: 'fake' });
    expect(res.status).toBe(200);
    expect(res.body.isNewUser).toBe(false);
    expect(res.body.linked).toBe(true);

    const row = getDb().prepare('SELECT google_id, token_version FROM users WHERE username = ?').get('betty');
    expect(row.google_id).toBe('google-sub-betty');
    expect(row.token_version).toBe(6); // bumped from 5
  });

  it('rejects 409 when email matches a password user with UNVERIFIED email (takeover guard)', async () => {
    // This is the account-takeover-prevention test. An attacker signed up with
    // email_verified=0 claiming the victim's email. Victim clicks Continue with Google.
    // We MUST NOT auto-link — we have no proof the attacker ever owned that email.
    getDb().prepare(`
      INSERT INTO users (username, password_hash, role, email, email_verified, token_version)
      VALUES ('attacker', 'fake-bcrypt-hash-60-chars-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'player', 'victim@gmail.com', 0, 0)
    `).run();

    setNextGooglePayload({
      sub: 'google-sub-victim',
      email: 'victim@gmail.com',
      email_verified: true,
      name: 'Victim',
    });
    const res = await request(app).post('/api/auth/google/verify').send({ credential: 'fake' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_TAKEN_UNVERIFIED');

    // Attacker's row must be untouched.
    const row = getDb().prepare('SELECT google_id, token_version FROM users WHERE username = ?').get('attacker');
    expect(row.google_id).toBeNull();
    expect(row.token_version).toBe(0);
  });

  it('rejects 401 when Google says email_verified is false', async () => {
    setNextGooglePayload({
      sub: 'google-sub-unverified',
      email: 'unverified@gmail.com',
      email_verified: false,
      name: 'Someone',
    });
    const res = await request(app).post('/api/auth/google/verify').send({ credential: 'fake' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('rejects 401 when verifyIdToken throws (bad credential)', async () => {
    setGoogleFailNext();
    const res = await request(app).post('/api/auth/google/verify').send({ credential: 'garbage' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_GOOGLE_TOKEN');
  });

  it('rejects 400 when credential field missing', async () => {
    const res = await request(app).post('/api/auth/google/verify').send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_FIELDS');
  });
});

describe('POST /auth/google/complete', () => {
  async function getPendingToken(payload) {
    setNextGooglePayload(payload);
    const res = await request(app).post('/api/auth/google/verify').send({ credential: 'fake' });
    return res.body.pendingToken;
  }

  it('creates user row with email_verified=1 and google_id set', async () => {
    const pendingToken = await getPendingToken({
      sub: 'google-sub-ed',
      email: 'ed@gmail.com',
      email_verified: true,
      name: 'Ed',
    });
    const res = await request(app).post('/api/auth/google/complete')
      .send({ pendingToken, username: 'edward', role: 'player' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();

    const row = getDb().prepare('SELECT * FROM users WHERE username = ?').get('edward');
    expect(row.google_id).toBe('google-sub-ed');
    expect(row.email).toBe('ed@gmail.com');
    expect(row.email_verified).toBe(1);
    expect(row.password_hash).toBe('google-only');
    expect(row.display_name).toBe('Ed');
  });

  it('rejects 409 when username taken at completion time', async () => {
    // Seed another user with the same username
    getDb().prepare(`
      INSERT INTO users (username, password_hash, role) VALUES ('taken', 'fake-hash', 'player')
    `).run();

    const pendingToken = await getPendingToken({
      sub: 'google-sub-frank',
      email: 'frank@gmail.com',
      email_verified: true,
      name: 'Frank',
    });
    const res = await request(app).post('/api/auth/google/complete')
      .send({ pendingToken, username: 'taken', role: 'player' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('USERNAME_TAKEN');
  });

  it('rejects 401 when pendingToken is not a google_pending token', async () => {
    // Forge a regular JWT (type looks like a real access token) and try to use it
    // as a pendingToken. Must be rejected because typ !== 'google_pending'.
    const badToken = jwt.sign({ userId: 999, role: 'player', tv: 0 }, process.env.JWT_SECRET);
    const res = await request(app).post('/api/auth/google/complete')
      .send({ pendingToken: badToken, username: 'hacker', role: 'player' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('PENDING_EXPIRED');
  });

  it('rejects 400 when username is invalid', async () => {
    const pendingToken = await getPendingToken({
      sub: 'google-sub-g',
      email: 'g@gmail.com',
      email_verified: true,
      name: 'G',
    });
    const res = await request(app).post('/api/auth/google/complete')
      .send({ pendingToken, username: 'ab', role: 'player' }); // too short
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('USERNAME_INVALID');
  });
});
