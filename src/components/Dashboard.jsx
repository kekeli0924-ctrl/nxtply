import { useMemo } from 'react';
import { StatCard } from './ui/Card';
import { Button } from './ui/Button';
import { ShotPercentChart, PassPercentChart, DurationChart, RPEChart, FOETrendChart, ShotPortfolioChart } from './Charts';
import { FourPillarChart } from './FourPillarChart';
import { WeeklyReport } from './WeeklyReport';
import { PersonalRecords } from './PersonalRecords';
import { WeakFootWidget } from './WeakFootWidget';
import { BodyCheckInsights } from './BodyCheckInsights';
import { FatigueAnalysis } from './FatigueAnalysis';
import { GapSuggestionsCard } from './GapSuggestionsCard';
import { ComparisonCard } from './ComparisonCard';
import { DailyPlanCard } from './DailyPlanCard';
import { GettingStartedChecklist } from './GettingStartedChecklist';
import { ProgressCharts } from './ProgressCharts';
import { WelcomeBack } from './WelcomeBack';
import { DateBrowser } from './DateBrowser';
import { SessionLoadChart } from './SessionLoadChart';
import { MentalTrendChart } from './MentalTrendChart';
import {
  getStreak, getAverageStat, getShotPercentage, getPassPercentage,
  getMatchStats, formatDate, formatPercentage, computeTrainingScore,
  getCurrentWeekSessionCount, getDeadlineBadge, getDeliveryAccuracy,
  getTakeOnEndProductRate, getWeakestApproach, getWeeklyLoads,
  computeFatigueDecay, diagnoseFatigue, generateInsights, PR_LABELS,
} from '../utils/stats';

const BREAKDOWN_LABELS = {
  consistency: 'Consistency',
  shooting: 'Shooting',
  passing: 'Passing',
  physical: 'Physical',
  endurance: 'Endurance',
  mental: 'Mental',
};

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

