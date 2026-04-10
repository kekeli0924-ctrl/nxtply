export const PRESET_DRILLS = [
  'Wall Passes (1-touch)',
  'Wall Passes (2-touch)',
  'Finishing Drill',
  'Shooting (Inside Box)',
  'Shooting (Outside Box)',
  'Long Passing',
  'Short Passing Combos',
  'Crossing & Finishing',
  'Free Kicks',
  'Rondo',
  'Dribbling Circuit',
  'Sprint Intervals',
];

export const SHOOTING_DRILLS = [
  'Finishing Drill',
  'Shooting (Inside Box)',
  'Shooting (Outside Box)',
  'Crossing & Finishing',
  'Free Kicks',
];

export const PASSING_DRILLS = [
  'Wall Passes (1-touch)',
  'Wall Passes (2-touch)',
  'Long Passing',
  'Short Passing Combos',
  'Rondo',
];

export const FITNESS_DRILLS = [
  'Sprint Intervals',
  'Dribbling Circuit',
];

export function calcPercentage(numerator, denominator) {
  if (!denominator || denominator === 0) return null;
  return Math.round((numerator / denominator) * 100);
}

export function formatPercentage(numerator, denominator) {
  const pct = calcPercentage(numerator, denominator);
  return pct !== null ? `${pct}%` : '\u2014';
}

export function hasShootingDrill(drills) {
  return drills.some(d => SHOOTING_DRILLS.includes(d));
}

export function hasPassingDrill(drills) {
  return drills.some(d => PASSING_DRILLS.includes(d));
}

export function hasFitnessDrill(drills) {
  return drills.some(d => FITNESS_DRILLS.includes(d));
}

