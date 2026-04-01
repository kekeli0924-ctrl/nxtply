import { analyzeGaps } from './gapAnalysis';
import { getStreak, computeFourPillars } from './stats';

// Detailed drill definitions with reps/duration/instructions
const DRILL_DETAILS = {
  'Wall Passes (1-touch)': { reps: '3 sets x 20 passes', duration: 5, instruction: 'Alternate feet each set. Stay on your toes.' },
  'Wall Passes (2-touch)': { reps: '3 sets x 15 passes', duration: 5, instruction: 'First touch to control, second to pass. Focus on cushioning.' },
  'Finishing Drill': { reps: '20 shots total', duration: 8, instruction: '10 right foot, 10 left foot from inside the box. Aim corners.' },
  'Shooting (Inside Box)': { reps: '15 shots', duration: 7, instruction: '5 right, 5 left, 5 from different angles. Quick release.' },
  'Shooting (Outside Box)': { reps: '10 shots', duration: 6, instruction: 'Focus on power and placement. Hit the target before hitting it hard.' },
  'Crossing & Finishing': { reps: '10 crosses + finish', duration: 8, instruction: 'Cross from wide, run in and finish. Alternate sides.' },
  'Free Kicks': { reps: '15 kicks', duration: 8, instruction: '5 near post, 5 far post, 5 over the wall. Technique over power.' },
  'Long Passing': { reps: '20 passes', duration: 7, instruction: 'Hit targets at 30+ yards. Lock your ankle, follow through.' },
  'Short Passing Combos': { reps: '3 sets x 2 min', duration: 6, instruction: 'Quick 1-2 touch passing. Move after every pass.' },
  'Rondo': { reps: '3 rounds x 3 min', duration: 10, instruction: 'Keep possession under pressure. 2-touch max.' },
  'Dribbling Circuit': { reps: '5 runs through', duration: 6, instruction: 'Cones: inside-outside, drag backs, step-overs. Speed up each run.' },
  'Sprint Intervals': { reps: '8 x 30m sprints', duration: 8, instruction: '30 sec rest between sprints. Max effort each one.' },
};

function getDrillDetail(name) {
  return DRILL_DETAILS[name] || { reps: '10 min', duration: 10, instruction: 'Focus on quality over quantity.' };
}

function buildTimeline(drillNames) {
  const timeline = [];
  let elapsed = 0;

  // Warm-up always first
  timeline.push({
    name: 'Warm-up',
    reps: '5 min',
    duration: 5,
    instruction: 'Light jog, dynamic stretches, ball rolls.',
    startMin: 0,
    isWarmup: true,
  });
  elapsed = 5;

  for (const name of drillNames) {
    const detail = getDrillDetail(name);
    timeline.push({
      name,
      reps: detail.reps,
      duration: detail.duration,
      instruction: detail.instruction,
      startMin: elapsed,
    });
    elapsed += detail.duration;
  }

  // Cool-down always last
  timeline.push({
    name: 'Cool-down',
    reps: '5 min',
    duration: 5,
    instruction: 'Static stretches. Hold each stretch 20-30 seconds.',
    startMin: elapsed,
    isCooldown: true,
  });
  elapsed += 5;

  return { timeline, totalDuration: elapsed };
}

const STARTER_PLANS = [
  { focus: 'Getting Started', drills: ['Wall Passes (1-touch)', 'Finishing Drill', 'Dribbling Circuit'], motivation: 'Every expert was once a beginner. Let\'s build your foundation.' },
  { focus: 'Basic Shooting', drills: ['Finishing Drill', 'Shooting (Inside Box)', 'Free Kicks'], motivation: 'Find the back of the net. Focus on placement over power.' },
  { focus: 'Touch & Control', drills: ['Wall Passes (2-touch)', 'Short Passing Combos', 'Dribbling Circuit'], motivation: 'Great players are built on great first touches.' },
];

const RECOVERY_DRILLS = ['Wall Passes (2-touch)', 'Short Passing Combos', 'Dribbling Circuit'];

const PILLAR_DRILLS = {
  technique: ['Wall Passes (1-touch)', 'Wall Passes (2-touch)', 'Dribbling Circuit', 'Short Passing Combos'],
  tactics: ['Rondo', 'Short Passing Combos', 'Long Passing'],
  fitness: ['Sprint Intervals', 'Dribbling Circuit'],
  mentality: ['Free Kicks', 'Finishing Drill', 'Shooting (Outside Box)'],
};

