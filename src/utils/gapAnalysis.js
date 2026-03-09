import {
  getWeakFootStats, getWeakestApproach, getDeliveryAccuracy,
  getDuelSuccessRate, getAverageStat, getShotPercentage, getPassPercentage,
  computeFatigueDecay, hasPassingDrill, hasFitnessDrill,
} from './stats';

// ── Mini-Session Recommendations ───────────────────────────────────────────

const MINI_SESSIONS = {
  weakFoot: {
    title: 'Weak Foot Finishing',
    duration: 15,
    drills: ['Finishing Drill', 'Shooting (Inside Box)'],
    instruction: 'Focus exclusively on your weaker foot. Start close range (6-yard box), then progress to edge of area. Aim for 20+ shots.',
  },
  finishingApproach: {
    title: 'Approach Finishing',
    duration: 15,
    drills: ['Finishing Drill', 'Shooting (Outside Box)'],
    instruction: 'Drill your weakest finishing approach. Set up scenarios that force the specific movement pattern before shooting.',
  },
  passing: {
    title: 'Sharp Passing',
    duration: 15,
    drills: ['Wall Passes (1-touch)', 'Short Passing Combos'],
    instruction: 'High-tempo wall passes focusing on first touch and accuracy. Alternate between 1-touch and 2-touch patterns.',
  },
  fitness: {
    title: 'Sprint & Conditioning',
    duration: 20,
    drills: ['Sprint Intervals', 'Dribbling Circuit'],
    instruction: 'Interval-based sprints with ball at feet. 6x30m sprints with 45s recovery between reps.',
  },
  delivery: {
    title: 'Crossing & Delivery',
    duration: 15,
    drills: ['Crossing & Finishing'],
    instruction: 'Alternate between driven crosses, lofted crosses, and cutbacks. Focus on hitting target zones consistently.',
  },
  duels: {
    title: '1v1 Take-On Practice',
    duration: 15,
    drills: ['Dribbling Circuit'],
    instruction: 'Set up cones as a defender. Practice explosive changes of direction, body feints, and maintaining close ball control.',
  },
  mental: {
    title: 'Mindful Technical Session',
    duration: 10,
    drills: ['Short Passing Combos', 'Rondo'],
    instruction: 'Low-intensity session focused on enjoyment and rhythm. Set small targets and celebrate hitting them.',
  },
  variety: {
    title: 'Mixed Skills Session',
    duration: 20,
    drills: ['Finishing Drill', 'Wall Passes (1-touch)', 'Sprint Intervals'],
    instruction: 'Rotate through shooting, passing, and fitness in 5-minute blocks. Vary intensity and keep it fresh.',
  },
  fatigue: {
    title: 'End-of-Session Finishing',
    duration: 15,
    drills: ['Finishing Drill', 'Sprint Intervals'],
    instruction: 'Do a short sprint set first to simulate fatigue, then immediately practice finishing. Trains technique under physical stress.',
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function getUrgency(severity) {
  if (severity >= 70) return 'high';
  if (severity >= 40) return 'medium';
  return 'low';
}

function daysSince(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return Math.floor((today - d) / (1000 * 60 * 60 * 24));
}

function daysSinceLastDrillCategory(sessions, categoryCheckFn) {
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  for (const s of sorted) {
    if (categoryCheckFn(s.drills || [])) return daysSince(s.date);
  }
  return Infinity;
}

function daysSinceLastWeakFootShots(sessions) {
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  for (const s of sorted) {
    const left = s.shooting?.leftFoot?.shots || 0;
    const right = s.shooting?.rightFoot?.shots || 0;
    if (left + right > 0 && Math.min(left, right) > 0) {
      return daysSince(s.date);
    }
  }
  return Infinity;
}

function makeGap(type, area, severity, detail, miniSession) {
  return { type, area, severity: Math.min(100, Math.max(0, Math.round(severity))), urgency: getUrgency(severity), detail, miniSession };
}

// ── Gap Detectors ──────────────────────────────────────────────────────────

function detectWeakFootGap(sessions) {
  const stats = getWeakFootStats(sessions.slice(-10));
  if (!stats || stats.totalShots < 10) return null;

  const weakRatio = Math.min(stats.leftRatio, stats.rightRatio);
  const daysAway = daysSinceLastWeakFootShots(sessions);
  const daysPenalty = Math.min(30, daysAway === Infinity ? 30 : daysAway) * 1.5;

  if (weakRatio < 20 || daysAway >= 21) {
    const severity = (20 - Math.min(weakRatio, 20)) * 3 + daysPenalty;
    const foot = stats.leftRatio < stats.rightRatio ? 'left' : 'right';
    const detail = daysAway >= 21
      ? `No weak foot (${foot}) shots in ${daysAway === Infinity ? '3+' : daysAway} days. Balance is key for development.`
      : `Only ${weakRatio}% of your shots are on your ${foot} foot. Aim for at least 20%.`;
    return makeGap('weakFoot', 'Weak Foot', severity, detail, MINI_SESSIONS.weakFoot);
  }
  return null;
}

function detectFinishingApproachGap(sessions) {
  const gap = getWeakestApproach(sessions);
  if (!gap || gap.pct >= 25) return null;

  const severity = (25 - gap.pct) * 3;
  const approach = gap.approach.replace(/-/g, ' ');
  const detail = `Your ${approach} finishing is only ${gap.pct}% (${gap.goals}/${gap.shots}). Practice this specific movement pattern.`;
  const mini = {
    ...MINI_SESSIONS.finishingApproach,
    instruction: `Focus on ${approach} finishing. ${MINI_SESSIONS.finishingApproach.instruction}`,
  };
  return makeGap('finishingApproach', 'Finishing', severity, detail, mini);
}

function detectPassingGap(sessions) {
  const daysAway = daysSinceLastDrillCategory(sessions, hasPassingDrill);
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  const recentAvg = sorted.length >= 5 ? getAverageStat(sorted.slice(0, 5), getPassPercentage) : null;
  const prevAvg = sorted.length >= 10 ? getAverageStat(sorted.slice(5, 10), getPassPercentage) : null;
  const decline = (recentAvg !== null && prevAvg !== null) ? prevAvg - recentAvg : 0;

  if (daysAway >= 14 || decline >= 8) {
    const daysPenalty = daysAway >= 14 ? Math.min(40, (daysAway - 14) * 3 + 20) : 0;
    const declinePenalty = decline >= 8 ? decline * 3 : 0;
    const severity = Math.max(daysPenalty, declinePenalty);
    const detail = daysAway >= 14
      ? `No passing drills logged in ${daysAway === Infinity ? '14+' : daysAway} days. Keep your distribution sharp.`
      : `Pass accuracy dropped ${Math.round(decline)}% recently (${Math.round(recentAvg)}% vs ${Math.round(prevAvg)}%).`;
    return makeGap('passing', 'Passing', severity, detail, MINI_SESSIONS.passing);
  }
  return null;
}

function detectFitnessGap(sessions) {
  const daysAway = daysSinceLastDrillCategory(sessions, hasFitnessDrill);
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));

  let rpeTrend = 0;
  if (sorted.length >= 10) {
    const recentRPE = sorted.slice(0, 5).map(s => s.fitness?.rpe).filter(Boolean);
    const prevRPE = sorted.slice(5, 10).map(s => s.fitness?.rpe).filter(Boolean);
    if (recentRPE.length && prevRPE.length) {
      const recentAvg = recentRPE.reduce((a, b) => a + b, 0) / recentRPE.length;
      const prevAvg = prevRPE.reduce((a, b) => a + b, 0) / prevRPE.length;
      rpeTrend = prevAvg - recentAvg; // positive = declining intensity
    }
  }

  if (daysAway >= 14 || rpeTrend >= 1.5) {
    const daysPenalty = daysAway >= 14 ? Math.min(40, (daysAway - 14) * 3 + 20) : 0;
    const rpePenalty = rpeTrend >= 1.5 ? rpeTrend * 15 : 0;
    const severity = Math.max(daysPenalty, rpePenalty);
    const detail = daysAway >= 14
      ? `No fitness drills in ${daysAway === Infinity ? '14+' : daysAway} days. Maintaining conditioning prevents decline.`
      : `Training intensity has dropped recently. A focused conditioning session will help maintain your base.`;
    return makeGap('fitness', 'Fitness', severity, detail, MINI_SESSIONS.fitness);
  }
  return null;
}

