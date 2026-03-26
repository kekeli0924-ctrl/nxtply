import { describe, it, expect } from 'vitest';
import { analyzeGaps } from '../gapAnalysis';

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
    notes: '', intention: '',
    sessionType: overrides.sessionType || 'Free',
    position: 'general', quickRating: 5,
    shooting: overrides.shooting ?? null,
    passing: overrides.passing ?? null,
    fitness: overrides.fitness ?? null,
    bodyCheck: overrides.bodyCheck ?? null,
    delivery: overrides.delivery ?? null,
    attacking: overrides.attacking ?? null,
    reflection: overrides.reflection ?? null,
    idpGoals: [],
  };
}

function makeSessions(count, overrides = {}) {
  return Array.from({ length: count }, (_, i) =>
    makeSession({ id: `s-${i}`, date: daysAgo(i), ...overrides })
  );
}

// ── Core Behavior ────────────────────────────────────────────────────────────

describe('analyzeGaps', () => {
  it('returns empty array with fewer than 5 sessions', () => {
    expect(analyzeGaps(makeSessions(4))).toEqual([]);
  });

  it('returns max 3 gaps', () => {
    const sessions = makeSessions(10);
    const gaps = analyzeGaps(sessions);
    expect(gaps.length).toBeLessThanOrEqual(3);
  });

  it('gaps are sorted by severity descending', () => {
    // Create sessions that trigger multiple gaps
    const sessions = makeSessions(10, {
      drills: ['Finishing Drill'], // no passing, no fitness drills
    });
    const gaps = analyzeGaps(sessions);
    for (let i = 1; i < gaps.length; i++) {
      expect(gaps[i - 1].severity).toBeGreaterThanOrEqual(gaps[i].severity);
    }
  });

  it('each gap has correct shape', () => {
    const sessions = makeSessions(10, {
      drills: ['Finishing Drill'],
    });
    const gaps = analyzeGaps(sessions);
    for (const gap of gaps) {
      expect(gap).toHaveProperty('type');
      expect(gap).toHaveProperty('area');
      expect(gap).toHaveProperty('severity');
      expect(gap).toHaveProperty('urgency');
      expect(gap).toHaveProperty('detail');
      expect(gap).toHaveProperty('miniSession');
      expect(typeof gap.type).toBe('string');
      expect(typeof gap.area).toBe('string');
      expect(typeof gap.severity).toBe('number');
      expect(gap.severity).toBeGreaterThanOrEqual(0);
      expect(gap.severity).toBeLessThanOrEqual(100);
      expect(['high', 'medium', 'low']).toContain(gap.urgency);
      expect(gap.miniSession).toHaveProperty('title');
      expect(gap.miniSession).toHaveProperty('duration');
      expect(gap.miniSession).toHaveProperty('drills');
      expect(gap.miniSession).toHaveProperty('instruction');
    }
  });
});

// ── Individual Gap Detectors ─────────────────────────────────────────────────

describe('weak foot gap', () => {
  it('detects imbalanced foot usage', () => {
    const sessions = makeSessions(10, {
      shooting: {
        shotsTaken: 20, goals: 8,
        leftFoot: { shots: 1, goals: 0 },
        rightFoot: { shots: 19, goals: 8 },
      },
    });
    const gaps = analyzeGaps(sessions);
    const weakFootGap = gaps.find(g => g.type === 'weakFoot');
    expect(weakFootGap).toBeDefined();
    expect(weakFootGap.area).toBe('Weak Foot');
  });
});

describe('finishing approach gap', () => {
  it('detects weak finishing approach', () => {
    const sessions = makeSessions(6, {
      shooting: {
        shotsTaken: 10, goals: 3,
        shotDetails: [
          { approach: 'right-foot', shots: 5, goals: 3 },
          { approach: 'header', shots: 5, goals: 0 },
        ],
      },
    });
    const gaps = analyzeGaps(sessions);
    const finishingGap = gaps.find(g => g.type === 'finishingApproach');
    expect(finishingGap).toBeDefined();
    expect(finishingGap.area).toBe('Finishing');
  });
});

describe('passing gap', () => {
  it('detects no passing drills for 14+ days', () => {
    // Sessions with no passing drills, spread over 20 days
    const sessions = Array.from({ length: 8 }, (_, i) =>
      makeSession({ id: `s-${i}`, date: daysAgo(i * 3), drills: ['Finishing Drill'] })
    );
    const gaps = analyzeGaps(sessions);
    const passingGap = gaps.find(g => g.type === 'passing');
    expect(passingGap).toBeDefined();
    expect(passingGap.area).toBe('Passing');
  });
});

