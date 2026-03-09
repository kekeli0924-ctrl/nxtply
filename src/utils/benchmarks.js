import {
  getStreak, getAverageStat, getShotPercentage, getPassPercentage,
  getSessionLoad, getWeeklyLoads,
} from './stats';

// ── Constants ──────────────────────────────────────────────────────────────

export const AGE_GROUPS = ['U12', 'U14', 'U16', 'U18', 'U21', 'Senior'];
export const SKILL_LEVELS = ['Recreational', 'Academy', 'Semi-Pro', 'Professional'];

export const METRIC_KEYS = [
  'sessionsPerWeek',
  'longestStreak',
  'shotAccuracy',
  'passAccuracy',
  'avgSessionLoad',
  'progressRate',
];

export const METRIC_LABELS = {
  sessionsPerWeek: 'Training Volume',
  longestStreak: 'Consistency Streak',
  shotAccuracy: 'Shot Accuracy',
  passAccuracy: 'Pass Accuracy',
  avgSessionLoad: 'Session Intensity',
  progressRate: 'Progress Rate',
};

export const METRIC_UNITS = {
  sessionsPerWeek: 'sessions/wk',
  longestStreak: 'days',
  shotAccuracy: '%',
  passAccuracy: '%',
  avgSessionLoad: 'load',
  progressRate: '%pts',
};

// ── Benchmark Distributions ────────────────────────────────────────────────
// Each entry: { P10, P25, P50, P75, P90, P95 }
// Values based on youth soccer development norms (FA England, US Soccer DA).
// Scaled by age (younger = lower ceiling) and skill level (rec→pro).

const BASE = {
  // ── Recreational ──
  Recreational: {
    sessionsPerWeek: [0.5, 1.0, 1.5, 2.0, 3.0, 3.5],
    longestStreak:   [1,   2,   3,   5,   7,   10],
    shotAccuracy:    [8,  14,  22,  30,  38,  44],
    passAccuracy:    [28, 38,  50,  60,  70,  75],
    avgSessionLoad:  [40, 90, 170, 260, 350, 410],
    progressRate:    [-5, -1,   1,   3,   6,   8],
  },
  // ── Academy ──
  Academy: {
    sessionsPerWeek: [2.0, 3.0, 4.0, 5.0, 6.0, 7.0],
    longestStreak:   [2,   4,   7,  12,  18,  25],
    shotAccuracy:    [16, 24,  32,  40,  50,  56],
    passAccuracy:    [42, 54,  64,  72,  80,  85],
    avgSessionLoad:  [140,240, 350, 440, 530, 600],
    progressRate:    [-3,  0,   2,   4,   7,   9],
  },
  // ── Semi-Pro ──
  'Semi-Pro': {
    sessionsPerWeek: [3.0, 4.0, 5.0, 6.0, 7.5, 8.5],
    longestStreak:   [3,   6,  10,  16,  24,  30],
    shotAccuracy:    [22, 30,  38,  46,  55,  60],
    passAccuracy:    [52, 62,  72,  78,  85,  88],
    avgSessionLoad:  [200,320, 440, 540, 640, 720],
    progressRate:    [-3, -0.5, 1.5, 3.5, 6,   8],
  },
  // ── Professional ──
  Professional: {
    sessionsPerWeek: [4.0, 5.5, 7.0, 8.5, 10, 11],
    longestStreak:   [5,  10,  16,  22,  30,  40],
    shotAccuracy:    [28, 36,  44,  52,  60,  66],
    passAccuracy:    [60, 70,  78,  84,  90,  93],
    avgSessionLoad:  [280,400, 540, 660, 780, 860],
    progressRate:    [-2, -0.5, 1,   3,   5,   7],
  },
};

// Age multipliers: younger ages have lower absolute ceilings
const AGE_SCALE = {
  U12:    0.70,
  U14:    0.80,
  U16:    0.90,
  U18:    0.95,
  U21:    1.00,
  Senior: 1.05,
};

// Metrics where age scaling applies (not progressRate — that stays stable)
const SCALABLE_METRICS = ['sessionsPerWeek', 'longestStreak', 'shotAccuracy', 'passAccuracy', 'avgSessionLoad'];

function toDist(arr) {
  return { P10: arr[0], P25: arr[1], P50: arr[2], P75: arr[3], P90: arr[4], P95: arr[5] };
}

function buildBenchmarks() {
  const result = {};
  for (const age of AGE_GROUPS) {
    result[age] = {};
    const scale = AGE_SCALE[age];
    for (const level of SKILL_LEVELS) {
      result[age][level] = {};
      const base = BASE[level];
      for (const metric of METRIC_KEYS) {
        const raw = base[metric];
        if (SCALABLE_METRICS.includes(metric)) {
          result[age][level][metric] = toDist(raw.map(v => Math.round(v * scale * 10) / 10));
        } else {
          result[age][level][metric] = toDist(raw);
        }
      }
    }
  }
  return result;
}

