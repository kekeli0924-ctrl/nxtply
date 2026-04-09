import { useMemo } from 'react';
import { MetricRow, MetricSection } from './MetricRow';
import { WeeklyReport } from './WeeklyReport';
import { DailyPlanCard } from './DailyPlanCard';
import { GettingStartedChecklist } from './GettingStartedChecklist';
import { WelcomeBack } from './WelcomeBack';
import { DateBrowser } from './DateBrowser';
import { SocialFeed } from './SocialFeed';
import {
  getStreak, getAverageStat, getShotPercentage, getPassPercentage,
  formatDate, formatPercentage, computeTrainingScore,
  getCurrentWeekSessionCount, getWeeklyLoads,
  computeFatigueDecay, generateInsights,
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

export function Dashboard({ sessions, personalRecords, onViewSession, idpGoals = [], weeklyGoal = 3, ageGroup, skillLevel, onOpenSettings, onNavigateToLog, onStartPlan, onStartManual, onUploadVideo, onViewMetric, assignedPlans = [], trainingPlans = [], settings = {}, myCoach, onNavigate, onDismissGettingStarted, activeProgram }) {
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

  // (Removed: quickCompare, idpActivity — moved to MetricTrendView)

  // Empty state: show daily plan + prompt
  if (sessions.length === 0) {
    return (
      <div className="space-y-5 max-w-3xl mx-auto">
        <h1 className="text-3xl text-accent tracking-tight text-center font-logo italic">Composed</h1>
        <DateBrowser assignedPlans={assignedPlans} trainingPlans={trainingPlans} sessions={sessions} idpGoals={idpGoals} />
        <GettingStartedChecklist sessions={sessions} idpGoals={idpGoals} myCoach={myCoach} settings={settings} onNavigate={onNavigate} onDismiss={onDismissGettingStarted} />
        <DailyPlanCard sessions={sessions} idpGoals={idpGoals} onStartPlan={onStartPlan} onStartManual={onStartManual} onUploadVideo={onUploadVideo} assignedPlans={assignedPlans} activeProgram={activeProgram} position={settings.position || 'General'} />
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
    <div className="space-y-6 max-w-3xl mx-auto">
      <h1 className="text-3xl text-accent tracking-tight text-center font-logo italic">Composed</h1>

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

      {/* Recent Sessions */}
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

      {/* ── WHOOP-Style Compact Metrics ── */}
      {sessions.length > 0 && (
        <>
          {/* Your Numbers */}
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

          {/* Performance */}
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

          {/* Development */}
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

          {/* Load & Recovery */}
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

          {/* Insights */}
          {insights.length > 0 && <InsightsCard insights={insights} />}
        </>
      )}

      {/* Social Feed */}
      <SocialFeed />

    </div>
  );
}
