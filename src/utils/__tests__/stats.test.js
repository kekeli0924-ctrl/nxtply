import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calcPercentage, formatPercentage, hasShootingDrill, hasPassingDrill, hasFitnessDrill,
  drillHasCategory, getShotPercentage, getPassPercentage, getStreak, getAverageStat,
  getSessionLoad, getWeeklyLoads, getCurrentWeekSessionCount, computeTrainingScore,
  computeFourPillars, computePersonalRecords, detectNewPRs, generateInsights,
  formatDate, formatDateShort, getWeakFootStats, computeFatigueDecay, diagnoseFatigue,
  getAverageFatigueScore, getMatchStats, getPhaseStats, computeLSPTScore, computeLSSTScore,
  getBenchmarkLevel, LSPT_NORMS, LSST_NORMS, getFOETrend, getZoneHeatmapData,
  getMentalTrendData, getDuelSuccessRate, getTakeOnEndProductRate, getWeakestApproach,
  getDeliveryAccuracy, getGoodDecisionPct, getDeadlineBadge, getBodyCheckCorrelation,
  getSessionXGStats, getWeeklyReport, SESSION_TYPES, PR_LABELS,
  PRESET_DRILLS, SHOOTING_DRILLS, PASSING_DRILLS, FITNESS_DRILLS,
} from '../stats';

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
    notes: overrides.notes || '',
    intention: overrides.intention || '',
    sessionType: overrides.sessionType || 'Free',
    position: overrides.position || 'general',
    quickRating: overrides.quickRating ?? 5,
    shooting: overrides.shooting ?? null,
    passing: overrides.passing ?? null,
    fitness: overrides.fitness ?? null,
    bodyCheck: overrides.bodyCheck ?? null,
    delivery: overrides.delivery ?? null,
    attacking: overrides.attacking ?? null,
    reflection: overrides.reflection ?? null,
    idpGoals: overrides.idpGoals || [],
  };
}

function makeSessionWithStats(overrides = {}) {
  return makeSession({
    shooting: { shotsTaken: 20, goals: 8, xG: 5 },
    passing: { attempts: 50, completed: 40 },
    fitness: { rpe: 7, sprints: 10, distance: 3 },
    reflection: { confidence: 4, focus: 4, enjoyment: 4 },
    ...overrides,
  });
}

// ── Basic Math ───────────────────────────────────────────────────────────────

describe('calcPercentage', () => {
  it('returns null when denominator is 0', () => {
    expect(calcPercentage(5, 0)).toBeNull();
  });
  it('returns null when denominator is falsy', () => {
    expect(calcPercentage(5, null)).toBeNull();
    expect(calcPercentage(5, undefined)).toBeNull();
  });
  it('calculates correct percentage', () => {
    expect(calcPercentage(3, 10)).toBe(30);
    expect(calcPercentage(1, 3)).toBe(33);
    expect(calcPercentage(10, 10)).toBe(100);
  });
  it('returns 0 for zero numerator', () => {
    expect(calcPercentage(0, 10)).toBe(0);
  });
});

describe('formatPercentage', () => {
  it('returns dash when no data', () => {
    expect(formatPercentage(0, 0)).toBe('\u2014');
  });
  it('returns formatted percentage', () => {
    expect(formatPercentage(7, 10)).toBe('70%');
  });
});

// ── Drill Classification ─────────────────────────────────────────────────────

describe('drill classification', () => {
  it('hasShootingDrill detects shooting drills', () => {
    expect(hasShootingDrill(['Finishing Drill'])).toBe(true);
    expect(hasShootingDrill(['Free Kicks'])).toBe(true);
    expect(hasShootingDrill(['Rondo'])).toBe(false);
    expect(hasShootingDrill([])).toBe(false);
  });

  it('hasPassingDrill detects passing drills', () => {
    expect(hasPassingDrill(['Wall Passes (1-touch)'])).toBe(true);
    expect(hasPassingDrill(['Rondo'])).toBe(true);
    expect(hasPassingDrill(['Finishing Drill'])).toBe(false);
  });

  it('hasFitnessDrill detects fitness drills', () => {
    expect(hasFitnessDrill(['Sprint Intervals'])).toBe(true);
    expect(hasFitnessDrill(['Dribbling Circuit'])).toBe(true);
    expect(hasFitnessDrill(['Rondo'])).toBe(false);
  });

  it('drillHasCategory works for all categories', () => {
    expect(drillHasCategory('Finishing Drill', 'shooting')).toBe(true);
    expect(drillHasCategory('Rondo', 'passing')).toBe(true);
    expect(drillHasCategory('Sprint Intervals', 'fitness')).toBe(true);
    expect(drillHasCategory('Sprint Intervals', 'unknown')).toBe(false);
  });
});