export const BENCHMARKS = buildBenchmarks();

// ── Percentile Calculation ─────────────────────────────────────────────────

/**
 * Calculate percentile rank (1–99) via linear interpolation.
 */
export function calculatePercentile(value, distribution) {
  const bps = [
    { pct: 10, val: distribution.P10 },
    { pct: 25, val: distribution.P25 },
    { pct: 50, val: distribution.P50 },
    { pct: 75, val: distribution.P75 },
    { pct: 90, val: distribution.P90 },
    { pct: 95, val: distribution.P95 },
  ];

  if (value <= bps[0].val) {
    if (bps[0].val === 0) return 5;
    const ratio = Math.max(0, value / bps[0].val);
    return Math.max(1, Math.round(ratio * 10));
  }

  if (value >= bps[bps.length - 1].val) return 99;

  for (let i = 0; i < bps.length - 1; i++) {
    if (value >= bps[i].val && value <= bps[i + 1].val) {
      const range = bps[i + 1].val - bps[i].val;
      if (range === 0) return bps[i].pct;
      const frac = (value - bps[i].val) / range;
      return Math.round(bps[i].pct + frac * (bps[i + 1].pct - bps[i].pct));
    }
  }

  return 50;
}

// ── Tier Classification ────────────────────────────────────────────────────

export function getTier(percentile) {
  if (percentile >= 90) return { label: 'Elite', color: 'text-green-700', bgColor: 'bg-green-100' };
  if (percentile >= 75) return { label: 'Advanced', color: 'text-blue-700', bgColor: 'bg-blue-100' };
  if (percentile >= 50) return { label: 'Competitive', color: 'text-accent', bgColor: 'bg-accent/10' };
  if (percentile >= 25) return { label: 'Developing', color: 'text-amber-700', bgColor: 'bg-amber-100' };
  return { label: 'Recreational', color: 'text-gray-600', bgColor: 'bg-gray-100' };
}

// ── User Metric Computation ────────────────────────────────────────────────

export function computeUserMetrics(sessions) {
  if (!sessions.length) return null;

  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));

  // Sessions per week (last 4 weeks)
  const weeklyLoads = getWeeklyLoads(sessions, 4);
  const sessionsPerWeek = weeklyLoads.length
    ? +(weeklyLoads.reduce((sum, w) => sum + w.sessionCount, 0) / weeklyLoads.length).toFixed(1)
    : 0;

  const longestStreak = getStreak(sessions);
  const shotAccuracy = getAverageStat(sessions, getShotPercentage, 10);
  const passAccuracy = getAverageStat(sessions, getPassPercentage, 10);
  const avgSessionLoad = getAverageStat(sessions, getSessionLoad, 10);

  // Progress rate: shot% change (last 5 vs previous 5)
  let progressRate = null;
  if (sorted.length >= 10) {
    const recent = sorted.slice(0, 5).map(getShotPercentage).filter(v => v !== null);
    const prev = sorted.slice(5, 10).map(getShotPercentage).filter(v => v !== null);
    if (recent.length && prev.length) {
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const prevAvg = prev.reduce((a, b) => a + b, 0) / prev.length;
      progressRate = Math.round((recentAvg - prevAvg) * 10) / 10;
    }
  }

  return { sessionsPerWeek, longestStreak, shotAccuracy, passAccuracy, avgSessionLoad, progressRate };
}

// ── Full Comparison ────────────────────────────────────────────────────────

export function computeComparison(sessions, ageGroup, skillLevel) {
  if (!ageGroup || !skillLevel) return null;
  if (sessions.length < 5) return null;

  const benchmarkSet = BENCHMARKS[ageGroup]?.[skillLevel];
  if (!benchmarkSet) return null;

  const userMetrics = computeUserMetrics(sessions);
  if (!userMetrics) return null;

  const metrics = [];
  let percentileSum = 0;
  let count = 0;

  for (const key of METRIC_KEYS) {
    const value = userMetrics[key];
    if (value === null || value === undefined) continue;

    const distribution = benchmarkSet[key];
    if (!distribution) continue;

    const percentile = calculatePercentile(value, distribution);
    const tier = getTier(percentile);

    metrics.push({ key, label: METRIC_LABELS[key], value, unit: METRIC_UNITS[key], percentile, tier });
    percentileSum += percentile;
    count++;
  }

  if (count === 0) return null;

  const overallPercentile = Math.round(percentileSum / count);
  return {
    metrics,
    overall: { percentile: overallPercentile, tier: getTier(overallPercentile) },
    ageGroup,
    skillLevel,
  };
}