export function getStreak(sessions) {
  if (!sessions.length) return 0;

  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let streak = 0;
  let checkDate = new Date(today);

  // Check if the most recent session is today or yesterday
  const mostRecent = new Date(sorted[0].date + 'T00:00:00');
  const diffFromToday = Math.floor((today - mostRecent) / (1000 * 60 * 60 * 24));
  if (diffFromToday > 1) return 0;

  // Start from today if there's a session today, otherwise start from yesterday
  if (diffFromToday === 1) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  const sessionDates = new Set(sorted.map(s => s.date));

  while (true) {
    const dateStr = checkDate.toISOString().split('T')[0];
    if (sessionDates.has(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

export function getAverageStat(sessions, statFn, lastN) {
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  const subset = lastN ? sorted.slice(0, lastN) : sorted;
  const values = subset.map(statFn).filter(v => v !== null);
  if (!values.length) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export function getShotPercentage(session) {
  if (!session.shooting || !session.shooting.shotsTaken) return null;
  return calcPercentage(session.shooting.goals, session.shooting.shotsTaken);
}

export function getPassPercentage(session) {
  if (!session.passing || !session.passing.attempts) return null;
  return calcPercentage(session.passing.completed, session.passing.attempts);
}

export function drillHasCategory(drill, category) {
  if (category === 'shooting') return SHOOTING_DRILLS.includes(drill);
  if (category === 'passing') return PASSING_DRILLS.includes(drill);
  if (category === 'fitness') return FITNESS_DRILLS.includes(drill);
  return false;
}

export function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateShort(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// === Weak Foot Stats ===
export function getWeakFootStats(sessions) {
  let left = { shots: 0, goals: 0 };
  let right = { shots: 0, goals: 0 };
  for (const s of sessions) {
    if (s.shooting?.leftFoot) {
      left.shots += s.shooting.leftFoot.shots;
      left.goals += s.shooting.leftFoot.goals;
    }
    if (s.shooting?.rightFoot) {
      right.shots += s.shooting.rightFoot.shots;
      right.goals += s.shooting.rightFoot.goals;
    }
  }
  const totalShots = left.shots + right.shots;
  return {
    left, right, totalShots,
    leftRatio: totalShots ? Math.round((left.shots / totalShots) * 100) : null,
    rightRatio: totalShots ? Math.round((right.shots / totalShots) * 100) : null,
    leftAccuracy: left.shots ? Math.round((left.goals / left.shots) * 100) : null,
    rightAccuracy: right.shots ? Math.round((right.goals / right.shots) * 100) : null,
  };
}

// === AI Session Insights (Coach's Notes) ===
export function generateInsights(sessions, matches, personalRecords) {
  if (sessions.length < 5) return [];

  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  const insights = [];

  // 1. Shooting trend — compare last 5 vs previous 5
  (() => {
    if (sorted.length < 10) return;
    const recent5 = sorted.slice(0, 5);
    const prev5 = sorted.slice(5, 10);
    const recentAvg = getAverageStat(recent5, getShotPercentage);
    const prevAvg = getAverageStat(prev5, getShotPercentage);
    if (recentAvg === null || prevAvg === null) return;
    const diff = recentAvg - prevAvg;
    if (diff >= 5) {
      insights.push({ text: `Your shooting accuracy improved by ${diff}% over your last 5 sessions compared to the previous 5. Keep it up.`, icon: 'up' });
    } else if (diff <= -5) {
      insights.push({ text: `Your shot accuracy dropped ${Math.abs(diff)}% recently. Consider adding focused finishing drills to your next session.`, icon: 'down' });
    }
  })();

  // 2. Fatigue pattern — check last 5 sessions for accumulated fatigue
  (() => {
    const last5 = sorted.slice(0, 5);
    const fatigued = last5.filter(s => {
      const decay = computeFatigueDecay(s);
      return decay && decay.score < 70;
    });
    if (fatigued.length >= 3) {
      insights.push({ text: `You're showing signs of accumulated fatigue — ${fatigued.length} of your last 5 sessions had below-average late-phase performance. Consider a recovery day.`, icon: 'warn' });
    }
  })();

  // 3. Recovery correlation — sleep < 7h vs >= 7h
  (() => {
    const withSleep = sorted.filter(s => s.bodyCheck?.sleepHours);
    if (withSleep.length < 6) return;
    const lowSleep = withSleep.filter(s => s.bodyCheck.sleepHours < 7);
    const highSleep = withSleep.filter(s => s.bodyCheck.sleepHours >= 7);
    if (lowSleep.length < 2 || highSleep.length < 2) return;
    const lowAvg = getAverageStat(lowSleep, getShotPercentage);
    const highAvg = getAverageStat(highSleep, getShotPercentage);
    if (lowAvg === null || highAvg === null) return;
    const diff = highAvg - lowAvg;
    if (diff >= 8) {
      insights.push({ text: `Sessions after 7+ hours of sleep show ${diff}% higher shot accuracy. Prioritize sleep before big training days.`, icon: 'info' });
    }
  })();

  // 4. Consistency — training frequency this week
  (() => {
    const weekCount = getCurrentWeekSessionCount(sessions);
    const streak = getStreak(sessions);
    if (streak >= 3) {
      insights.push({ text: `Great consistency — you're on a ${streak}-day training streak. Consistency is the #1 predictor of improvement.`, icon: 'up' });
    } else if (weekCount === 0 && sorted.length > 0) {
      const lastDate = sorted[0].date;
      const daysSince = Math.floor((Date.now() - new Date(lastDate + 'T00:00:00').getTime()) / 86400000);
      if (daysSince >= 3) {
        insights.push({ text: `It's been ${daysSince} days since your last session. Even a quick 30-minute session keeps momentum going.`, icon: 'info' });
      }
    }
  })();

  // 5. Late-phase shooting drop
  (() => {
    const withPhases = sorted.slice(0, 5).filter(s => {
      const p = s.shooting?.phases;
      return p?.early?.shots > 0 && (p?.late?.shots > 0 || p?.mid?.shots > 0);
    });
    if (withPhases.length < 3) return;
    const drops = withPhases.map(s => {
      const p = s.shooting.phases;
      const earlyPct = calcPercentage(p.early.goals, p.early.shots);
      const latePct = calcPercentage((p.late?.goals ?? p.mid?.goals), (p.late?.shots ?? p.mid?.shots));
      if (earlyPct === null || latePct === null || earlyPct === 0) return 0;
      return earlyPct - latePct;
    });
    const avgDrop = drops.reduce((a, b) => a + b, 0) / drops.length;
    if (avgDrop > 15) {
      insights.push({ text: `Your shooting accuracy drops an average of ${Math.round(avgDrop)}% in late phases. Try adding fatigue-state finishing drills at the end of training.`, icon: 'down' });
    }
  })();

  // 6. Weak foot progress
  (() => {
    const recent = sorted.slice(0, 10).filter(s => s.shooting?.leftFoot || s.shooting?.rightFoot);
    if (recent.length < 5) return;
    let lShots = 0, rShots = 0;
    recent.forEach(s => { lShots += s.shooting?.leftFoot?.shots || 0; rShots += s.shooting?.rightFoot?.shots || 0; });
    const total = lShots + rShots;
    if (total < 20) return;
    const weakRatio = Math.round(Math.min(lShots, rShots) / total * 100);
    if (weakRatio < 20) {
      insights.push({ text: `Only ${weakRatio}% of your shots are on your weaker foot. Aim for 30%+ to build two-footed ability.`, icon: 'info' });
    } else if (weakRatio >= 30) {
      insights.push({ text: `Strong weak-foot usage at ${weakRatio}% — great two-footed development.`, icon: 'up' });
    }
  })();

  // 7. Passing trend
  (() => {
    if (sorted.length < 10) return;
    const recentAvg = getAverageStat(sorted.slice(0, 5), getPassPercentage);
    const prevAvg = getAverageStat(sorted.slice(5, 10), getPassPercentage);
    if (recentAvg === null || prevAvg === null) return;
    const diff = recentAvg - prevAvg;
    if (diff >= 5) {
      insights.push({ text: `Pass completion up ${diff}% over your last 5 sessions. Your distribution is sharpening.`, icon: 'up' });
    } else if (diff <= -5) {
      insights.push({ text: `Pass accuracy dipped ${Math.abs(diff)}% recently. Slow down your decision-making and focus on weight of pass.`, icon: 'down' });
    }
  })();

  // 8. PR celebration — check if any PR set this week
  (() => {
    if (!personalRecords) return;
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const recentPRs = Object.entries(personalRecords)
      .filter(([, rec]) => rec?.date >= weekAgo)
      .map(([key]) => PR_LABELS[key])
      .filter(Boolean);
    if (recentPRs.length > 0) {
      insights.push({ text: `You set a new personal record this week: ${recentPRs[0]}. Your hard work is paying off.`, icon: 'up' });
    }
  })();

  // 9. Load management
  (() => {
    const weeks = getWeeklyLoads(sessions, 4);
    if (weeks.length < 2) return;
    const current = weeks[weeks.length - 1].totalLoad;
    const prev = weeks.slice(0, -1).filter(w => w.totalLoad > 0);
    if (!prev.length || current === 0) return;
    const avgPrev = prev.reduce((s, w) => s + w.totalLoad, 0) / prev.length;
    if (avgPrev > 0 && current / avgPrev > 1.4) {
      insights.push({ text: `Your training load this week is ${Math.round((current / avgPrev - 1) * 100)}% above your recent average. Consider a lighter session to manage recovery.`, icon: 'warn' });
    }
  })();

  // 10. Session type variety
  (() => {
    const last5Types = sorted.slice(0, 5).map(s => s.sessionType).filter(Boolean);
    if (last5Types.length >= 4 && new Set(last5Types).size === 1) {
      insights.push({ text: `Your last ${last5Types.length} sessions are all "${last5Types[0]}" type. Mix in different session types to develop more rounded skills.`, icon: 'info' });
    }
  })();

  return insights.slice(0, 3);
}

// === Training Score (composite 0-100) ===
export function computeTrainingScore(sessions, weeklyGoal = 3) {
  if (sessions.length < 3) return null;
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));

  // Consistency (25%): current week sessions vs goal — always computable
  const weekCount = getCurrentWeekSessionCount(sessions);
  const consistency = Math.min(100, Math.round((weekCount / Math.max(weeklyGoal, 1)) * 100));

  // Shot accuracy (20%) — null if no shooting data logged
  const shooting = getAverageStat(sessions, getShotPercentage, 7);

  // Pass accuracy (15%) — null if no passing data logged
  const passing = getAverageStat(sessions, getPassPercentage, 7);

  // Physical (15%): RPE sweet-spot score (6-8 is optimal) — null if no RPE logged
  const recentRPE = sorted.slice(0, 7).map(s => s.fitness?.rpe).filter(Boolean);
  let physical = null;
  if (recentRPE.length) {
    const avgRPE = recentRPE.reduce((a, b) => a + b, 0) / recentRPE.length;
    // RPE 7 is perfect (100), penalty grows as distance from 7 increases
    physical = Math.max(0, Math.min(100, 100 - Math.abs(avgRPE - 7) * 20));
  }

  // Endurance (15%): fatigue decay score — null if no fatigue data
  const endurance = getAverageFatigueScore(sessions, 7);

  // Mental (10%): confidence + focus average — null if no reflections logged
  const recentMental = sorted.slice(0, 5).filter(s => s.reflection?.confidence != null && s.reflection?.focus != null);
  let mental = null;
  if (recentMental.length) {
    const avg = recentMental.reduce((sum, s) => sum + (s.reflection.confidence + s.reflection.focus) / 2, 0) / recentMental.length;
    mental = Math.round((avg / 5) * 100);
  }

  // Weighted-average over only the pillars that have real data.
  // Consistency is always present; others are included only when non-null.
  const pillars = [
    { value: consistency, weight: 0.25 },
    { value: shooting,    weight: 0.20 },
    { value: passing,     weight: 0.15 },
    { value: physical,    weight: 0.15 },
    { value: endurance,   weight: 0.15 },
    { value: mental,      weight: 0.10 },
  ];
  let weightedSum = 0;
  let totalWeight = 0;
  for (const p of pillars) {
    if (p.value != null) {
      weightedSum += p.value * p.weight;
      totalWeight += p.weight;
    }
  }
  const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null;
  if (score == null) return null;

  return { score, breakdown: { consistency, shooting, passing, physical, endurance, mental } };
}

/**
 * Compute Training Score with week-over-week deltas for each metric.
 * Returns current score, previous week's score, and per-metric deltas.
 */
export function computeTrainingScoreWithDeltas(sessions, weeklyGoal = 3) {
  const current = computeTrainingScore(sessions, weeklyGoal);
  if (!current) return null;

  // Find Monday of the current week
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(monday.getDate() + mondayOffset);
  const mondayStr = monday.toISOString().slice(0, 10);

  // Sessions before this week = "last week's snapshot"
  const prevSessions = sessions.filter(s => s.date < mondayStr);
  const prev = computeTrainingScore(prevSessions, weeklyGoal);

  const breakdown = {};
  for (const key of Object.keys(current.breakdown)) {
    const value = current.breakdown[key];
    const prevValue = prev?.breakdown?.[key] ?? null;
    // Delta only makes sense when BOTH values are real numbers.
    const delta = (value != null && prevValue != null) ? value - prevValue : null;
    breakdown[key] = { value, prev: prevValue, delta };
  }

  return {
    score: current.score,
    prevScore: prev?.score ?? null,
    // Only compute overall delta when both scores exist (first-week guard)
    delta: (prev?.score != null && current.score != null) ? current.score - prev.score : null,
    breakdown,
  };
}

// === Four-Pillar Development Scores ===
export function computeFourPillars(sessions, decisionJournal = []) {
  if (sessions.length < 5) return null;
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));

  // Helper: safe average
  const avg = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

  // ── Technique ──
  const shotAcc = getAverageStat(sessions, getShotPercentage, 7);
  const passAcc = getAverageStat(sessions, getPassPercentage, 7);
  const wf = getWeakFootStats(sorted.slice(0, 10));
  const weakFootScore = wf ? Math.min(100, Math.round(Math.min(wf.leftRatio, wf.rightRatio) * 5)) : null;
  const delAcc = (() => {
    const acc = getDeliveryAccuracy(sessions);
    const types = Object.values(acc);
    return types.length ? Math.round(types.reduce((s, t) => s + t.accuracy, 0) / types.length) : null;
  })();
  const techScores = [shotAcc, passAcc, weakFootScore, delAcc].filter(v => v !== null);
  const technique = techScores.length ? Math.round(techScores.reduce((a, b) => a + b, 0) / techScores.length) : 50;

  // ── Tactics ──
  const allDecisions = decisionJournal.flatMap(e => e.decisions || []);
  const goodDec = allDecisions.length >= 5 ? getGoodDecisionPct(decisionJournal) : null;
  const endProduct = (() => {
    const rates = sorted.slice(0, 7).map(s => getTakeOnEndProductRate(s)).filter(v => v !== null);
    return rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null;
  })();
  const zoneDiv = (() => {
    const zones = {};
    for (const s of sorted.slice(0, 10)) {
      const zd = getZoneHeatmapData(s);
      if (!zd) continue;
      for (const [z, d] of Object.entries(zd)) {
        zones[z] = (zones[z] || 0) + d.shots;
      }
    }
    const vals = Object.values(zones);
    if (!vals.length) return null;
    const total = vals.reduce((a, b) => a + b, 0);
    const maxPct = Math.max(...vals) / total * 100;
    return Math.min(100, Math.round(100 - (maxPct - 20))); // Penalty if one zone dominates
  })();
  const tactScores = [goodDec, endProduct, zoneDiv].filter(v => v !== null);
  const tactics = tactScores.length ? Math.round(tactScores.reduce((a, b) => a + b, 0) / tactScores.length) : 50;

  // ── Fitness ──
  const loadConsistency = (() => {
    const weeks = getWeeklyLoads(sessions, 4);
    const loads = weeks.map(w => w.totalLoad).filter(l => l > 0);
    if (loads.length < 2) return null;
    const mean = loads.reduce((a, b) => a + b, 0) / loads.length;
    const variance = loads.reduce((s, l) => s + (l - mean) ** 2, 0) / loads.length;
    const cv = Math.sqrt(variance) / (mean || 1); // Coefficient of variation
    return Math.min(100, Math.round(100 - cv * 100)); // Lower CV = more consistent = higher score
  })();
  const fatigueScore = getAverageFatigueScore(sessions, 5);
  const rpeScore = (() => {
    const rpVals = sorted.slice(0, 7).map(s => s.fitness?.rpe).filter(Boolean);
    if (!rpVals.length) return null;
    const avgR = rpVals.reduce((a, b) => a + b, 0) / rpVals.length;
    return Math.max(0, Math.min(100, 100 - Math.abs(avgR - 7) * 20));
  })();
  const fitScores = [loadConsistency, fatigueScore, rpeScore].filter(v => v !== null);
  const fitness = fitScores.length ? Math.round(fitScores.reduce((a, b) => a + b, 0) / fitScores.length) : 50;

  // ── Mentality ──
  const confScores = sorted.slice(0, 7).map(s => s.reflection?.confidence).filter(Boolean);
  const focScores = sorted.slice(0, 7).map(s => s.reflection?.focus).filter(Boolean);
  const confAvg = confScores.length ? avg(confScores.map(c => c * 20)) : null;
  const focAvg = focScores.length ? avg(focScores.map(f => f * 20)) : null;
  const streakBonus = Math.min(100, getStreak(sessions) * 10);
  const mentScores = [confAvg, focAvg, streakBonus].filter(v => v !== null);
  const mentality = mentScores.length ? Math.round(mentScores.reduce((a, b) => a + b, 0) / mentScores.length) : 50;

  return [
    { pillar: 'Technique', score: technique, fullMark: 100 },
    { pillar: 'Tactics', score: tactics, fullMark: 100 },
    { pillar: 'Fitness', score: fitness, fullMark: 100 },
    { pillar: 'Mentality', score: mentality, fullMark: 100 },
  ];
}

// === Personal Records ===
export const PR_LABELS = {
  bestShotPct: 'Best Shot %',
  bestPassPct: 'Best Pass %',
  longestStreak: 'Longest Streak',
  mostGoals: 'Most Goals',
  longestDuration: 'Longest Session',
};

export function computePersonalRecords(sessions) {
  const records = { bestShotPct: null, bestPassPct: null, longestStreak: null, mostGoals: null, longestDuration: null };
  for (const s of sessions) {
    const shotPct = getShotPercentage(s);
    if (shotPct !== null && (!records.bestShotPct || shotPct > records.bestShotPct.value)) {
      records.bestShotPct = { value: shotPct, sessionId: s.id, date: s.date };
    }
    const passPct = getPassPercentage(s);
    if (passPct !== null && (!records.bestPassPct || passPct > records.bestPassPct.value)) {
      records.bestPassPct = { value: passPct, sessionId: s.id, date: s.date };
    }
    if (s.shooting?.goals && (!records.mostGoals || s.shooting.goals > records.mostGoals.value)) {
      records.mostGoals = { value: s.shooting.goals, sessionId: s.id, date: s.date };
    }
    if (s.duration && (!records.longestDuration || s.duration > records.longestDuration.value)) {
      records.longestDuration = { value: s.duration, sessionId: s.id, date: s.date };
    }
  }
  const streak = getStreak(sessions);
  if (streak > 0) {
    records.longestStreak = { value: streak, date: new Date().toISOString().split('T')[0] };
  }
  return records;
}

export function detectNewPRs(oldRecords, newRecords) {
  if (!oldRecords) return [];
  const prs = [];
  for (const key of Object.keys(newRecords)) {
    const old = oldRecords[key];
    const cur = newRecords[key];
    if (cur && (!old || cur.value > old.value)) prs.push(key);
  }
  return prs;
}

// === Body Check Insights ===
export function getBodyCheckCorrelation(sessions, bodyCheckField, performanceFn) {
  const buckets = {};
  for (const s of sessions) {
    if (!s.bodyCheck || s.bodyCheck[bodyCheckField] === undefined) continue;
    const perf = performanceFn(s);
    if (perf === null) continue;
    const key = s.bodyCheck[bodyCheckField];
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(perf);
  }
  const result = {};
  for (const [key, values] of Object.entries(buckets)) {
    result[key] = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }
  return result;
}

export function getBodyCheckInsight(sessions, bodyCheckField, performanceFn, metricLabel, fieldLabel) {
  const corr = getBodyCheckCorrelation(sessions, bodyCheckField, performanceFn);
  const keys = Object.keys(corr).map(Number).sort((a, b) => a - b);
  if (keys.length < 2) return null;
  const lowAvg = corr[keys[0]];
  const highAvg = corr[keys[keys.length - 1]];
  const diff = highAvg - lowAvg;
  if (Math.abs(diff) < 3) return null;
  const direction = diff > 0 ? 'better' : 'worse';
  return `You ${metricLabel} ${Math.abs(diff)}% ${direction} when ${fieldLabel}`;
}

// === Match Stats ===
export function getMatchStats(matches) {
  if (!matches.length) return null;
  const wins = matches.filter(m => m.result === 'W').length;
  const totalGoals = matches.reduce((sum, m) => sum + (m.goals || 0), 0);
  const avgRating = Math.round(matches.reduce((sum, m) => sum + m.rating, 0) / matches.length * 10) / 10;
  return {
    total: matches.length,
    wins,
    draws: matches.filter(m => m.result === 'D').length,
    losses: matches.filter(m => m.result === 'L').length,
    winRate: Math.round((wins / matches.length) * 100),
    totalGoals,
    totalAssists: matches.reduce((sum, m) => sum + (m.assists || 0), 0),
    avgRating,
  };
}

// === Training Calendar ===
export function getWeekDates(weekOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + weekOffset * 7);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return date.toISOString().split('T')[0];
  });
}