// ── Session Stats ────────────────────────────────────────────────────────────

describe('getShotPercentage', () => {
  it('returns null without shooting data', () => {
    expect(getShotPercentage(makeSession())).toBeNull();
  });
  it('returns null when shotsTaken is 0', () => {
    expect(getShotPercentage(makeSession({ shooting: { shotsTaken: 0, goals: 0 } }))).toBeNull();
  });
  it('calculates shot percentage', () => {
    expect(getShotPercentage(makeSession({ shooting: { shotsTaken: 10, goals: 4 } }))).toBe(40);
  });
});

describe('getPassPercentage', () => {
  it('returns null without passing data', () => {
    expect(getPassPercentage(makeSession())).toBeNull();
  });
  it('calculates pass percentage', () => {
    expect(getPassPercentage(makeSession({ passing: { attempts: 20, completed: 16 } }))).toBe(80);
  });
});

describe('getSessionLoad', () => {
  it('returns null without RPE or duration', () => {
    expect(getSessionLoad(makeSession({ fitness: null, duration: 60 }))).toBeNull();
    expect(getSessionLoad(makeSession({ fitness: { rpe: 7 }, duration: 0 }))).toBeNull();
  });
  it('calculates RPE × duration', () => {
    expect(getSessionLoad(makeSession({ fitness: { rpe: 7 }, duration: 60 }))).toBe(420);
  });
});

// ── Streak ───────────────────────────────────────────────────────────────────

describe('getStreak', () => {
  it('returns 0 for empty sessions', () => {
    expect(getStreak([])).toBe(0);
  });
  it('returns 1 for session today', () => {
    expect(getStreak([makeSession({ date: today() })])).toBe(1);
  });
  it('returns 1 for session yesterday', () => {
    expect(getStreak([makeSession({ date: daysAgo(1) })])).toBe(1);
  });
  it('returns 0 if last session was 2+ days ago', () => {
    expect(getStreak([makeSession({ date: daysAgo(3) })])).toBe(0);
  });
  it('counts consecutive days', () => {
    const sessions = [
      makeSession({ id: '1', date: today() }),
      makeSession({ id: '2', date: daysAgo(1) }),
      makeSession({ id: '3', date: daysAgo(2) }),
    ];
    expect(getStreak(sessions)).toBe(3);
  });
  it('stops at gap', () => {
    const sessions = [
      makeSession({ id: '1', date: today() }),
      makeSession({ id: '2', date: daysAgo(1) }),
      // gap at daysAgo(2)
      makeSession({ id: '3', date: daysAgo(3) }),
    ];
    expect(getStreak(sessions)).toBe(2);
  });
});

// ── Averages ─────────────────────────────────────────────────────────────────

describe('getAverageStat', () => {
  it('returns null for empty sessions', () => {
    expect(getAverageStat([], getShotPercentage)).toBeNull();
  });
  it('returns null when all values are null', () => {
    expect(getAverageStat([makeSession(), makeSession()], getShotPercentage)).toBeNull();
  });
  it('calculates average of last N', () => {
    const sessions = [
      makeSession({ id: '1', date: daysAgo(0), shooting: { shotsTaken: 10, goals: 5 } }),
      makeSession({ id: '2', date: daysAgo(1), shooting: { shotsTaken: 10, goals: 3 } }),
      makeSession({ id: '3', date: daysAgo(2), shooting: { shotsTaken: 10, goals: 1 } }),
    ];
    // Last 2: 50% and 30% → avg 40%
    expect(getAverageStat(sessions, getShotPercentage, 2)).toBe(40);
  });
});

// ── Date Formatting ──────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('formats a date string', () => {
    const result = formatDate('2026-03-10');
    expect(result).toContain('Mar');
    expect(result).toContain('10');
    expect(result).toContain('2026');
  });
});