function detectDeliveryGap(sessions) {
  const acc = getDeliveryAccuracy(sessions);
  if (!acc || !acc.length) return null;

  const totalDeliveries = acc.reduce((sum, d) => sum + d.total, 0);
  if (totalDeliveries < 5) return null;

  const totalPerfect = acc.reduce((sum, d) => sum + d.perfect, 0);
  const totalUsable = acc.reduce((sum, d) => sum + d.usable, 0);
  const accuracy = Math.round(((totalPerfect + totalUsable) / totalDeliveries) * 100);

  const hasCrossingDrill = (drills) => (drills || []).includes('Crossing & Finishing');
  const daysAway = daysSinceLastDrillCategory(sessions, hasCrossingDrill);
  const daysPenalty = daysAway >= 21 ? Math.min(30, (daysAway - 21) * 2 + 15) : 0;

  if (accuracy < 50 || daysAway >= 21) {
    const severity = (accuracy < 50 ? (50 - accuracy) * 2 : 0) + daysPenalty;
    const detail = accuracy < 50
      ? `Delivery accuracy is ${accuracy}%. Work on hitting target zones with crosses and cutbacks.`
      : `No crossing drills in ${daysAway} days. Keep your delivery sharp with regular practice.`;
    return makeGap('delivery', 'Delivery', severity, detail, MINI_SESSIONS.delivery);
  }
  return null;
}

