import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import { logger } from './logger.js';
import { getDb, resetDb } from './db.js';
import { authMiddleware, authRouter } from './auth.js';
import { backupDatabase } from './backup.js';
import sessionsRouter from './routes/sessions.js';
import customDrillsRouter from './routes/customDrills.js';
import settingsRouter from './routes/settings.js';
import personalRecordsRouter from './routes/personalRecords.js';
import trainingPlansRouter from './routes/trainingPlans.js';
import idpGoalsRouter from './routes/idpGoals.js';
import templatesRouter from './routes/templates.js';
import dataRouter from './routes/data.js';
import rosterRouter from './routes/roster.js';
import assignedPlansRouter from './routes/assignedPlans.js';
import coachDashboardRouter from './routes/coachDashboard.js';
import videoAnalysisRouter from './routes/videoAnalysis.js';
import friendsRouter from './routes/friends.js';
import messagingRouter from './routes/messaging.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

// ── Env validation ──────────────────────────────────────
if (isProd) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret === 'change-me-to-a-random-secret') {
    logger.warn('JWT_SECRET is not set or using insecure default — set a strong random value in .env');
  }
  if (!process.env.CORS_ORIGIN) {
    logger.warn('CORS_ORIGIN not set — defaulting to http://localhost:5173');
  }
}

const app = express();

// ── Security headers + CSP ──────────────────────────────
app.use(helmet({
  contentSecurityPolicy: isProd ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  } : false,
}));

app.use(compression());

// ── CORS ────────────────────────────────────────────────
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin: isProd ? corsOrigin : true,
  credentials: true,
}));

// ── Body parsing ────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));

// ── XSS sanitization — strip HTML tags from string values ─
function sanitizeStrings(obj) {
  if (typeof obj === 'string') return obj.replace(/<[^>]*>/g, '');
  if (Array.isArray(obj)) return obj.map(sanitizeStrings);
  if (obj && typeof obj === 'object') {
    const clean = {};
    for (const [k, v] of Object.entries(obj)) {
      clean[k] = sanitizeStrings(v);
    }
    return clean;
  }
  return obj;
}

app.use('/api', (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeStrings(req.body);
  }
  next();
});

// ── CSRF defense-in-depth (origin check) ────────────────
// JWT Bearer tokens inherently prevent CSRF (custom headers
// can't be set by cross-origin forms). This adds an extra layer.
if (isProd) {
  app.use('/api', (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.headers.origin || req.headers.referer;
    if (origin && new URL(origin).origin !== new URL(corsOrigin).origin) {
      logger.warn('CSRF origin mismatch', { origin, expected: corsOrigin });
      return res.status(403).json({ error: 'Forbidden', code: 'CSRF_ORIGIN_MISMATCH' });
    }
    next();
  });
}

// ── Rate limiting ───────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later', code: 'RATE_LIMIT' },
});
app.use('/api', apiLimiter);

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, try again later', code: 'AUTH_RATE_LIMIT' },
});

// ── Request logging ─────────────────────────────────────
app.use('/api', (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// ── Health check (no auth) ──────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Auth routes ─────────────────────────────────────────
app.use('/api/auth', authLimiter, authRouter);

// Protected API routes — auth required in production
if (isProd) {
  app.use('/api', authMiddleware);
} else {
  // Dev mode: provide default user identity so routes always have req.userId/req.userRole
  // userId 1 = player, userId 2 = coach (so invite codes work between them)
  // Role is determined by: X-Dev-Role header OR cookie
  app.use('/api', (req, res, next) => {
    if (!req.userId) {
      const db = getDb();
      db.prepare("INSERT OR IGNORE INTO users (id, username, password_hash, role) VALUES (1, 'player1', 'dev', 'player')").run();
      db.prepare("INSERT OR IGNORE INTO users (id, username, password_hash, role) VALUES (2, 'coach1', 'dev', 'coach')").run();

      // Check header first, then cookie
      const role = req.headers['x-dev-role'] || req.query._role || 'player';
      req.userId = role === 'coach' ? 2 : 1;
      req.userRole = role;
    }
    next();
  });
}

// ── API routes ──────────────────────────────────────────
app.use('/api/sessions', sessionsRouter);
app.use('/api/custom-drills', customDrillsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/personal-records', personalRecordsRouter);
app.use('/api/training-plans', trainingPlansRouter);
app.use('/api/idp-goals', idpGoalsRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/data', dataRouter);
app.use('/api/roster', rosterRouter);
app.use('/api/assigned-plans', assignedPlansRouter);
app.use('/api/coach', coachDashboardRouter);
app.use('/api/video', videoAnalysisRouter);
app.use('/api/friends', friendsRouter);
app.use('/api/messages', messagingRouter);

// ── API 404 ─────────────────────────────────────────────
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
});

// ── Standardized error handler ──────────────────────────
app.use('/api', (err, req, res, next) => {
  const status = err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';
  logger.error(`${req.method} ${req.originalUrl}`, { status, code, message: err.message });
  res.status(status).json({
    error: isProd ? 'Internal server error' : err.message,
    code,
  });
});

// ── Production: serve Vite build ────────────────────────
if (isProd) {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath, { maxAge: '1d' }));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ── Daily backup ────────────────────────────────────────
backupDatabase();
const backupInterval = setInterval(backupDatabase, 24 * 60 * 60 * 1000);

// ── Start server ────────────────────────────────────────
const server = app.listen(PORT, () => {
  logger.info(`Composed API running on http://localhost:${PORT} (${isProd ? 'production' : 'development'})`);
});

// ── Graceful shutdown ───────────────────────────────────
function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully`);
  clearInterval(backupInterval);
  server.close(() => {
    logger.info('HTTP server closed');
    resetDb();
    logger.info('Database closed');
    process.exit(0);
  });
  // Force exit after 10s if graceful shutdown stalls
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