describe('formatDateShort', () => {
  it('formats a short date string', () => {
    const result = formatDateShort('2026-03-10');
    expect(result).toContain('Mar');
    expect(result).toContain('10');
  });
});

// ── Weak Foot ────────────────────────────────────────────────────────────────

describe('getWeakFootStats', () => {
  it('returns zero totals for sessions without foot data', () => {
    const stats = getWeakFootStats([makeSession()]);
    expect(stats.totalShots).toBe(0);
    expect(stats.leftRatio).toBeNull();
  });

  it('calculates foot ratios', () => {
    const sessions = [
      makeSession({ shooting: { shotsTaken: 10, goals: 5, leftFoot: { shots: 3, goals: 1 }, rightFoot: { shots: 7, goals: 4 } } }),
    ];
    const stats = getWeakFootStats(sessions);
    expect(stats.totalShots).toBe(10);
    expect(stats.leftRatio).toBe(30);
    expect(stats.rightRatio).toBe(70);
    expect(stats.leftAccuracy).toBe(33);
    expect(stats.rightAccuracy).toBe(57);
  });
});

// ── Fatigue / Phase Analysis ─────────────────────────────────────────────────

describe('getPhaseStats', () => {
  it('returns null phases for session without phase data', () => {
    const stats = getPhaseStats(makeSession());
    expect(stats.shooting).toBeNull();
    expect(stats.passing).toBeNull();
    expect(stats.fitness).toBeNull();
  });

  it('computes shooting phase stats', () => {
    const session = makeSession({
      shooting: {
        shotsTaken: 20, goals: 10,
        phases: { early: { shots: 10, goals: 7 }, late: { shots: 10, goals: 3 } },
      },
    });
    const stats = getPhaseStats(session);
    expect(stats.shooting.early).toBe(70);
    expect(stats.shooting.late).toBe(30);
  });
});

describe('computeFatigueDecay', () => {
  it('returns null for session without phase data', () => {
    expect(computeFatigueDecay(makeSession())).toBeNull();
  });

  it('returns score for session with phases', () => {
    const session = makeSession({
      shooting: {
        shotsTaken: 20, goals: 10,
        phases: { early: { shots: 10, goals: 8 }, late: { shots: 10, goals: 4 } },
      },
    });
    const decay = computeFatigueDecay(session);
    expect(decay).not.toBeNull();
    expect(decay.hasData).toBe(true);
    expect(decay.score).toBeGreaterThan(0);
    expect(decay.score).toBeLessThanOrEqual(100);
  });

  it('returns 100 when late equals early', () => {
    const session = makeSession({
      shooting: {
        shotsTaken: 20, goals: 10,
        phases: { early: { shots: 10, goals: 5 }, late: { shots: 10, goals: 5 } },
      },
    });
    const decay = computeFatigueDecay(session);
    expect(decay.score).toBe(100);
  });
});

describe('diagnoseFatigue', () => {
  it('returns null for session without phase data', () => {
    expect(diagnoseFatigue(makeSession())).toBeNull();
  });

  it('returns strong endurance for high score', () => {
    const session = makeSession({
      shooting: {
        shotsTaken: 20, goals: 10,
        phases: { early: { shots: 10, goals: 5 }, late: { shots: 10, goals: 5 } },
      },
    });
    const diagnosis = diagnoseFatigue(session);
    expect(diagnosis.category).toBe('strong');
  });

  it('detects recovery issues with poor bodyCheck', () => {
    const session = makeSession({
      bodyCheck: { sleepHours: 4, energy: 1, soreness: 5 },
      shooting: {
        shotsTaken: 20, goals: 10,
        phases: { early: { shots: 10, goals: 8 }, late: { shots: 10, goals: 2 } },
      },
    });
    const diagnosis = diagnoseFatigue(session);
    expect(diagnosis.category).toBe('recovery');
  });
});

describe('getAverageFatigueScore', () => {
  it('returns null when no sessions have phase data', () => {
    expect(getAverageFatigueScore([makeSession()])).toBeNull();
  });
});

// ── Training Score ───────────────────────────────────────────────────────────