// === Fatigue / Phase Analysis ===
export function getPhaseStats(session) {
  const result = { shooting: null, passing: null, fitness: null };

  if (session.shooting?.phases) {
    const p = session.shooting.phases;
    result.shooting = {};
    for (const phase of ['early', 'mid', 'late']) {
      if (p[phase]?.shots) {
        result.shooting[phase] = calcPercentage(p[phase].goals, p[phase].shots);
      }
    }
    if (Object.keys(result.shooting).length === 0) result.shooting = null;
  }

  if (session.passing?.phases) {
    const p = session.passing.phases;
    result.passing = {};
    for (const phase of ['early', 'late']) {
      if (p[phase]?.attempts) {
        result.passing[phase] = calcPercentage(p[phase].completed, p[phase].attempts);
      }
    }
    if (Object.keys(result.passing).length === 0) result.passing = null;
  }

  if (session.fitness?.phases) {
    const p = session.fitness.phases;
    result.fitness = {};
    for (const phase of ['early', 'late']) {
      if (p[phase]?.sprintQuality) {
        result.fitness[phase] = p[phase].sprintQuality;
      }
    }
    if (Object.keys(result.fitness).length === 0) result.fitness = null;
  }

  return result;
}

export function computeFatigueDecay(session) {
  const phases = getPhaseStats(session);
  const ratios = {};
  let weightedSum = 0;
  let totalWeight = 0;

  // Shot % decay: late/early ratio
  if (phases.shooting) {
    const early = phases.shooting.early;
    const late = phases.shooting.late ?? phases.shooting.mid;
    if (early != null && early > 0 && late != null) {
      ratios.shooting = Math.min(late / early, 1.0);
      weightedSum += ratios.shooting * 35;
      totalWeight += 35;
    }
  }

  // Pass % decay: late/early ratio
  if (phases.passing) {
    const early = phases.passing.early;
    const late = phases.passing.late;
    if (early != null && early > 0 && late != null) {
      ratios.passing = Math.min(late / early, 1.0);
      weightedSum += ratios.passing * 35;
      totalWeight += 35;
    }
  }

  // Sprint quality decay: late/early ratio (scale 1-5)
  if (phases.fitness) {
    const early = phases.fitness.early;
    const late = phases.fitness.late;
    if (early != null && early > 0 && late != null) {
      ratios.fitness = Math.min(late / early, 1.0);
      weightedSum += ratios.fitness * 30;
      totalWeight += 30;
    }
  }

  if (totalWeight === 0) return null;

  const score = Math.round((weightedSum / totalWeight) * 100);

  return { score, ratios, phases, hasData: true };
}