function detectDuelGap(sessions) {
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  const recent = sorted.slice(0, 5);
  const rates = recent.map(getDuelSuccessRate).filter(v => v !== null);
  if (rates.length < 2) return null;

  const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
  if (avg >= 40) return null;

  const severity = (40 - avg) * 3;
  const detail = `1v1 duel success rate is ${Math.round(avg)}% over your last ${rates.length} sessions. Sharpen your take-on ability.`;
  return makeGap('duels', '1v1 Duels', severity, detail, MINI_SESSIONS.duels);
}

function detectMentalGap(sessions) {
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  const withReflection = sorted.filter(s => s.reflection?.confidence != null && s.reflection?.focus != null);
  if (withReflection.length < 6) return null;

  const recent3 = withReflection.slice(0, 3);
  const prev3 = withReflection.slice(3, 6);

  const recentAvg = recent3.reduce((sum, s) => sum + (s.reflection.confidence + s.reflection.focus) / 2, 0) / 3;
  const prevAvg = prev3.reduce((sum, s) => sum + (s.reflection.confidence + s.reflection.focus) / 2, 0) / 3;
  const delta = prevAvg - recentAvg;

  if (delta < 0.5) return null;

  const severity = Math.min(100, delta * 30);
  const detail = `Confidence and focus have dipped recently. A low-pressure session can help rebuild mental sharpness.`;
  return makeGap('mental', 'Mental', severity, detail, MINI_SESSIONS.mental);
}

function detectSessionTypeMonotony(sessions) {
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  const last5 = sorted.slice(0, 5);
  if (last5.length < 5) return null;

  const types = last5.map(s => s.sessionType || 'free');
  const dominant = types[0];
  const sameCount = types.filter(t => t === dominant).length;

  if (sameCount < 4) return null;

  const severity = 40;
  const detail = `Your last 5 sessions are all "${dominant}" type. Mix in different session types for well-rounded development.`;
  return makeGap('variety', 'Variety', severity, detail, MINI_SESSIONS.variety);
}

function detectPhaseWeakness(sessions) {
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  const last5 = sorted.slice(0, 5);
  const decays = last5.map(computeFatigueDecay).filter(d => d && d.hasData);
  if (decays.length < 3) return null;

  const lowCount = decays.filter(d => d.score < 65).length;
  if (lowCount < 3) return null;

  const avgScore = decays.reduce((sum, d) => sum + d.score, 0) / decays.length;
  const severity = (65 - avgScore) * 2;
  const detail = `Performance drops significantly in the second half of ${lowCount} of your last ${decays.length} sessions. Train finishing under fatigue.`;
  return makeGap('fatigue', 'Endurance', severity, detail, MINI_SESSIONS.fatigue);
}

// ── Main Export ─────────────────────────────────────────────────────────────

export function analyzeGaps(sessions) {
  if (sessions.length < 5) return [];

  const detectors = [
    detectWeakFootGap,
    detectFinishingApproachGap,
    detectPassingGap,
    detectFitnessGap,
    detectDeliveryGap,
    detectDuelGap,
    detectMentalGap,
    detectSessionTypeMonotony,
    detectPhaseWeakness,
  ];

  return detectors
    .map(fn => fn(sessions))
    .filter(Boolean)
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 3);
}
