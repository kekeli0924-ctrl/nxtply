import { useMemo } from 'react';
import { MetricRow, MetricSection } from './MetricRow';
import { WeeklyReport } from './WeeklyReport';
import { DailyPlanCard } from './DailyPlanCard';
// GettingStartedChecklist removed — replaced by single "Ready to train?" CTA
import { WelcomeBack } from './WelcomeBack';
import { DateBrowser } from './DateBrowser';
import {
  getStreak, getAverageStat, getShotPercentage, getPassPercentage,
  formatDate, formatPercentage, computeTrainingScore, computeTrainingScoreWithDeltas,
  getCurrentWeekSessionCount, getWeeklyLoads,
  computeFatigueDecay, generateInsights,
} from '../utils/stats';
import { computePace } from '../utils/pace';
import { getPaceLabel, getIdentityTip, getIdentity, hasAnyIdentity } from '../utils/identity';

const BREAKDOWN_LABELS = {
  consistency: 'Consistency',
  shooting: 'Shooting',
  passing: 'Passing',
  physical: 'Physical',
  endurance: 'Endurance',
  mental: 'Mental',
};

const PACE_COLORS = {
  accelerating: '#16A34A',
  steady: '#D97706',
  stalling: '#DC2626',
};

// ── Pace Hero Card ─────────────────────────────────────────────────────────
// The first thing the player sees. Large, full-width, visually dominant.
// Shows: identity-aware headline + velocity %, training score with delta,
// and a prominent "see why" link to the Pace Audit View.
function PaceHeroCard({ pace, trainingScore, playerIdentity, onViewMetric }) {
  // Determine headline parts
  const identityLabel = hasAnyIdentity(playerIdentity) && getIdentity(playerIdentity)?.label
    ? getIdentity(playerIdentity).label
    : null;
  const label = pace?.overall?.label || 'steady';
  const velocity = pace?.overall?.velocityPct;
  const color = PACE_COLORS[label] || PACE_COLORS.steady;

  // Training score display
  const score = trainingScore?.score;
  const scoreDelta = trainingScore?.delta;

  // No pace data yet (< 5 sessions)
  const hasPace = pace != null && velocity != null;

  return (
    <div
      className="bg-surface rounded-2xl border border-gray-100 shadow-card overflow-hidden"
      style={{ animation: 'fadeSlideUp 0.3s ease-out' }}
    >
      {/* Top section: Pace headline */}
      <div className="px-5 pt-5 pb-4">
        {hasPace ? (
          <>
            {/* Identity-aware headline */}
            <p className="text-xs text-gray-400 font-medium mb-1">
              {identityLabel ? `Your ${identityLabel} Pace` : 'Your Pace'}
            </p>
            <div className="flex items-baseline gap-2.5 mb-1">
              <span className="text-3xl font-bold" style={{ color }}>
                {velocity > 0 ? '+' : ''}{velocity}%
              </span>
              <span
                className="text-sm font-bold uppercase tracking-wide"
                style={{ color }}
              >
                {label}
              </span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              {label === 'accelerating'
                ? 'Your training is improving faster than last week. Keep this momentum.'
                : label === 'stalling'
                ? 'Your improvement has slowed down. One focused session can turn this around.'
                : 'Holding steady — your key metrics are stable week over week.'}
            </p>
          </>
        ) : (
          <>
            <p className="text-xs text-gray-400 font-medium mb-1">
              {identityLabel ? `Your ${identityLabel} Pace` : 'Your Pace'}
            </p>
            <p className="text-sm text-gray-500 leading-relaxed">
              Your Pace will start showing trends after your second week of training.
              Keep logging sessions — we're recording your baseline.
            </p>
          </>
        )}
      </div>

      {/* Divider + bottom row: Training Score + See Why */}
      <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between">
        {/* Training Score pill */}
        {score != null ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Training Score</span>
            <span className="text-sm font-bold text-gray-700">{score}</span>
            {scoreDelta != null && scoreDelta !== 0 && (
              <span className={`text-[11px] font-semibold ${scoreDelta > 0 ? 'text-green-500' : 'text-red-500'}`}>
                {scoreDelta > 0 ? '+' : ''}{scoreDelta}
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Training Score</span>
            <span className="text-sm text-gray-300">—</span>
          </div>
        )}

        {/* See why link — the most important pixel on the card */}
        {hasPace && onViewMetric && (
          <button
            onClick={() => onViewMetric('pace-audit')}
            className="text-xs font-semibold text-accent flex items-center gap-1 hover:underline"
          >
            See why
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function GoalRing({ current, goal, size = 56 }) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(current / Math.max(goal, 1), 1);
  const offset = circumference * (1 - progress);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E8E5E0" strokeWidth={3} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1E3A5F" strokeWidth={3}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs font-bold text-accent leading-none">{current}/{goal}</span>
      </div>
    </div>
  );
}

function TrainingScoreRing({ score, prevScore, delta }) {
  const size = 88;
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const prevOffset = prevScore != null ? circumference * (1 - prevScore / 100) : null;
  const color = score >= 80 ? '#1E3A5F' : score >= 60 ? '#16A34A' : score >= 40 ? '#D97706' : '#DC2626';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E8E5E0" strokeWidth={5} />
        {/* Ghost ring — last week's score */}
        {prevOffset != null && (
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={5}
            strokeDasharray={circumference} strokeDashoffset={prevOffset} strokeLinecap="round"
            opacity={0.12} />
        )}
        {/* Current score arc */}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>{score}</span>
        {delta != null && delta !== 0 ? (
          <span className={`text-[10px] font-semibold ${delta > 0 ? 'text-green-500' : 'text-red-500'}`}>
            {delta > 0 ? '+' : ''}{delta}
          </span>
        ) : (
          <span className="text-[10px] text-gray-400">/ 100</span>
        )}
      </div>
    </div>
  );
}

function InsightsCard({ insights }) {
  const iconMap = { up: '\u2197', down: '\u2198', warn: '\u26A0', info: '\u2139' };

  return (
    <div className="bg-surface rounded-xl border border-gray-100 shadow-card p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Coach's Notes</h3>
      <div className="space-y-2">
        {insights.map((insight, i) => (
          <div key={i} className="flex gap-2 text-xs">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px]">
              {iconMap[insight.icon] || '\u2022'}
            </span>
            <p className="text-gray-600 leading-relaxed">{insight.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── WeeklyPaceCard — superseded by PaceHeroCard above. Kept on disk for
// easy reversal; no longer rendered anywhere in the Dashboard. ──────────
// eslint-disable-next-line no-unused-vars
const _PACE_COLORS_OLD = { accelerating: '#16A34A', steady: '#D97706', stalling: '#DC2626' };

// eslint-disable-next-line no-unused-vars
function WeeklyPaceCard({ sessions, idpGoals = [], onNavigate, onViewMetric, playerIdentity, position }) {
  const pace = useMemo(() => computePace(sessions, 4, position), [sessions, position]);
  if (!pace) return null;

  const { overall, metrics, recommendation } = pace;
  const color = _PACE_COLORS_OLD[overall.label] || _PACE_COLORS_OLD.steady;

  // Build narrative lines from metric changes
  const lines = useMemo(() => {
    const result = [];

    // Best improving metric
    const improving = Object.entries(metrics)
      .filter(([, m]) => m?.velocityPct > 0)
      .sort((a, b) => b[1].velocityPct - a[1].velocityPct);
    if (improving.length > 0) {
      const [key, m] = improving[0];
      const names = { shooting: 'shot accuracy', passing: 'pass accuracy', consistency: 'session frequency', duration: 'session duration', load: 'training load' };
      result.push({ type: 'up', text: `Your ${names[key] || key} climbed ${m.velocityPct}% this week.` });
    }

    // Worst declining metric
    const declining = Object.entries(metrics)
      .filter(([, m]) => m?.velocityPct < -2)
      .sort((a, b) => a[1].velocityPct - b[1].velocityPct);
    if (declining.length > 0) {
      const [key, m] = declining[0];
      const tip = getIdentityTip(playerIdentity, key);
      result.push({ type: 'down', text: `${key[0].toUpperCase() + key.slice(1)} is declining. ${tip}` });
    }

    // IDP projection (if there's a shooting IDP goal)
    const shootingGoal = idpGoals.find(g => g.status !== 'completed' && g.corner?.toLowerCase?.()?.includes?.('technical'));
    if (shootingGoal && metrics.shooting?.thisWeek != null && metrics.shooting?.velocityPct > 0) {
      const target = shootingGoal.progress != null ? 100 : 70; // assume 70% if no specific target
      const current = metrics.shooting.thisWeek;
      const weeklyGain = metrics.shooting.velocityPct;
      if (current < target && weeklyGain > 0) {
        const weeksToTarget = Math.ceil((target - current) / weeklyGain);
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + weeksToTarget * 7);
        const monthName = targetDate.toLocaleString('en-US', { month: 'long' });
        result.push({ type: 'target', text: `At this pace, you'll hit your IDP target by ${monthName}.` });
      }
    }

    return result;
  }, [metrics, idpGoals]);

  if (lines.length === 0 && !recommendation?.text) return null;

  const iconMap = { up: '↗', down: '↘', target: '🎯' };
  const colorMap = { up: 'text-green-600', down: 'text-red-500', target: 'text-accent' };

  return (
    <button
      onClick={() => onNavigate?.('pace')}
      className="w-full text-left bg-surface rounded-xl border border-gray-100 shadow-card p-4 space-y-2.5 transition-all hover:shadow-md"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Velocity % is tappable → goes directly to the Pace Audit view.
              stopPropagation prevents the card's own onClick (→ PaceTab) from firing. */}
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onViewMetric?.('pace-audit'); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onViewMetric?.('pace-audit'); } }}
            className="text-sm font-bold underline decoration-dotted underline-offset-2 cursor-pointer"
            style={{ color }}
            aria-label="See why your Pace moved"
          >
            {overall.velocityPct > 0 ? '+' : ''}{overall.velocityPct}%
          </span>
          <span className="text-xs font-semibold text-gray-700">
            {hasAnyIdentity(playerIdentity) && getIdentity(playerIdentity)?.label
              ? `Your ${getIdentity(playerIdentity).label} Pace`
              : 'Your Pace This Week'}
          </span>
        </div>
        <span className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide">
          {overall.label}
        </span>
      </div>

      {lines.map((line, i) => (
        <p key={i} className="text-xs text-gray-600 leading-relaxed">
          <span className={`font-semibold ${colorMap[line.type] || ''}`}>{iconMap[line.type] || '•'} </span>
          {line.text}
        </p>
      ))}

      {lines.length === 0 && recommendation?.text && (
        <p className="text-xs text-gray-500 leading-relaxed">{recommendation.text}</p>
      )}

      <p className="text-[10px] text-accent font-medium">View full Pace breakdown →</p>
    </button>
  );
}

// ── Match Day Card — surfaces scouting on match day ─────────

function MatchDayCard({ scoutingReports = [], onNavigate, onStartPlan }) {
  const upcoming = useMemo(() => {
    if (!scoutingReports.length) return null;
    const now = new Date();
    const threeDaysOut = new Date(now.getTime() + 3 * 86400000).toISOString().slice(0, 10);
    const todayStr = now.toISOString().slice(0, 10);

    // Find the closest upcoming match with a scouting report
    return scoutingReports
      .filter(r => r.matchDate && r.matchDate >= todayStr && r.matchDate <= threeDaysOut)
      .sort((a, b) => a.matchDate.localeCompare(b.matchDate))[0] || null;
  }, [scoutingReports]);

  if (!upcoming) return null;

  const isMatchDay = upcoming.matchDate === new Date().toISOString().slice(0, 10);
  const matchDate = new Date(upcoming.matchDate + 'T00:00:00');
  const dayLabel = isMatchDay ? 'TODAY' : matchDate.toLocaleDateString('en-US', { weekday: 'long' });
  const isReady = upcoming.status === 'ready';
  const hasGamePlan = upcoming.gamePlan != null;

  return (
    <div className="bg-surface rounded-xl border border-gray-100 shadow-card overflow-hidden" style={{ borderLeft: '4px solid #1E3A5F' }}>
      {/* Header bar */}
      <div className="bg-accent/5 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">⚔️</span>
          <span className="text-xs font-bold text-accent uppercase tracking-wide">
            {isMatchDay ? 'Match Day' : 'Upcoming Match'}
          </span>
        </div>
        <span className="text-[10px] font-semibold text-gray-500">{dayLabel}</span>
      </div>

      <div className="px-4 py-3 space-y-3">
        <div>
          <p className="text-sm font-bold text-gray-900">vs. {upcoming.clubName}</p>
          <p className="text-[10px] text-gray-400">
            {upcoming.level} · {upcoming.ageGroup} {upcoming.gender}
            {upcoming.location ? ` · ${upcoming.location}` : ''}
          </p>
        </div>

        {upcoming.status === 'pending' && (
          <div className="flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <p className="text-xs text-amber-700">Scouting report being generated...</p>
          </div>
        )}

        {isReady && (
          <div className="flex gap-2">
            <button
              onClick={() => onNavigate?.('scouting')}
              className="flex-1 text-xs font-semibold text-accent bg-accent/10 hover:bg-accent/20 rounded-lg px-3 py-2.5 transition-colors text-center"
            >
              View Report
            </button>
            {hasGamePlan && upcoming.gamePlan?.warmupSession ? (
              <button
                onClick={() => onStartPlan?.(upcoming.gamePlan.warmupSession)}
                className="flex-1 text-xs font-semibold text-white bg-accent hover:bg-accent/90 rounded-lg px-3 py-2.5 transition-colors text-center"
              >
                Start Warm-Up
              </button>
            ) : (
              <button
                onClick={() => onNavigate?.('scouting')}
                className="flex-1 text-xs font-semibold text-white bg-accent hover:bg-accent/90 rounded-lg px-3 py-2.5 transition-colors text-center"
              >
                Generate Game Plan
              </button>
            )}
          </div>
        )}

        {upcoming.status === 'failed' && (
          <p className="text-xs text-red-500">Report failed — tap to retry.</p>
        )}

        {isReady && upcoming.confidenceSummary && (
          <p className="text-[10px] text-gray-400 text-center">Report confidence: {upcoming.confidenceSummary}</p>
        )}
      </div>
    </div>
  );
}

export function Dashboard({ sessions, personalRecords, onViewSession, idpGoals = [], weeklyGoal = 3, ageGroup, skillLevel, onOpenSettings, onNavigateToLog, onStartPlan, onStartManual, onUploadVideo, onViewMetric, assignedPlans = [], trainingPlans = [], settings = {}, myCoach, onNavigate, onDismissGettingStarted, activeProgram, scoutingReports = [] }) {
  const insights = useMemo(() => generateInsights(sessions, [], personalRecords), [sessions, personalRecords]);
  // Pace moved to its own tab

  // (Removed: avgFOE, deliveryAcc, avgEndProduct, loadSpike, coachingFocus, devGap — accessible via MetricTrendView)

  // Weekly Load Gauge
  const weeklyLoad = useMemo(() => {
    const weeks = getWeeklyLoads(sessions, 2);
    const thisWeek = weeks.length > 0 ? weeks[weeks.length - 1] : { totalLoad: 0, sessionCount: 0 };
    const lastWeek = weeks.length > 1 ? weeks[weeks.length - 2] : { totalLoad: 0, sessionCount: 0 };
    const currentCount = getCurrentWeekSessionCount(sessions);
    const pctChange = lastWeek.totalLoad > 0 ? Math.round(((thisWeek.totalLoad - lastWeek.totalLoad) / lastWeek.totalLoad) * 100) : null;
    return { thisWeek, lastWeek, currentCount, pctChange };
  }, [sessions]);

  // Training score + deltas — memoize so the 10-pattern insight scan only runs when sessions change,
  // not on every render triggered by unrelated state (toggle expansions, modals, etc.)
  const trainingScore = useMemo(
    () => computeTrainingScoreWithDeltas(sessions, weeklyGoal),
    [sessions, weeklyGoal]
  );

  // (Removed: quickCompare, idpActivity — moved to MetricTrendView)

  // Compute pace for the hero card — must be before any early returns (Rules of Hooks)
  const pace = useMemo(
    () => computePace(sessions, 4, (Array.isArray(settings.position) && settings.position[0]) || 'General'),
    [sessions, settings.position]
  );

  // Empty state: show daily plan + prompt
  if (sessions.length === 0) {
    return (
      <div className="space-y-5 max-w-3xl mx-auto">
        <h1 className="text-3xl text-accent tracking-tight text-center font-logo italic">Composed</h1>
        <DateBrowser assignedPlans={assignedPlans} trainingPlans={trainingPlans} sessions={sessions} idpGoals={idpGoals} />

        {/* First-time hero — one action, no checklist */}
        <div className="bg-surface rounded-xl border border-gray-100 shadow-card p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Ready to train?</h2>
          <p className="text-xs text-gray-400 mb-5">Record your session and let AI track your progress.</p>
          <button
            onClick={() => onStartPlan && onStartPlan({ drills: [], timeline: [{ name: 'Warm-up', reps: '5 min', duration: 5, instruction: 'Light jog, dynamic stretches.', startMin: 0, isWarmup: true }, { name: 'Free Training', reps: '20 min', duration: 20, instruction: 'Work on what feels right today.', startMin: 5 }, { name: 'Cool-down', reps: '5 min', duration: 5, instruction: 'Static stretches.', startMin: 25, isCooldown: true }], targetDuration: 30, focus: 'Getting Started' })}
            className="w-full py-3 rounded-xl font-semibold text-sm btn-warm btn-bounce transition-all"
          >
            Start & Record
          </button>
          <div className="flex items-center justify-center gap-3 mt-3">
            <button onClick={() => onUploadVideo && onUploadVideo()} className="text-xs text-accent hover:underline">Upload a Video</button>
            <span className="text-gray-200">|</span>
            <button onClick={() => onNavigate?.('log')} className="text-xs text-gray-400 hover:text-gray-600">Log manually</button>
          </div>
        </div>
      </div>
    );
  }

  const totalSessions = sessions.length;
  const streak = getStreak(sessions);
  const avgShot = getAverageStat(sessions, getShotPercentage, 7);
  const avgPass = getAverageStat(sessions, getPassPercentage, 7);
  // (Removed: matchStats — unused after WHOOP restructure)

  const recentSessions = [...sessions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <h1 className="text-3xl text-accent tracking-tight text-center font-logo italic">Composed</h1>

      {/* Date Browser */}
      <DateBrowser assignedPlans={assignedPlans} trainingPlans={trainingPlans} sessions={sessions} idpGoals={idpGoals} />

      {/* ── 1. PACE HERO — the first thing the player sees ────────── */}
      <PaceHeroCard
        pace={pace}
        trainingScore={trainingScore}
        playerIdentity={settings.playerIdentity}
        onViewMetric={onViewMetric}
      />

      {/* Welcome Back (3+ days inactive) — shows right after hero if triggered */}
      <WelcomeBack sessions={sessions} playerName={settings.playerName} onStartSession={() => onNavigate?.('log')} />

      {/* ── 2. TODAY'S TRAINING ───────────────────────────────────── */}
      <DailyPlanCard sessions={sessions} idpGoals={idpGoals} onStartPlan={onStartPlan} onStartManual={onStartManual} assignedPlans={assignedPlans} activeProgram={activeProgram} position={(Array.isArray(settings.position) && settings.position[0]) || 'General'} playerIdentity={settings.playerIdentity} />

      {/* ── 3. THIS WEEK SUMMARY ──────────────────────────────────── */}
      <WeeklyReport sessions={sessions} matches={[]} personalRecords={personalRecords} weeklyGoal={weeklyGoal} />

      {/* ── 4. COACH'S NOTES (AI insights) — before Recent Sessions ── */}
      {insights.length > 0 && <InsightsCard insights={insights} />}

      {/* ── 5. RECENT SESSIONS ─────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Recent Sessions</h3>
          {sessions.length > 0 && (
            <button
              onClick={() => onNavigate?.('history')}
              className="text-xs font-medium text-accent hover:underline"
            >
              View All Sessions &rarr;
            </button>
          )}
        </div>
        {recentSessions.length === 0 ? (
          <div className="bg-surface rounded-xl border border-gray-100 shadow-card p-8 text-center text-gray-300 text-sm">
            No sessions logged yet. Start by logging your first session!
          </div>
        ) : (
          <div className="space-y-2">
            {recentSessions.map(session => (
              <div
                key={session.id}
                onClick={() => onViewSession(session)}
                className="bg-surface rounded-xl border border-gray-100 shadow-card p-4 cursor-pointer hover:shadow-card-hover transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{formatDate(session.date)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {session.drills.slice(0, 3).join(', ')}
                      {session.drills.length > 3 ? ` +${session.drills.length - 3} more` : ''}
                    </p>
                  </div>
                  <div className="flex gap-4 text-right">
                    {session.shooting && (
                      <div>
                        <p className="text-xs text-gray-400">Shot %</p>
                        <p className="text-sm font-semibold text-accent">
                          {formatPercentage(session.shooting.goals, session.shooting.shotsTaken)}
                        </p>
                      </div>
                    )}
                    {session.passing && (
                      <div>
                        <p className="text-xs text-gray-400">Pass %</p>
                        <p className="text-sm font-semibold text-accent">
                          {formatPercentage(session.passing.completed, session.passing.attempts)}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-400">Duration</p>
                      <p className="text-sm font-semibold text-gray-600">{session.duration}m</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── REMAINING SECTIONS (below the fold) ───────────────────── */}

      {/* Match Day Card — conditional, rare */}
      <MatchDayCard scoutingReports={scoutingReports} onNavigate={onNavigate} onStartPlan={onStartPlan} />

      {/* Compact metric sections */}
      {sessions.length > 0 && (
        <>
          <MetricSection title="Your Numbers">
            <MetricRow label="Total Sessions" value={totalSessions} onClick={() => onViewMetric?.('total-sessions')} />
            <MetricRow label="Streak" value={`${streak} day${streak !== 1 ? 's' : ''}`} onClick={() => onViewMetric?.('streak')} />
            <MetricRow
              label="Weekly Goal"
              value={`${getCurrentWeekSessionCount(sessions)}/${weeklyGoal}`}
              sub={getCurrentWeekSessionCount(sessions) >= weeklyGoal ? 'Goal reached!' : `${weeklyGoal - getCurrentWeekSessionCount(sessions)} to go`}
              onClick={() => onViewMetric?.('weekly-goal')}
            />
            {(() => {
              const ts = computeTrainingScore(sessions, weeklyGoal);
              return ts ? (
                <MetricRow label="Training Score" value={`${ts.score}/100`} onClick={() => onViewMetric?.('training-score')} />
              ) : null;
            })()}
          </MetricSection>

          <MetricSection title="Performance">
            <MetricRow
              label="Shot Accuracy"
              value={avgShot !== null ? `${avgShot}%` : '\u2014'}
              sub="Last 7 sessions"
              trend={avgShot !== null && sessions.length >= 2 ? (() => {
                const prev = getAverageStat(sessions.slice(0, -1), getShotPercentage, 7);
                if (prev === null || avgShot === null) return undefined;
                const diff = avgShot - prev;
                return diff !== 0 ? `${Math.abs(diff)}%` : undefined;
              })() : undefined}
              trendUp={avgShot !== null && sessions.length >= 2 ? (() => {
                const prev = getAverageStat(sessions.slice(0, -1), getShotPercentage, 7);
                return prev !== null && avgShot !== null ? avgShot > prev : undefined;
              })() : undefined}
              onClick={() => onViewMetric?.('shot-accuracy')}
            />
            <MetricRow
              label="Pass Accuracy"
              value={avgPass !== null ? `${avgPass}%` : '\u2014'}
              sub="Last 7 sessions"
              onClick={() => onViewMetric?.('pass-accuracy')}
            />
            <MetricRow
              label="Avg Duration"
              value={sessions.length > 0 ? `${Math.round(sessions.reduce((s, x) => s + (x.duration || 0), 0) / sessions.length)} min` : '\u2014'}
              onClick={() => onViewMetric?.('duration')}
            />
            {sessions.some(s => s.fitness?.rpe) && (
              <MetricRow
                label="RPE"
                value={(() => {
                  const rpeSessions = sessions.filter(s => s.fitness?.rpe);
                  if (rpeSessions.length === 0) return '\u2014';
                  return `${(rpeSessions.reduce((s, x) => s + x.fitness.rpe, 0) / rpeSessions.length).toFixed(1)}/10`;
                })()}
                onClick={() => onViewMetric?.('rpe')}
              />
            )}
          </MetricSection>

          <MetricSection title="Development">
            <MetricRow
              label="Weak Foot"
              value={(() => {
                let l = 0, lG = 0, r = 0, rG = 0;
                sessions.forEach(s => {
                  if (s.shooting?.leftFoot) { l += s.shooting.leftFoot.shots || 0; lG += s.shooting.leftFoot.goals || 0; }
                  if (s.shooting?.rightFoot) { r += s.shooting.rightFoot.shots || 0; rG += s.shooting.rightFoot.goals || 0; }
                });
                if (l === 0 && r === 0) return '\u2014';
                const lPct = l > 0 ? Math.round((lG / l) * 100) : 0;
                const rPct = r > 0 ? Math.round((rG / r) * 100) : 0;
                return `L:${lPct}% R:${rPct}%`;
              })()}
              onClick={() => onViewMetric?.('weak-foot')}
            />
            <MetricRow
              label="Personal Records"
              value={personalRecords ? Object.values(personalRecords).filter(v => v?.value != null).length : 0}
              sub="All-time bests"
              onClick={() => onViewMetric?.('personal-records')}
            />
            {idpGoals.filter(g => g.status === 'active').length > 0 && (
              <MetricRow
                label="IDP Goals"
                value={`${idpGoals.filter(g => g.status === 'active').length} active`}
                onClick={() => onNavigate?.('profile')}
              />
            )}
          </MetricSection>

          {sessions.length >= 2 && (
            <MetricSection title="Load & Recovery">
              <MetricRow
                label="Weekly Load"
                value={weeklyLoad.thisWeek?.totalLoad || 0}
                trend={weeklyLoad.pctChange !== null ? `${Math.abs(weeklyLoad.pctChange)}%` : undefined}
                trendUp={weeklyLoad.pctChange > 0}
                onClick={() => onViewMetric?.('weekly-load')}
              />
              <MetricRow
                label="Fatigue"
                value={(() => {
                  const decay = computeFatigueDecay(sessions);
                  if (decay === null) return '\u2014';
                  return decay > 70 ? 'High' : decay > 40 ? 'Moderate' : 'Low';
                })()}
                onClick={() => onViewMetric?.('fatigue')}
              />
              {sessions.some(s => s.reflection?.confidence != null) && (
                <MetricRow
                  label="Mental"
                  value={(() => {
                    const mental = sessions.filter(s => s.reflection?.confidence != null);
                    if (mental.length === 0) return '\u2014';
                    return `${(mental.reduce((s, x) => s + (x.reflection?.confidence || 0), 0) / mental.length).toFixed(1)}/5`;
                  })()}
                  sub="Avg confidence"
                  onClick={() => onViewMetric?.('mental')}
                />
              )}
            </MetricSection>
          )}
        </>
      )}

    </div>
  );
}