function TrainingScoreRing({ score }) {
  const size = 88;
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const color = score >= 80 ? '#1E3A5F' : score >= 60 ? '#16A34A' : score >= 40 ? '#D97706' : '#DC2626';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E8E5E0" strokeWidth={5} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>{score}</span>
        <span className="text-[10px] text-gray-400">/ 100</span>
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

export function Dashboard({ sessions, personalRecords, onViewSession, idpGoals = [], weeklyGoal = 3, ageGroup, skillLevel, onOpenSettings, onNavigateToLog, onStartPlan, onStartManual, assignedPlans = [], trainingPlans = [], settings = {}, myCoach, onNavigate, onDismissGettingStarted, activeProgram }) {
  const insights = useMemo(() => generateInsights(sessions, [], personalRecords), [sessions, personalRecords]);

  // FOE (Finishing Over Expected) average
  const avgFOE = useMemo(() => {
    const xgSessions = sessions.filter(s => s.shooting?.xG != null);
    if (!xgSessions.length) return null;
    const recent = [...xgSessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
    const foes = recent.map(s => s.shooting.goals - s.shooting.xG);
    return Math.round(foes.reduce((a, b) => a + b, 0) / foes.length * 100) / 100;
  }, [sessions]);

  // Delivery accuracy average
  const deliveryAcc = useMemo(() => {
    const acc = getDeliveryAccuracy(sessions);
    if (!acc.length) return null;
    return Math.round(acc.reduce((sum, d) => sum + d.accuracy, 0) / acc.length);
  }, [sessions]);

  // Take-on end product rate
  const avgEndProduct = useMemo(() => {
    const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
    const rates = sorted.slice(0, 7).map(s => getTakeOnEndProductRate(s)).filter(v => v !== null);
    if (!rates.length) return null;
    return Math.round(rates.reduce((a, b) => a + b, 0) / rates.length);
  }, [sessions]);

  // Load spike detection
  const loadSpike = useMemo(() => {
    const weeks = getWeeklyLoads(sessions, 4);
    if (weeks.length < 2) return null;
    const current = weeks[weeks.length - 1].totalLoad;
    const prev = weeks.slice(0, -1).filter(w => w.totalLoad > 0);
    if (!prev.length || current === 0) return null;
    const avgPrev = prev.reduce((s, w) => s + w.totalLoad, 0) / prev.length;
    const ratio = current / avgPrev;
    if (ratio > 1.5) return { level: 'high', msg: `This week's training load is ${Math.round((ratio - 1) * 100)}% above your average. Consider a recovery day.` };
    if (ratio > 1.3) return { level: 'moderate', msg: `Training load is ${Math.round((ratio - 1) * 100)}% above average. Monitor how you feel.` };
    return null;
  }, [sessions]);

  // Coaching focus (weakest area)
  const coachingFocus = useMemo(() => {
    if (sessions.length < 5) return null;
    const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
    const avgShot5 = getAverageStat(sorted.slice(0, 5), getShotPercentage);
    const avgPass5 = getAverageStat(sorted.slice(0, 5), getPassPercentage);
    if (avgShot5 !== null && avgPass5 !== null) {
      if (avgShot5 < avgPass5 - 10) return { focus: 'Finishing', msg: 'Your passing is ahead of your shooting. Add more targeted finishing drills.' };
      if (avgPass5 < avgShot5 - 10) return { focus: 'Distribution', msg: 'Your shooting is ahead of your passing. Work on passing accuracy and weight of pass.' };
    }
    return null;
  }, [sessions]);

  // Development gap (weakest shooting approach)
  const devGap = useMemo(() => getWeakestApproach(sessions), [sessions]);

  // Weekly Load Gauge
  const weeklyLoad = useMemo(() => {
    const weeks = getWeeklyLoads(sessions, 2);
    const thisWeek = weeks.length > 0 ? weeks[weeks.length - 1] : { totalLoad: 0, sessionCount: 0 };
    const lastWeek = weeks.length > 1 ? weeks[weeks.length - 2] : { totalLoad: 0, sessionCount: 0 };
    const currentCount = getCurrentWeekSessionCount(sessions);
    const pctChange = lastWeek.totalLoad > 0 ? Math.round(((thisWeek.totalLoad - lastWeek.totalLoad) / lastWeek.totalLoad) * 100) : null;
    return { thisWeek, lastWeek, currentCount, pctChange };
  }, [sessions]);

  // Quick Compare: last session vs 5-session average
  const quickCompare = useMemo(() => {
    if (sessions.length < 2) return null;
    const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
    const last = sorted[0];
    const prev5 = sorted.slice(1, 6);
    if (!prev5.length) return null;
    const metrics = [];
    metrics.push({
      label: 'Duration',
      last: last.duration,
      avg: Math.round(prev5.reduce((s, x) => s + x.duration, 0) / prev5.length),
      unit: 'min',
    });
    metrics.push({
      label: 'Rating',
      last: last.quickRating,
      avg: Math.round(prev5.reduce((s, x) => s + (x.quickRating || 3), 0) / prev5.length * 10) / 10,
      unit: '/10',
    });
    const lastShot = getShotPercentage(last);
    const avgShot5 = getAverageStat(prev5, getShotPercentage);
    if (lastShot !== null && avgShot5 !== null) {
      metrics.push({ label: 'Shot %', last: lastShot, avg: avgShot5, unit: '%' });
    }
    const lastPass = getPassPercentage(last);
    const avgPass5 = getAverageStat(prev5, getPassPercentage);
    if (lastPass !== null && avgPass5 !== null) {
      metrics.push({ label: 'Pass %', last: lastPass, avg: avgPass5, unit: '%' });
    }
    return { lastDate: last.date, metrics };
  }, [sessions]);

  // IDP Activity: sessions this week linked to IDP goals
  const idpActivity = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    const mondayStr = monday.toISOString().split('T')[0];
    const linked = sessions.filter(s => s.date >= mondayStr && s.idpGoals?.length > 0);
    return { count: linked.length, total: getCurrentWeekSessionCount(sessions) };
  }, [sessions]);

  // Empty state: show daily plan + prompt
  if (sessions.length === 0) {
    return (
      <div className="space-y-5 max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold text-accent tracking-tight text-center font-heading">Composed</h1>
        <DateBrowser assignedPlans={assignedPlans} trainingPlans={trainingPlans} sessions={sessions} idpGoals={idpGoals} />
        <GettingStartedChecklist sessions={sessions} idpGoals={idpGoals} myCoach={myCoach} settings={settings} onNavigate={onNavigate} onDismiss={onDismissGettingStarted} />
        <DailyPlanCard sessions={sessions} idpGoals={idpGoals} onStartPlan={onStartPlan} onStartManual={onStartManual} assignedPlans={assignedPlans} activeProgram={activeProgram} position={settings.position || 'General'} />
      </div>
    );
  }

  const totalSessions = sessions.length;
  const streak = getStreak(sessions);
  const avgShot = getAverageStat(sessions, getShotPercentage, 7);
  const avgPass = getAverageStat(sessions, getPassPercentage, 7);
  const matchStats = getMatchStats([]);

  const recentSessions = [...sessions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold text-accent tracking-tight text-center font-heading">Composed</h1>

      {/* Date Browser */}
      <DateBrowser assignedPlans={assignedPlans} trainingPlans={trainingPlans} sessions={sessions} idpGoals={idpGoals} />

      {/* Getting Started */}
      <GettingStartedChecklist sessions={sessions} idpGoals={idpGoals} myCoach={myCoach} settings={settings} onNavigate={onNavigate} onDismiss={onDismissGettingStarted} />

      {/* Training Score Hero */}
      {(() => {
        const trainingScore = computeTrainingScore(sessions, weeklyGoal);
        if (!trainingScore) return (
          <div className="flex gap-4 items-start">
            <div className="flex-1">
              <WeeklyReport sessions={sessions} matches={[]} personalRecords={personalRecords} weeklyGoal={weeklyGoal} />
            </div>
            <div className="flex flex-col items-center pt-4">
              <GoalRing current={getCurrentWeekSessionCount(sessions)} goal={weeklyGoal} />
              <p className="text-[10px] text-gray-400 mt-1">Weekly Goal</p>
            </div>
          </div>
        );
        return (
          <>
            <div className="bg-surface rounded-xl border border-gray-100 shadow-card p-5" style={{ animation: 'fadeSlideUp 0.3s ease-out' }}>
              <div className="flex items-center gap-6">
                <TrainingScoreRing score={trainingScore.score} />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700">Training Score</h3>
                      <p className="text-[10px] text-gray-400">Composite performance rating</p>
                    </div>
                    <GoalRing current={getCurrentWeekSessionCount(sessions)} goal={weeklyGoal} size={48} />
                  </div>
                  <div className="grid grid-cols-3 gap-x-4 gap-y-1.5">
                    {Object.entries(trainingScore.breakdown).map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-400">{BREAKDOWN_LABELS[key]}</span>
                        <span className="text-[10px] font-semibold text-gray-700">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {/* Weekly Report — only shown alongside Training Score hero */}
            <WeeklyReport sessions={sessions} matches={[]} personalRecords={personalRecords} weeklyGoal={weeklyGoal} />
          </>
        );
      })()}

      {/* Welcome Back (3+ days inactive) */}
      <WelcomeBack sessions={sessions} playerName={settings.playerName} onStartSession={() => onNavigate?.('log')} />

      {/* Daily Plan */}
      <DailyPlanCard sessions={sessions} idpGoals={idpGoals} onStartPlan={onStartPlan} onStartManual={onStartManual} assignedPlans={assignedPlans} activeProgram={activeProgram} position={settings.position || 'General'} />

      {/* Progress Charts */}
      <ProgressCharts sessions={sessions} />

      {/* Streak + XP */}

      {/* Social Feed */}
      <SocialFeed />

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Sessions" value={totalSessions} />
        <StatCard label="Avg Shot %" value={avgShot !== null ? `${avgShot}%` : '\u2014'} sub="Last 7 sessions" />
        <StatCard label="Avg Pass %" value={avgPass !== null ? `${avgPass}%` : '\u2014'} sub="Last 7 sessions" />
      </div>

      {/* Peer Comparison */}
      <ComparisonCard sessions={sessions} ageGroup={ageGroup} skillLevel={skillLevel} onOpenSettings={onOpenSettings} />

      {/* Weekly Load Gauge */}
      {sessions.length >= 2 && (
        <div className="bg-surface rounded-xl border border-gray-100 shadow-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Weekly Load</h3>
            {weeklyLoad.pctChange !== null && (
              <span className={`text-xs font-medium ${weeklyLoad.pctChange > 0 ? 'text-green-600' : weeklyLoad.pctChange < 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                {weeklyLoad.pctChange > 0 ? '+' : ''}{weeklyLoad.pctChange}% vs last week
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Sessions: {weeklyLoad.currentCount} / {weeklyGoal}</span>
                <span>Load: {weeklyLoad.thisWeek.totalLoad}</span>
              </div>
              <div className="h-2.5 rounded-full bg-gray-100">
                <div
                  className={`h-2.5 rounded-full transition-all ${
                    weeklyLoad.currentCount >= weeklyGoal ? 'bg-green-500' :
                    weeklyLoad.currentCount >= weeklyGoal * 0.5 ? 'bg-accent' : 'bg-amber-400'
                  }`}
                  style={{ width: `${Math.min((weeklyLoad.currentCount / Math.max(weeklyGoal, 1)) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {weeklyLoad.currentCount >= weeklyGoal
              ? 'Goal reached! Consider a recovery day.'
              : weeklyLoad.currentCount >= weeklyGoal - 1
                ? 'Almost there — one more session to hit your goal.'
                : `${weeklyGoal - weeklyLoad.currentCount} sessions to go this week.`}
          </p>
        </div>
      )}

      {/* Quick Compare */}
      {quickCompare && (
        <div className="bg-surface rounded-xl border border-gray-100 shadow-card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Last Session vs Average</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quickCompare.metrics.map(m => {
              const diff = m.last - m.avg;
              const pct = m.avg ? Math.abs(Math.round((diff / m.avg) * 100)) : 0;
              const trend = pct <= 5 ? 'neutral' : diff > 0 ? 'up' : 'down';
              const arrow = trend === 'up' ? '\u2197' : trend === 'down' ? '\u2198' : '\u2192';
              const color = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-500' : 'text-gray-400';
              return (
                <div key={m.label} className="text-center">
                  <p className="text-[10px] text-gray-400">{m.label}</p>
                  <p className="text-lg font-bold text-accent">{m.last}{m.unit}</p>
                  <p className={`text-xs ${color}`}>
                    {arrow} avg {m.avg}{m.unit}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* IDP Activity */}
      {idpGoals.filter(g => g.status === 'active').length > 0 && (
        <div className="bg-surface rounded-xl border border-gray-100 shadow-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">IDP Activity</p>
              <p className="text-sm text-gray-700 mt-1">
                <span className="font-bold text-accent">{idpActivity.count}</span> of {idpActivity.total} session{idpActivity.total !== 1 ? 's' : ''} this week linked to IDP goals
              </p>
            </div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${idpActivity.count > 0 ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
              {idpActivity.count > 0 ? '\u2713' : '\u2014'}
            </div>
          </div>
        </div>
      )}

      {/* Attacking Intelligence */}
      {(avgFOE !== null || deliveryAcc !== null || avgEndProduct !== null) && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {avgFOE !== null && <StatCard label="Avg FOE" value={avgFOE > 0 ? `+${avgFOE}` : avgFOE} sub="Finishing Over Expected" />}
          {deliveryAcc !== null && <StatCard label="Delivery Accuracy" value={`${deliveryAcc}%`} sub="Cross/cutback quality" />}
          {avgEndProduct !== null && <StatCard label="End Product Rate" value={`${avgEndProduct}%`} sub="After beating defender" />}
        </div>
      )}

      {/* Load Spike Alert */}
      {loadSpike && (
        <div className={`rounded-lg px-4 py-3 border text-sm ${loadSpike.level === 'high' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
          <p className="font-medium">Load Spike Detected</p>
          <p className="text-xs mt-0.5 opacity-75">{loadSpike.msg}</p>
        </div>
      )}

      {/* Coaching Focus Card */}
      {coachingFocus && (
        <div className="bg-surface rounded-xl border border-accent/20 shadow-card p-4">
          <p className="text-xs font-medium text-accent uppercase tracking-wide">This Week's Focus</p>
          <p className="text-sm font-semibold text-gray-900 mt-1">{coachingFocus.focus}</p>
          <p className="text-xs text-gray-500 mt-1">{coachingFocus.msg}</p>
        </div>
      )}

      {/* Four-Pillar Development Radar */}
      <FourPillarChart sessions={sessions} />

      {/* AI Insights - Coach's Notes */}
      {insights.length > 0 && <InsightsCard insights={insights} />}

      {/* Gap-Based Session Suggestions */}
      <GapSuggestionsCard sessions={sessions} onNavigateToLog={onNavigateToLog} />

      {/* Development Gap */}
      {devGap && (
        <div className="bg-surface rounded-xl border border-gray-100 shadow-card p-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Development Gap</p>
          <div className="flex items-center justify-between mt-2">
            <div>
              <p className="text-sm font-semibold text-gray-900 capitalize">{devGap.approach.replace(/-/g, ' ')}</p>
              <p className="text-xs text-gray-500">{devGap.goals}/{devGap.shots} shots ({devGap.pct}%)</p>
            </div>
            <span className="text-lg font-bold text-red-500">{devGap.pct}%</span>
          </div>
        </div>
      )}


      {/* Due This Week - IDP Goals */}
      {(() => {
        const dueGoals = idpGoals.filter(g => g.status === 'active' && g.targetDate && (() => {
          const badge = getDeadlineBadge(g.targetDate);
          return badge && (badge.color === 'red' || badge.color === 'amber');
        })());
        if (!dueGoals.length) return null;
        return (
          <div className="bg-surface rounded-xl border border-amber-100 shadow-card p-4">
            <p className="text-xs font-medium text-amber-600 uppercase tracking-wide mb-2">Due This Week</p>
            <div className="space-y-1.5">
              {dueGoals.map(g => {
                const badge = getDeadlineBadge(g.targetDate);
                return (
                  <div key={g.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 text-xs truncate flex-1">{g.text}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ml-2 ${badge.color === 'red' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>{badge.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Personal Records */}
      <PersonalRecords records={personalRecords} />

      {/* Weak Foot Widget */}
      <WeakFootWidget sessions={sessions} />

      {/* Body Check Insights */}
      <BodyCheckInsights sessions={sessions} />

      {/* Fatigue Analysis */}
      <FatigueAnalysis sessions={sessions} />

      {/* Session Load Chart */}
      <SessionLoadChart sessions={sessions} />

      {/* Mental Trend Chart */}
      <MentalTrendChart sessions={sessions} />

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ShotPercentChart sessions={sessions} />
        <PassPercentChart sessions={sessions} />
        <DurationChart sessions={sessions} />
        <RPEChart sessions={sessions} />
      </div>

      {/* Recent Sessions */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Sessions</h3>
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
    </div>
  );
}