describe('computeTrainingScore', () => {
  it('returns null with fewer than 3 sessions', () => {
    expect(computeTrainingScore([makeSession(), makeSession({ id: '2' })])).toBeNull();
  });

  it('returns score and breakdown with enough sessions', () => {
    const sessions = Array.from({ length: 5 }, (_, i) =>
      makeSessionWithStats({ id: `s-${i}`, date: daysAgo(i) })
    );
    const result = computeTrainingScore(sessions);
    expect(result).not.toBeNull();
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.breakdown).toHaveProperty('consistency');
    expect(result.breakdown).toHaveProperty('shooting');
    expect(result.breakdown).toHaveProperty('passing');
    expect(result.breakdown).toHaveProperty('physical');
    expect(result.breakdown).toHaveProperty('endurance');
    expect(result.breakdown).toHaveProperty('mental');
  });
});

// ── Four Pillars ─────────────────────────────────────────────────────────────

describe('computeFourPillars', () => {
  it('returns null with fewer than 5 sessions', () => {
    const sessions = Array.from({ length: 4 }, (_, i) => makeSession({ id: `s-${i}` }));
    expect(computeFourPillars(sessions)).toBeNull();
  });

  it('returns 4 pillars with enough sessions', () => {
    const sessions = Array.from({ length: 7 }, (_, i) =>
      makeSessionWithStats({ id: `s-${i}`, date: daysAgo(i) })
    );
    const result = computeFourPillars(sessions);
    expect(result).toHaveLength(4);
    expect(result.map(p => p.pillar)).toEqual(['Technique', 'Tactics', 'Fitness', 'Mentality']);
    result.forEach(p => {
      expect(p.score).toBeGreaterThanOrEqual(0);
      expect(p.score).toBeLessThanOrEqual(100);
      expect(p.fullMark).toBe(100);
    });
  });
});

// ── Personal Records ─────────────────────────────────────────────────────────

describe('computePersonalRecords', () => {
  it('returns null records for empty sessions', () => {
    const records = computePersonalRecords([]);
    expect(records.bestShotPct).toBeNull();
    expect(records.mostGoals).toBeNull();
  });

  it('finds best shot percentage', () => {
    const sessions = [
      makeSession({ id: '1', shooting: { shotsTaken: 10, goals: 3 } }),
      makeSession({ id: '2', shooting: { shotsTaken: 10, goals: 7 } }),
    ];
    const records = computePersonalRecords(sessions);
    expect(records.bestShotPct.value).toBe(70);
  });

  it('finds longest duration', () => {
    const sessions = [
      makeSession({ id: '1', duration: 45 }),
      makeSession({ id: '2', duration: 90 }),
    ];
    const records = computePersonalRecords(sessions);
    expect(records.longestDuration.value).toBe(90);
  });
});

describe('detectNewPRs', () => {
  it('returns empty if no old records', () => {
    expect(detectNewPRs(null, { bestShotPct: { value: 50 } })).toEqual([]);
  });

  it('detects new PR', () => {
    const old = { bestShotPct: { value: 50 }, bestPassPct: { value: 60 } };
    const cur = { bestShotPct: { value: 70 }, bestPassPct: { value: 60 } };
    const prs = detectNewPRs(old, cur);
    expect(prs).toContain('bestShotPct');
    expect(prs).not.toContain('bestPassPct');
  });
});

// ── Insights ─────────────────────────────────────────────────────────────────

describe('generateInsights', () => {
  it('returns empty for < 5 sessions', () => {
    const sessions = Array.from({ length: 4 }, (_, i) => makeSession({ id: `s-${i}` }));
    expect(generateInsights(sessions, [], null)).toEqual([]);
  });

  it('returns max 3 insights', () => {
    const sessions = Array.from({ length: 12 }, (_, i) =>
      makeSessionWithStats({ id: `s-${i}`, date: daysAgo(i) })
    );
    const insights = generateInsights(sessions, [], null);
    expect(insights.length).toBeLessThanOrEqual(3);
    insights.forEach(insight => {
      expect(insight).toHaveProperty('text');
      expect(insight).toHaveProperty('icon');
    });
  });
});

// ── Match Stats ──────────────────────────────────────────────────────────────

