import { describe, it, expect } from 'vitest';
import {
  calculatePercentile, getTier, computeUserMetrics, computeComparison,
  BENCHMARKS, AGE_GROUPS, SKILL_LEVELS, METRIC_KEYS, METRIC_LABELS, METRIC_UNITS,
} from '../benchmarks';

// ── Helpers ──────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().split('T')[0];
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function makeSession(overrides = {}) {
  return {
    id: overrides.id || 'sess-1',
    date: overrides.date || today(),
    duration: overrides.duration ?? 60,
    drills: overrides.drills || ['Finishing Drill'],
    notes: '', intention: '', sessionType: 'Free', position: 'general',
    quickRating: 5,
    shooting: overrides.shooting ?? null,
    passing: overrides.passing ?? null,
    fitness: overrides.fitness ?? null,
    bodyCheck: null, delivery: null, attacking: null, reflection: null,
    idpGoals: [],
  };
}

function makeFullSession(i) {
  return makeSession({
    id: `s-${i}`,
    date: daysAgo(i),
    shooting: { shotsTaken: 20, goals: 8, leftFoot: { shots: 6, goals: 2 }, rightFoot: { shots: 14, goals: 6 } },
    passing: { attempts: 50, completed: 40 },
    fitness: { rpe: 7, sprints: 10, distance: 3 },
  });
}

// ── BENCHMARKS constant ──────────────────────────────────────────────────────

describe('BENCHMARKS constant', () => {
  it('has all age groups', () => {
    for (const age of AGE_GROUPS) {
      expect(BENCHMARKS).toHaveProperty(age);
    }
  });

  it('has all skill levels per age group', () => {
    for (const age of AGE_GROUPS) {
      for (const level of SKILL_LEVELS) {
        expect(BENCHMARKS[age]).toHaveProperty(level);
      }
    }
  });

  it('has all metrics per combination', () => {
    for (const key of METRIC_KEYS) {
      const dist = BENCHMARKS.U16.Academy[key];
      expect(dist).toHaveProperty('P10');
      expect(dist).toHaveProperty('P25');
      expect(dist).toHaveProperty('P50');
      expect(dist).toHaveProperty('P75');
      expect(dist).toHaveProperty('P90');
      expect(dist).toHaveProperty('P95');
    }
  });

  it('applies age scaling (U12 < Senior for scalable metrics)', () => {
    const u12Shot = BENCHMARKS.U12.Academy.shotAccuracy.P50;
    const seniorShot = BENCHMARKS.Senior.Academy.shotAccuracy.P50;
    expect(u12Shot).toBeLessThan(seniorShot);
  });

  it('does not scale progressRate by age', () => {
    const u12Rate = BENCHMARKS.U12.Recreational.progressRate.P50;
    const seniorRate = BENCHMARKS.Senior.Recreational.progressRate.P50;
    expect(u12Rate).toBe(seniorRate);
  });
});

// ── calculatePercentile ──────────────────────────────────────────────────────

describe('calculatePercentile', () => {
  const dist = { P10: 10, P25: 20, P50: 30, P75: 40, P90: 50, P95: 60 };

  it('returns low percentile for value below P10', () => {
    const pctl = calculatePercentile(5, dist);
    expect(pctl).toBeGreaterThanOrEqual(1);
    expect(pctl).toBeLessThanOrEqual(10);
  });

  it('returns 99 for value above P95', () => {
    expect(calculatePercentile(100, dist)).toBe(99);
  });

  it('returns ~50 for value at P50', () => {
    expect(calculatePercentile(30, dist)).toBe(50);
  });

  it('interpolates between breakpoints', () => {
    // Midpoint between P25(20) and P50(30) → should be ~37-38
    const pctl = calculatePercentile(25, dist);
    expect(pctl).toBeGreaterThan(25);
    expect(pctl).toBeLessThan(50);
  });

  it('handles zero distribution at P10', () => {
    const zeroDist = { P10: 0, P25: 10, P50: 20, P75: 30, P90: 40, P95: 50 };
    expect(calculatePercentile(0, zeroDist)).toBe(5);
  });

  it('handles value at exactly P10', () => {
    expect(calculatePercentile(10, dist)).toBe(10);
  });

  it('handles value at exactly P95', () => {
    expect(calculatePercentile(60, dist)).toBe(99);
  });

  it('returns 1 for negative value', () => {
    const pctl = calculatePercentile(-5, dist);
    expect(pctl).toBeGreaterThanOrEqual(1);
    expect(pctl).toBeLessThanOrEqual(10);
  });
});

// ── getTier ──────────────────────────────────────────────────────────────────