export function diagnoseFatigue(session) {
  const decay = computeFatigueDecay(session);
  if (!decay) return null;

  const { ratios, score } = decay;

  // 1. Recovery — correlate with bodyCheck (including HRV from Whoop)
  if (session.bodyCheck) {
    const { sleepHours, energy, soreness, hrv } = session.bodyCheck;
    const lowHRV = hrv != null && hrv < 50;
    const poorRecovery = (sleepHours && sleepHours < 6) || energy <= 2 || soreness >= 4 || lowHRV;
    if (poorRecovery && score < 70) {
      const factors = [];
      if (sleepHours && sleepHours < 6) factors.push('low sleep');
      if (lowHRV) factors.push(`low HRV (${hrv}ms)`);
      if (soreness >= 4) factors.push('high soreness');
      if (energy <= 2) factors.push('low energy');
      return {
        category: 'recovery',
        label: 'Recovery',
        message: `Performance decline correlates with poor recovery indicators — ${factors.join(', ')}. Consider lighter training or extra rest.`,
        severity: score < 50 ? 'high' : 'moderate',
      };
    }
  }

  // 2. Pacing — strong early, significant mid+late drop
  const phases = getPhaseStats(session);
  if (phases.shooting?.early != null && phases.shooting?.mid != null && phases.shooting?.late != null) {
    const earlyToMid = phases.shooting.mid / Math.max(phases.shooting.early, 1);
    const earlyToLate = phases.shooting.late / Math.max(phases.shooting.early, 1);
    if (earlyToMid < 0.75 && earlyToLate < 0.65) {
      return {
        category: 'pacing',
        label: 'Pacing',
        message: 'Performance dropped sharply from early to mid and late. You may be starting at too high an intensity — try pacing yourself more evenly.',
        severity: 'high',
      };
    }
  }

  // 3. Technical Quality — shot % drops but pass % holds
  if (ratios.shooting != null && ratios.passing != null) {
    const shotDrop = 1 - ratios.shooting;
    const passDrop = 1 - ratios.passing;
    if (shotDrop > 0.20 && passDrop < 0.10) {
      return {
        category: 'technical',
        label: 'Technical Quality',
        message: 'Shooting accuracy degrades late while passing holds steady. Fine motor skills and finishing technique may be fatiguing faster than decision-making.',
        severity: shotDrop > 0.35 ? 'high' : 'moderate',
      };
    }
  }

  // 4. Focus — pass % drops more than shot %
  if (ratios.shooting != null && ratios.passing != null) {
    const shotDrop = 1 - ratios.shooting;
    const passDrop = 1 - ratios.passing;
    if (passDrop > 0.20 && passDrop > shotDrop + 0.10) {
      return {
        category: 'focus',
        label: 'Focus / Concentration',
        message: 'Passing accuracy drops more than shooting late in sessions. Decision-making and concentration are declining — try shorter high-focus blocks.',
        severity: passDrop > 0.35 ? 'high' : 'moderate',
      };
    }
  }

  // 5. Fitness — all metrics drop uniformly
  const drops = Object.values(ratios).map(r => 1 - r);
  if (drops.length > 0) {
    const avgDrop = drops.reduce((a, b) => a + b, 0) / drops.length;
    if (avgDrop > 0.15 && drops.every(d => d > 0.10)) {
      return {
        category: 'fitness',
        label: 'Fitness',
        message: 'All metrics decline uniformly across the session. Cardiovascular or muscular fatigue is the primary limiter — focus on conditioning.',
        severity: avgDrop > 0.30 ? 'high' : 'moderate',
      };
    }
  }

  // 6. Strong endurance
  if (score >= 85) {
    return {
      category: 'strong',
      label: 'Strong Endurance',
      message: 'Performance holds well throughout the session. Your conditioning is solid — keep it up.',
      severity: 'none',
    };
  }

  // 7. General fatigue
  return {
    category: 'general',
    label: 'General Fatigue',
    message: 'Some performance decline detected but no single dominant pattern. Monitor trends over multiple sessions.',
    severity: score < 60 ? 'moderate' : 'low',
  };
}

