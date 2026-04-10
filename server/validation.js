import { z } from 'zod';

// Reusable
const uuid = z.string().min(1).max(100);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');
const shortText = z.string().max(2000).default('');
const jsonObj = z.any().nullable().optional();

// Sessions
export const sessionSchema = z.object({
  id: uuid,
  date: dateStr,
  duration: z.coerce.number().int().min(0).max(1440),
  drills: z.array(z.string().max(200)).max(50).default([]),
  notes: shortText,
  intention: shortText,
  sessionType: z.string().max(100).default(''),
  position: z.string().max(100).default('general'),
  quickRating: z.coerce.number().int().min(1).max(10).default(3),
  bodyCheck: jsonObj,
  shooting: jsonObj,
  passing: jsonObj,
  fitness: jsonObj,
  delivery: jsonObj,
  attacking: jsonObj,
  reflection: jsonObj,
  idpGoals: z.array(z.string().max(100)).max(20).default([]),
  mediaLinks: z.array(z.object({
    url: z.string().url().max(2000),
    label: z.string().max(200).default(''),
    type: z.enum(['youtube', 'drive', 'other']).default('other'),
  })).max(10).default([]),
}).strict();

// Matches
export const matchSchema = z.object({
  id: uuid,
  date: dateStr,
  opponent: z.string().min(1).max(200),
  result: z.enum(['W', 'D', 'L']),
  minutesPlayed: z.coerce.number().int().min(0).max(300).default(0),
  goals: z.coerce.number().int().min(0).max(50).default(0),
  assists: z.coerce.number().int().min(0).max(50).default(0),
  shots: z.coerce.number().int().min(0).max(200).default(0),
  passesCompleted: z.coerce.number().int().min(0).max(2000).default(0),
  rating: z.coerce.number().int().min(1).max(10).default(6),
  notes: shortText,
}).strict();

// Custom drills
export const customDrillSchema = z.object({
  name: z.string().min(1).max(200),
});

// Settings
export const settingsSchema = z.object({
  distanceUnit: z.enum(['km', 'mi']).optional(),
  weeklyGoal: z.coerce.number().int().min(1).max(14).optional(),
  ageGroup: z.string().max(50).optional(),
  skillLevel: z.string().max(50).optional(),
  playerName: z.string().max(100).optional(),
  onboardingComplete: z.coerce.number().int().min(0).max(1).optional(),
  gettingStartedComplete: z.coerce.number().int().min(0).max(1).optional(),
  position: z.string().max(50).optional(),
  equipment: z.array(z.string()).optional(),
  playerIdentity: z.string().max(100).optional(),
}).strict();

// Training plans
export const trainingPlanSchema = z.object({
  id: uuid,
  date: dateStr,
  drills: z.array(z.string().max(200)).max(50).default([]),
  targetDuration: z.coerce.number().int().min(0).max(1440).default(0),
  notes: shortText,
}).strict();

// IDP goals
export const idpGoalSchema = z.object({
  id: uuid,
  corner: z.enum(['technical', 'tactical', 'physical', 'psychological']),
  text: z.string().min(1).max(1000),
  targetDate: z.string().max(20).default(''),
  progress: z.coerce.number().int().min(0).max(100).default(0),
  status: z.enum(['active', 'completed']).default('active'),
  targetMetric: z.string().max(50).optional(),
  targetValue: z.coerce.number().optional(),
}).strict();

// Decision journal
export const decisionJournalSchema = z.object({
  id: uuid,
  date: dateStr,
  matchId: z.string().max(100).default(''),
  matchLabel: z.string().max(200).default(''),
  decisions: z.array(z.record(z.string(), z.unknown())).max(100).default([]),
}).strict();

// Benchmarks
export const benchmarkSchema = z.object({
  id: uuid,
  date: dateStr,
  type: z.enum(['lspt', 'lsst']),
  score: z.coerce.number().min(0).max(10000).default(0),
}).passthrough(); // allow extra data fields

// Templates
export const templateSchema = z.object({
  id: uuid,
  name: z.string().min(1).max(200),
}).passthrough(); // allow extra data fields

// Roster / invite
export const redeemInviteSchema = z.object({
  code: z.string().min(4).max(20),
}).strict();

// Assigned plans (coach → player)
export const assignedPlanSchema = z.object({
  id: uuid,
  playerId: z.coerce.number().int(),
  date: dateStr,
  drills: z.array(z.string().max(200)).max(50).default([]),
  targetDuration: z.coerce.number().int().min(0).max(1440).default(0),
  notes: shortText,
}).strict();

// Assigned plan updates — id comes from URL, so not required in body.
// Coach cannot move a plan to a different player via PUT, so playerId is excluded.
export const assignedPlanUpdateSchema = z.object({
  date: dateStr.optional(),
  drills: z.array(z.string().max(200)).max(50).optional(),
  targetDuration: z.coerce.number().int().min(0).max(1440).optional(),
  notes: shortText.optional(),
}).strict();

// Parent visibility settings — three boolean toggles.
export const parentVisibilitySchema = z.object({
  showRatings: z.boolean().optional(),
  showCoachFeedback: z.boolean().optional(),
  showIdpGoals: z.boolean().optional(),
}).strict();

// ── Auth schemas ─────────────────────────────────────────────────────────────
// Username rules match the inline checks in server/auth.js: 3–50 chars,
// alphanumeric + underscore/hyphen. Password must contain at least one letter
// and one digit (that check stays in validatePassword() in auth.js because it's
// a richer check than regex alone).
const usernameField = z
  .string()
  .min(3, 'Username must be 3–50 characters')
  .max(50, 'Username must be 3–50 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens');

const roleField = z.enum(['player', 'coach', 'parent']).optional();

// POST /auth/register — email is OPTIONAL to keep backward compat with
// existing clients that don't send it. If present, it gets stored with
// email_verified = 0 (typed, not verified).
export const registerSchema = z.object({
  username: usernameField,
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: roleField,
  email: z.string().email('Invalid email').max(320).optional(),
}).strict();

// POST /auth/login — unchanged but now formalized.
export const loginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(500),
}).strict();

// POST /auth/google/verify — client forwards the ID token from Google
// Identity Services. No other fields needed on first touch.
export const googleVerifySchema = z.object({
  credential: z.string().min(10).max(4096),
}).strict();

// POST /auth/google/complete — called after onboarding to actually create
// the user row. The pendingToken carries the verified google_id/email/name,
// and the client provides the username picked during onboarding.
export const googleCompleteSchema = z.object({
  pendingToken: z.string().min(10).max(4096),
  username: usernameField,
  role: roleField,
}).strict();

// Middleware factory
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    req.body = result.data;
    next();
  };
}