const MOTIVATIONS = [
  'Small daily improvements lead to stunning results.',
  'The best never take a day off from getting better.',
  'Train like nobody\'s watching. Perform like everybody is.',
  'Consistency beats talent when talent isn\'t consistent.',
  'Today\'s work is tomorrow\'s confidence.',
  'Champions are made when nobody\'s watching.',
  'One more session closer to where you want to be.',
  'Discipline is choosing what you want most over what you want now.',
];

function pickMotivation() {
  return MOTIVATIONS[Math.floor(Math.random() * MOTIVATIONS.length)];
}

export function generateDailyPlan(sessions, idpGoals = []) {
  const today = new Date().toISOString().split('T')[0];
  const streak = getStreak(sessions);

  // Already trained today
  if (sessions.some(s => s.date === today)) {
    return {
      type: 'completed',
      focus: 'Session Complete',
      timeline: [],
      totalDuration: 0,
      drills: [],
      motivation: 'Great work today! Rest up and come back stronger tomorrow.',
      xpReward: 0,
    };
  }

  // New player → starter plan
  if (sessions.length < 3) {
    const plan = STARTER_PLANS[sessions.length % STARTER_PLANS.length];
    const { timeline, totalDuration } = buildTimeline(plan.drills);
    return { ...plan, type: 'starter', timeline, totalDuration, targetDuration: totalDuration, xpReward: 50 };
  }

  // Long streak → recovery
  if (streak >= 5) {
    const { timeline, totalDuration } = buildTimeline(RECOVERY_DRILLS);
    return {
      type: 'recovery',
      focus: 'Active Recovery',
      drills: RECOVERY_DRILLS,
      timeline,
      totalDuration,
      targetDuration: totalDuration,
      motivation: 'You\'ve been grinding. Today is about staying sharp without burning out.',
      xpReward: 25,
    };
  }

  // Fatigue check
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  const lastSession = sorted[0];
  if (lastSession?.bodyCheck) {
    const { energy, soreness } = lastSession.bodyCheck;
    if ((energy && Number(energy) <= 2) || (soreness && Number(soreness) >= 4)) {
      const { timeline, totalDuration } = buildTimeline(RECOVERY_DRILLS);
      return {
        type: 'recovery',
        focus: 'Active Recovery',
        drills: RECOVERY_DRILLS,
        timeline,
        totalDuration,
        targetDuration: totalDuration,
        motivation: 'Your body needs a lighter session today. Quality over quantity.',
        xpReward: 25,
      };
    }
  }

  // Gap-based plan
  const gaps = analyzeGaps(sessions);
  if (gaps.length > 0) {
    const topGap = gaps[0];
    const drills = topGap.miniSession.drills.slice(0, 4);

    const pillars = computeFourPillars(sessions);
    if (pillars) {
      const weakest = pillars.reduce((min, p) => p.score < min.score ? p : min, pillars[0]);
      const pillarKey = weakest.label.toLowerCase();
      const extra = (PILLAR_DRILLS[pillarKey] || []).filter(d => !drills.includes(d));
      if (drills.length < 4 && extra.length > 0) drills.push(extra[0]);
    }

    const { timeline, totalDuration } = buildTimeline(drills);

    return {
      type: 'gap',
      focus: topGap.miniSession.title,
      drills,
      timeline,
      totalDuration,
      targetDuration: totalDuration,
      motivation: topGap.miniSession.instruction || pickMotivation(),
      xpReward: 50,
      gapArea: topGap.area,
      gapUrgency: topGap.urgency,
    };
  }

  // Pillar-based fallback
  const pillars = computeFourPillars(sessions);
  if (pillars) {
    const weakest = pillars.reduce((min, p) => p.score < min.score ? p : min, pillars[0]);
    const pillarKey = weakest.label.toLowerCase();
    const drills = (PILLAR_DRILLS[pillarKey] || PILLAR_DRILLS.technique).slice(0, 4);
    const { timeline, totalDuration } = buildTimeline(drills);

    return {
      type: 'pillar',
      focus: `${weakest.label} Development`,
      drills,
      timeline,
      totalDuration,
      targetDuration: totalDuration,
      motivation: pickMotivation(),
      xpReward: 50,
    };
  }

  // General fallback
  const drills = ['Finishing Drill', 'Wall Passes (1-touch)', 'Sprint Intervals', 'Dribbling Circuit'];
  const { timeline, totalDuration } = buildTimeline(drills);
  return {
    type: 'general',
    focus: 'Complete Training',
    drills,
    timeline,
    totalDuration,
    targetDuration: totalDuration,
    motivation: pickMotivation(),
    xpReward: 50,
  };
}