export function getAverageFatigueScore(sessions, lastN) {
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  const subset = lastN ? sorted.slice(0, lastN) : sorted;
  const scores = subset
    .map(s => computeFatigueDecay(s))
    .filter(d => d !== null)
    .map(d => d.score);
  if (!scores.length) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

// === Session Types ===
export const SESSION_TYPES = ['Benchmark', 'Representative', 'Fatigue', 'Free'];

// === Loughborough Soccer Passing Test (LSPT) ===
export const LSPT_NORMS = {
  elite: 90,
  advanced: 70,
  intermediate: 50,
};

// === Loughborough Soccer Shooting Test (LSST) ===
export const LSST_NORMS = {
  elite: 85,
  advanced: 65,
  intermediate: 45,
};

/**
 * Computes LSPT score from time, completed passes, and errors.
 * Lower time is better; completed passes add points, errors subtract.
 */
export function computeLSPTScore(time, completed, errors) {
  if (!time || time <= 0) return 0;
  // Base score: inverse of time scaled to 100 (60s baseline for a perfect run)
  const timeScore = Math.max(0, Math.round((60 / time) * 50));
  const completionBonus = (completed || 0) * 2;
  const errorPenalty = (errors || 0) * 5;
  return Math.max(0, Math.round(timeScore + completionBonus - errorPenalty));
}

/**
 * Computes LSST score from zone-based shot data.
 * Zones further away and harder angles earn more points per goal.
 */
export function computeLSSTScore(zones, totalShots, totalGoals) {
  if (!totalShots || totalShots === 0) return 0;

  const ZONE_WEIGHTS = {
    'left-far': 4, 'right-far': 4,
    'left-mid': 3, 'right-mid': 3,
    'left-near': 2, 'right-near': 2,
  };

  let weightedPoints = 0;
  if (zones && Object.keys(zones).length > 0) {
    for (const [zone, data] of Object.entries(zones)) {
      const weight = ZONE_WEIGHTS[zone] || 2;
      weightedPoints += (data.goals || 0) * weight;
    }
  } else {
    // Fallback: use flat scoring if no zone breakdown
    weightedPoints = (totalGoals || 0) * 3;
  }

  // Accuracy bonus
  const accuracyPct = totalShots > 0 ? (totalGoals / totalShots) * 100 : 0;
  const accuracyBonus = Math.round(accuracyPct * 0.3);

  return Math.max(0, Math.round(weightedPoints + accuracyBonus));
}

/**
 * Returns benchmark level string based on score vs norms thresholds.
 * For LSPT (time-based where higher computed score = better) and LSST (score-based).
 */
export function getBenchmarkLevel(score, norms) {
  if (score >= norms.elite) return 'Elite';
  if (score >= norms.advanced) return 'Advanced';
  if (score >= norms.intermediate) return 'Intermediate';
  return 'Beginner';
}

// === FOE Trend (Finishing Over Expected) ===
export function getFOETrend(sessions, lastN = 15) {
  const sorted = [...sessions]
    .filter(s => s.shooting?.xG != null && s.shooting?.goals != null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-(lastN || 15));

  return sorted.map(s => ({
    date: formatDateShort(s.date),
    xG: s.shooting.xG,
    goals: s.shooting.goals,
    foe: +(s.shooting.goals - s.shooting.xG).toFixed(2),
  }));
}

// === Zone Heatmap Data ===
export function getZoneHeatmapData(session) {
  if (!session.shooting?.zones) return null;
  const zones = session.shooting.zones;
  const entries = Object.entries(zones).filter(([, v]) => v && v.shots > 0);
  if (!entries.length) return null;
  const result = {};
  for (const [zone, data] of entries) {
    result[zone] = { shots: data.shots, goals: data.goals || 0 };
  }
  return result;
}

// === Mental Trend Data ===
export function getMentalTrendData(sessions) {
  return [...sessions]
    .filter(s => s.reflection && (s.reflection.confidence != null || s.reflection.focus != null || s.reflection.enjoyment != null))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(s => ({
      date: formatDateShort(s.date),
      confidence: s.reflection.confidence ?? null,
      focus: s.reflection.focus ?? null,
      enjoyment: s.reflection.enjoyment ?? null,
    }));
}

// === Weekly Training Loads ===
export function getWeeklyLoads(sessions, numWeeks = 8) {
  const weeks = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  for (let i = numWeeks - 1; i >= 0; i--) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - i * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6);

    const weekLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const startStr = weekStart.toISOString().split('T')[0];
    const endStr = weekEnd.toISOString().split('T')[0];

    const weekSessions = sessions.filter(s => s.date >= startStr && s.date <= endStr);
    const totalLoad = weekSessions.reduce((sum, s) => sum + (getSessionLoad(s) || 0), 0);

    weeks.push({
      weekLabel,
      totalLoad,
      sessionCount: weekSessions.length,
    });
  }

  return weeks;
}