describe('getMatchStats', () => {
  it('returns null for empty matches', () => {
    expect(getMatchStats([])).toBeNull();
  });

  it('computes match statistics', () => {
    const matches = [
      { result: 'W', goals: 2, assists: 1, rating: 8 },
      { result: 'D', goals: 0, assists: 0, rating: 6 },
      { result: 'L', goals: 1, assists: 0, rating: 5 },
    ];
    const stats = getMatchStats(matches);
    expect(stats.total).toBe(3);
    expect(stats.wins).toBe(1);
    expect(stats.draws).toBe(1);
    expect(stats.losses).toBe(1);
    expect(stats.totalGoals).toBe(3);
    expect(stats.totalAssists).toBe(1);
    expect(stats.winRate).toBe(33);
  });
});

// ── Benchmark Scoring ────────────────────────────────────────────────────────

describe('computeLSPTScore', () => {
  it('returns 0 for invalid time', () => {
    expect(computeLSPTScore(0, 10, 0)).toBe(0);
    expect(computeLSPTScore(-5, 10, 0)).toBe(0);
  });

  it('computes score from time, completed, errors', () => {
    const score = computeLSPTScore(60, 10, 2);
    // timeScore = (60/60)*50 = 50, completionBonus = 20, errorPenalty = 10 → 60
    expect(score).toBe(60);
  });

  it('floors at 0', () => {
    expect(computeLSPTScore(300, 0, 20)).toBe(0);
  });
});

describe('computeLSSTScore', () => {
  it('returns 0 for no shots', () => {
    expect(computeLSSTScore({}, 0, 0)).toBe(0);
  });

  it('computes zone-weighted score', () => {
    const zones = { 'left-far': { goals: 2 }, 'right-near': { goals: 3 } };
    const score = computeLSSTScore(zones, 10, 5);
    // weightedPoints = 2*4 + 3*2 = 14, accuracyBonus = round(50*0.3) = 15 → 29
    expect(score).toBe(29);
  });
});

describe('getBenchmarkLevel', () => {
  it('classifies levels correctly', () => {
    expect(getBenchmarkLevel(95, LSPT_NORMS)).toBe('Elite');
    expect(getBenchmarkLevel(75, LSPT_NORMS)).toBe('Advanced');
    expect(getBenchmarkLevel(55, LSPT_NORMS)).toBe('Intermediate');
    expect(getBenchmarkLevel(30, LSPT_NORMS)).toBe('Beginner');
  });
});

// ── FOE / Zone / Mental / Delivery / Duel / TakeOn ──────────────────────────

describe('getFOETrend', () => {
  it('returns empty for sessions without xG', () => {
    expect(getFOETrend([makeSession()])).toEqual([]);
  });

  it('computes FOE values', () => {
    const sessions = [
      makeSession({ date: '2026-03-01', shooting: { shotsTaken: 10, goals: 5, xG: 3 } }),
    ];
    const trend = getFOETrend(sessions);
    expect(trend).toHaveLength(1);
    expect(trend[0].foe).toBe(2);
  });
});

describe('getZoneHeatmapData', () => {
  it('returns null without zone data', () => {
    expect(getZoneHeatmapData(makeSession())).toBeNull();
  });

  it('returns zone data', () => {
    const session = makeSession({
      shooting: { shotsTaken: 5, goals: 2, zones: { 'top-left': { shots: 3, goals: 1 } } },
    });
    const data = getZoneHeatmapData(session);
    expect(data['top-left'].shots).toBe(3);
  });
});

describe('getMentalTrendData', () => {
  it('filters sessions without reflection', () => {
    expect(getMentalTrendData([makeSession()])).toEqual([]);
  });

  it('returns mental data', () => {
    const sessions = [
      makeSession({ date: '2026-03-01', reflection: { confidence: 4, focus: 3, enjoyment: 5 } }),
    ];
    const data = getMentalTrendData(sessions);
    expect(data).toHaveLength(1);
    expect(data[0].confidence).toBe(4);
  });
});

describe('getDuelSuccessRate', () => {
  it('returns null without duel data', () => {
    expect(getDuelSuccessRate(makeSession())).toBeNull();
  });

  it('calculates rate', () => {
    const session = makeSession({ attacking: { duels: { attempts: 10, successes: 4 } } });
    expect(getDuelSuccessRate(session)).toBe(40);
  });
});

describe('getTakeOnEndProductRate', () => {
  it('returns null without take-on data', () => {
    expect(getTakeOnEndProductRate(makeSession())).toBeNull();
  });

  it('calculates rate', () => {
    const session = makeSession({ attacking: { takeOns: { attempts: 5, endProducts: 2 } } });
    expect(getTakeOnEndProductRate(session)).toBe(40);
  });
});