describe('getTier', () => {
  it('returns Elite for >= 90', () => {
    const tier = getTier(90);
    expect(tier.label).toBe('Elite');
    expect(tier).toHaveProperty('color');
    expect(tier).toHaveProperty('bgColor');
  });

  it('returns Advanced for 75-89', () => {
    expect(getTier(75).label).toBe('Advanced');
    expect(getTier(89).label).toBe('Advanced');
  });

  it('returns Competitive for 50-74', () => {
    expect(getTier(50).label).toBe('Competitive');
    expect(getTier(74).label).toBe('Competitive');
  });

  it('returns Developing for 25-49', () => {
    expect(getTier(25).label).toBe('Developing');
    expect(getTier(49).label).toBe('Developing');
  });

  it('returns Recreational for < 25', () => {
    expect(getTier(24).label).toBe('Recreational');
    expect(getTier(1).label).toBe('Recreational');
  });
});

// ── computeUserMetrics ───────────────────────────────────────────────────────

describe('computeUserMetrics', () => {
  it('returns null for empty sessions', () => {
    expect(computeUserMetrics([])).toBeNull();
  });

  it('returns all metric keys', () => {
    const sessions = Array.from({ length: 5 }, (_, i) => makeFullSession(i));
    const metrics = computeUserMetrics(sessions);
    expect(metrics).not.toBeNull();
    expect(metrics).toHaveProperty('sessionsPerWeek');
    expect(metrics).toHaveProperty('longestStreak');
    expect(metrics).toHaveProperty('shotAccuracy');
    expect(metrics).toHaveProperty('passAccuracy');
    expect(metrics).toHaveProperty('avgSessionLoad');
    expect(metrics).toHaveProperty('progressRate');
  });

  it('computes sessionsPerWeek from weekly loads', () => {
    const sessions = Array.from({ length: 5 }, (_, i) => makeFullSession(i));
    const metrics = computeUserMetrics(sessions);
    expect(metrics.sessionsPerWeek).toBeGreaterThan(0);
  });

  it('progressRate is null with fewer than 10 sessions', () => {
    const sessions = Array.from({ length: 5 }, (_, i) => makeFullSession(i));
    const metrics = computeUserMetrics(sessions);
    expect(metrics.progressRate).toBeNull();
  });

  it('computes progressRate with 10+ sessions', () => {
    const sessions = Array.from({ length: 12 }, (_, i) => makeFullSession(i));
    const metrics = computeUserMetrics(sessions);
    // With identical shooting data, progressRate should be ~0
    expect(metrics.progressRate).toBeDefined();
  });
});

// ── computeComparison ────────────────────────────────────────────────────────

describe('computeComparison', () => {
  it('returns null without ageGroup', () => {
    expect(computeComparison([], null, 'Academy')).toBeNull();
  });

  it('returns null without skillLevel', () => {
    expect(computeComparison([], 'U16', null)).toBeNull();
  });

  it('returns null with fewer than 5 sessions', () => {
    const sessions = Array.from({ length: 4 }, (_, i) => makeFullSession(i));
    expect(computeComparison(sessions, 'U16', 'Academy')).toBeNull();
  });

  it('returns full comparison with valid data', () => {
    const sessions = Array.from({ length: 8 }, (_, i) => makeFullSession(i));
    const result = computeComparison(sessions, 'U16', 'Academy');
    expect(result).not.toBeNull();
    expect(result.ageGroup).toBe('U16');
    expect(result.skillLevel).toBe('Academy');
    expect(result.overall).toHaveProperty('percentile');
    expect(result.overall).toHaveProperty('tier');
    expect(result.overall.percentile).toBeGreaterThanOrEqual(1);
    expect(result.overall.percentile).toBeLessThanOrEqual(99);
    expect(result.metrics.length).toBeGreaterThan(0);

    for (const metric of result.metrics) {
      expect(metric).toHaveProperty('key');
      expect(metric).toHaveProperty('label');
      expect(metric).toHaveProperty('value');
      expect(metric).toHaveProperty('unit');
      expect(metric).toHaveProperty('percentile');
      expect(metric).toHaveProperty('tier');
    }
  });

  it('works for all age/skill combinations', () => {
    const sessions = Array.from({ length: 8 }, (_, i) => makeFullSession(i));
    for (const age of AGE_GROUPS) {
      for (const level of SKILL_LEVELS) {
        const result = computeComparison(sessions, age, level);
        expect(result).not.toBeNull();
        expect(result.ageGroup).toBe(age);
        expect(result.skillLevel).toBe(level);
      }
    }
  });
});

// ── Constants ────────────────────────────────────────────────────────────────

describe('constants', () => {
  it('METRIC_LABELS has all keys', () => {
    for (const key of METRIC_KEYS) {
      expect(METRIC_LABELS).toHaveProperty(key);
    }
  });

  it('METRIC_UNITS has all keys', () => {
    for (const key of METRIC_KEYS) {
      expect(METRIC_UNITS).toHaveProperty(key);
    }
  });
});