// === Single Session Load ===
export function getSessionLoad(session) {
  const rpe = session.fitness?.rpe;
  const duration = session.duration;
  if (!rpe || !duration) return null;
  return Math.round(rpe * duration);
}

// === Duel Success Rate ===
export function getDuelSuccessRate(session) {
  const duels = session.attacking?.duels;
  if (!duels || !duels.attempts || duels.attempts === 0) return null;
  return Math.round((duels.successes / duels.attempts) * 100);
}

// === Session xG Stats ===
export function getSessionXGStats(session) {
  if (!session.shooting) return null;
  const xG = session.shooting.xG;
  const goals = session.shooting.goals;
  if (xG == null || goals == null) return null;
  return {
    xG,
    goals,
    foe: +(goals - xG).toFixed(2),
  };
}

// === Delivery Accuracy ===
export function getDeliveryAccuracy(sessions) {
  const typeTotals = {};

  for (const s of sessions) {
    const entries = s.delivery?.entries;
    if (!entries || !entries.length) continue;

    for (const entry of entries) {
      const type = entry.type || 'unknown';
      if (!typeTotals[type]) {
        typeTotals[type] = { total: 0, perfect: 0, usable: 0, failed: 0 };
      }
      typeTotals[type].total++;
      if (entry.quality === 'perfect') typeTotals[type].perfect++;
      else if (entry.quality === 'usable') typeTotals[type].usable++;
      else typeTotals[type].failed++;
    }
  }

  const types = Object.entries(typeTotals);
  if (!types.length) return [];

  return types.map(([type, data]) => ({
    type,
    ...data,
    accuracy: data.total > 0 ? Math.round(((data.perfect + data.usable) / data.total) * 100) : 0,
  }));
}