describe('getDeliveryAccuracy', () => {
  it('returns empty for sessions without deliveries', () => {
    expect(getDeliveryAccuracy([makeSession()])).toEqual([]);
  });

  it('computes accuracy by type', () => {
    const sessions = [
      makeSession({
        delivery: {
          entries: [
            { type: 'cross', quality: 'perfect' },
            { type: 'cross', quality: 'usable' },
            { type: 'cross', quality: 'failed' },
          ],
        },
      }),
    ];
    const acc = getDeliveryAccuracy(sessions);
    expect(acc).toHaveLength(1);
    expect(acc[0].type).toBe('cross');
    expect(acc[0].accuracy).toBe(67);
  });
});

describe('getWeakestApproach', () => {
  it('returns null without shot details', () => {
    expect(getWeakestApproach([makeSession()])).toBeNull();
  });

  it('finds weakest approach', () => {
    const sessions = [
      makeSession({
        shooting: {
          shotsTaken: 10, goals: 5,
          shotDetails: [
            { approach: 'right-foot', shots: 5, goals: 4 },
            { approach: 'left-foot', shots: 5, goals: 0 },
          ],
        },
      }),
    ];
    const weakest = getWeakestApproach(sessions);
    expect(weakest.approach).toBe('left-foot');
    expect(weakest.pct).toBe(0);
  });
});

// ── Good Decision Pct ────────────────────────────────────────────────────────

describe('getGoodDecisionPct', () => {
  it('returns null for empty journal', () => {
    expect(getGoodDecisionPct([])).toBeNull();
  });

  it('calculates percentage', () => {
    const journal = [
      { decisions: [{ rightDecision: true }, { rightDecision: false }, { rightDecision: true }] },
    ];
    expect(getGoodDecisionPct(journal)).toBe(67);
  });
});

// ── Deadline Badge ───────────────────────────────────────────────────────────

describe('getDeadlineBadge', () => {
  it('returns null for no target date', () => {
    expect(getDeadlineBadge(null)).toBeNull();
  });

  it('returns overdue for past dates', () => {
    const badge = getDeadlineBadge('2020-01-01');
    expect(badge.label).toBe('Overdue');
    expect(badge.color).toBe('red');
  });
});

// ── Body Check ───────────────────────────────────────────────────────────────

describe('getBodyCheckCorrelation', () => {
  it('groups performance by bodyCheck field', () => {
    const sessions = [
      makeSession({ bodyCheck: { energy: 5 }, shooting: { shotsTaken: 10, goals: 8 } }),
      makeSession({ id: '2', bodyCheck: { energy: 2 }, shooting: { shotsTaken: 10, goals: 3 } }),
    ];
    const corr = getBodyCheckCorrelation(sessions, 'energy', getShotPercentage);
    expect(corr[5]).toBe(80);
    expect(corr[2]).toBe(30);
  });
});

// ── Session XG Stats ─────────────────────────────────────────────────────────

describe('getSessionXGStats', () => {
  it('returns null without shooting data', () => {
    expect(getSessionXGStats(makeSession())).toBeNull();
  });

  it('computes FOE', () => {
    const session = makeSession({ shooting: { shotsTaken: 10, goals: 5, xG: 3 } });
    const stats = getSessionXGStats(session);
    expect(stats.foe).toBe(2);
    expect(stats.xG).toBe(3);
    expect(stats.goals).toBe(5);
  });
});

// ── Constants ────────────────────────────────────────────────────────────────

describe('constants', () => {
  it('exports SESSION_TYPES', () => {
    expect(SESSION_TYPES).toContain('Free');
    expect(SESSION_TYPES).toContain('Benchmark');
  });

  it('exports PR_LABELS', () => {
    expect(PR_LABELS).toHaveProperty('bestShotPct');
    expect(PR_LABELS).toHaveProperty('longestStreak');
  });

  it('exports drill lists', () => {
    expect(PRESET_DRILLS.length).toBeGreaterThan(0);
    expect(SHOOTING_DRILLS.length).toBeGreaterThan(0);
    expect(PASSING_DRILLS.length).toBeGreaterThan(0);
    expect(FITNESS_DRILLS.length).toBeGreaterThan(0);
  });
});