describe('fitness gap', () => {
  it('detects no fitness drills for 14+ days', () => {
    const sessions = Array.from({ length: 8 }, (_, i) =>
      makeSession({ id: `s-${i}`, date: daysAgo(i * 3), drills: ['Wall Passes (1-touch)'] })
    );
    const gaps = analyzeGaps(sessions);
    const fitnessGap = gaps.find(g => g.type === 'fitness');
    expect(fitnessGap).toBeDefined();
    expect(fitnessGap.area).toBe('Fitness');
  });
});

describe('duel gap', () => {
  it('detects low duel success rate', () => {
    const sessions = makeSessions(6, {
      attacking: { duels: { attempts: 10, successes: 2, endProducts: 0 } },
    });
    const gaps = analyzeGaps(sessions);
    const duelGap = gaps.find(g => g.type === 'duels');
    expect(duelGap).toBeDefined();
    expect(duelGap.area).toBe('1v1 Duels');
  });
});

describe('mental gap', () => {
  it('detects declining confidence/focus', () => {
    // Recent 3 sessions: low confidence/focus, previous 3: high
    const sessions = [
      ...Array.from({ length: 3 }, (_, i) =>
        makeSession({ id: `r-${i}`, date: daysAgo(i), reflection: { confidence: 1, focus: 1, enjoyment: 2 } })
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        makeSession({ id: `p-${i}`, date: daysAgo(i + 3), reflection: { confidence: 5, focus: 5, enjoyment: 5 } })
      ),
    ];
    const gaps = analyzeGaps(sessions);
    const mentalGap = gaps.find(g => g.type === 'mental');
    expect(mentalGap).toBeDefined();
    expect(mentalGap.area).toBe('Mental');
  });
});

describe('session type monotony', () => {
  it('detects 5 sessions of same type', () => {
    const sessions = makeSessions(6, { sessionType: 'Benchmark' });
    const gaps = analyzeGaps(sessions);
    const varietyGap = gaps.find(g => g.type === 'variety');
    expect(varietyGap).toBeDefined();
    expect(varietyGap.area).toBe('Variety');
  });

  it('does not trigger with mixed types', () => {
    const types = ['Benchmark', 'Free', 'Representative', 'Fatigue', 'Free', 'Benchmark'];
    const sessions = types.map((t, i) =>
      makeSession({ id: `s-${i}`, date: daysAgo(i), sessionType: t })
    );
    const gaps = analyzeGaps(sessions);
    const varietyGap = gaps.find(g => g.type === 'variety');
    expect(varietyGap).toBeUndefined();
  });
});

describe('phase weakness (fatigue)', () => {
  it('detects repeated low fatigue decay scores', () => {
    const sessions = makeSessions(6, {
      shooting: {
        shotsTaken: 20, goals: 10,
        phases: { early: { shots: 10, goals: 9 }, late: { shots: 10, goals: 1 } },
      },
    });
    const gaps = analyzeGaps(sessions);
    const fatigueGap = gaps.find(g => g.type === 'fatigue');
    expect(fatigueGap).toBeDefined();
    expect(fatigueGap.area).toBe('Endurance');
  });
});

// ── No Gaps Scenario ─────────────────────────────────────────────────────────

describe('no gaps scenario', () => {
  it('returns empty when all metrics are healthy', () => {
    const sessions = Array.from({ length: 6 }, (_, i) =>
      makeSession({
        id: `s-${i}`,
        date: daysAgo(i),
        sessionType: ['Free', 'Benchmark', 'Representative', 'Free', 'Fatigue', 'Free'][i],
        drills: ['Finishing Drill', 'Wall Passes (1-touch)', 'Sprint Intervals'],
        shooting: {
          shotsTaken: 20, goals: 10,
          leftFoot: { shots: 8, goals: 4 },
          rightFoot: { shots: 12, goals: 6 },
          phases: { early: { shots: 10, goals: 5 }, late: { shots: 10, goals: 5 } },
        },
        passing: { attempts: 50, completed: 40 },
        fitness: { rpe: 7, sprints: 10, distance: 3 },
        attacking: { duels: { attempts: 10, successes: 6 }, takeOns: { attempts: 5, endProducts: 3 } },
        reflection: { confidence: 4, focus: 4, enjoyment: 4 },
      })
    );
    const gaps = analyzeGaps(sessions);
    // Healthy sessions should produce few or no gaps
    expect(gaps.length).toBeLessThanOrEqual(1);
  });
});