// === Take-On End Product Rate ===
export function getTakeOnEndProductRate(session) {
  const takeOns = session.attacking?.takeOns;
  if (!takeOns || !takeOns.attempts || takeOns.attempts === 0) return null;
  const endProducts = takeOns.endProducts || 0;
  return Math.round((endProducts / takeOns.attempts) * 100);
}

// === Weakest Shooting Approach ===
export function getWeakestApproach(sessions) {
  const approaches = {};

  for (const s of sessions) {
    const details = s.shooting?.shotDetails;
    if (!details || !details.length) continue;

    for (const detail of details) {
      if (!detail.approach) continue;
      if (!approaches[detail.approach]) {
        approaches[detail.approach] = { shots: 0, goals: 0 };
      }
      approaches[detail.approach].shots += Number(detail.shots) || 0;
      approaches[detail.approach].goals += Number(detail.goals) || 0;
    }
  }

  const entries = Object.entries(approaches).filter(([, v]) => v.shots >= 3);
  if (!entries.length) return null;

  let weakest = null;
  for (const [approach, data] of entries) {
    const pct = Math.round((data.goals / data.shots) * 100);
    if (!weakest || pct < weakest.pct) {
      weakest = { approach, shots: data.shots, goals: data.goals, pct };
    }
  }

  return weakest;
}

// === Current Week Session Count ===
export function getCurrentWeekSessionCount(sessions) {
  const now = new Date();
  const day = now.getDay();
  // Monday = start of week. getDay() returns 0 for Sunday.
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(monday.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  const mondayStr = monday.toISOString().split('T')[0];

  // Sunday is end of week
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const sundayStr = sunday.toISOString().split('T')[0];

  return sessions.filter(s => s.date >= mondayStr && s.date <= sundayStr).length;
}

// === Good Decision Percentage ===
export function getGoodDecisionPct(decisionJournal) {
  if (!decisionJournal || !decisionJournal.length) return null;
  const allDecisions = decisionJournal.flatMap(e => e.decisions || []);
  if (!allDecisions.length) return null;
  const good = allDecisions.filter(d => d.rightDecision).length;
  return Math.round((good / allDecisions.length) * 100);
}

// === IDP Goal Deadline Badge ===
export function getDeadlineBadge(targetDate) {
  if (!targetDate) return null;
  const now = new Date();
  const target = new Date(targetDate);
  const daysLeft = Math.ceil((target - now) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) return { label: 'Overdue', color: 'red' };
  if (daysLeft <= 7) return { label: `${daysLeft}d left`, color: 'red' };
  if (daysLeft <= 30) return { label: `${daysLeft}d left`, color: 'amber' };
  return { label: `${daysLeft}d left`, color: 'gray' };
}

export function getWeeklyReport(sessions, matches) {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split('T')[0];
  const twoWeeksAgoStr = new Date(weekAgo.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const weekSessions = sessions.filter(s => s.date >= weekAgoStr);
  const prevWeekSessions = sessions.filter(s => s.date >= twoWeeksAgoStr && s.date < weekAgoStr);
  const weekMatches = (matches || []).filter(m => m.date >= weekAgoStr);

  const totalTime = weekSessions.reduce((sum, s) => sum + s.duration, 0);
  const avgShotPct = getAverageStat(weekSessions, getShotPercentage);
  const avgPassPct = getAverageStat(weekSessions, getPassPercentage);
  const avgRPE = getAverageStat(weekSessions, s => s.fitness?.rpe ?? null);
  const prevAvgRPE = getAverageStat(prevWeekSessions, s => s.fitness?.rpe ?? null);

  return {
    totalSessions: weekSessions.length,
    totalTime,
    avgShotPct,
    avgPassPct,
    avgRPE,
    rpeTrend: avgRPE !== null && prevAvgRPE !== null ? avgRPE - prevAvgRPE : null,
    weekMatches: weekMatches.length,
    weekGoals: weekMatches.reduce((sum, m) => sum + (m.goals || 0), 0),
  };
}
